
import BelongsTo from './relations/BelongsTo';
import BelongsToMany from './relations/BelongsToMany';
import HasOne from './relations/HasOne';
import HasMany from './relations/HasMany';
import ModelCollection from './ModelCollection';
import iSQL from '../data-access/sql/interface/SQLInterface';
import SQLResult from '../data-access/sql/SQLResult';
import DataAccessFactory from '../data-access/factory';
var dataFactory:DataAccessFactory = DataAccessFactory.getInstance();

export default class BaseModel {
    private tableName: string;
    private sqlConfig: string;
    private primaryKey: string;
    private columns: string[] = ["*"];
    private original: {[key:string]:any} = {};
    private changed: {[key:string]:any} = {};
    private isNew: boolean;
    private relations: {[key:string]:ModelCollection | BaseModel | null} = {};
    private additionalColumns: {[key:string]:any} = {};
    private visibleColumns: string[] = [];
    private incrementingField: string | undefined;

    constructor(sqlConfig: string, tableName: string, primaryKey: string = "id", fields: string[]) {
        this.relations = {};
        this.sqlConfig = sqlConfig;
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.columns = [];
        this.isNew = true;
        fields.forEach((field)=> {
            this.original[field] = null;
            this.columns.push(this.tableName + "." + field);
        });
    }

    protected setIncrementingField(field:string) {
        if(Object.keys(this.original).includes(field)) {
            this.incrementingField = field;
        }
    }

    public getSqlConfig() {
        return this.sqlConfig;
    }

    public setSqlConfig(config:string) {
        this.sqlConfig = config;
    }

    public getTable() : string {
        return this.tableName;
    }
    
    public getPrimaryKey() : string {
        return this.primaryKey;
    }

    private createDA() {
        const da = dataFactory.create(this.sqlConfig);
        if(!da) {
            throw("No database found");
        }
        da.table(this.tableName);
        da.cols(this.columns);
        da.toModel(this.constructor);
        if(this.incrementingField) {
            da.setIncrementingField(this.incrementingField);
        }
        return da;
    }

    public find(id: any) : Promise<BaseModel> {
        const da = this.createDA();
        da.where(this.primaryKey,"=",id,true);
        return new Promise((resolve,reject) => {
            da.fetch().then((result: SQLResult) => {
                if(result.success && result.rows.length > 0) {
                    this.original = result.rows[0];
                    this.isNew = false;
                    resolve(this);
                } else {
                    reject(null);
                }                
            });
        });            
    }

    public loadData(data: object) {
        for(var key in data) {
            if(Object.keys(this.original).indexOf(key) > -1) {
                this.original[key] = data[key as keyof typeof data];
            }
        }
        this.isNew = false;
        return this;
    }

    public all():iSQL {
        const da = this.createDA();
        return da;
    }

    public setSelectColumns(columns: string[]): any {
        if(columns.indexOf(this.primaryKey) == -1) {
            columns.push(this.primaryKey);
        }
        var selectColumns: string[] = [];
        columns.forEach((col)=>{
            if(Object.keys(this.original).indexOf(col) > -1) {
                selectColumns.push(this.tableName + "." + col);
            }
        });
        this.columns = selectColumns;
        return this;
    }

    public getSelectColumns(): string[] {
        return this.columns;
    }

    public updateColumn(column: string, value: any) {
        if(column in this.original) {
            this.changed[column] = value;
        }
    }
    
    public updateColumns(values: object) {
        for(var key in values) {
            this.updateColumn(key,values[key as keyof typeof values]);
        }
    }

    public getColumns() : {[key:string]:any} {
        var values:{[key:string]:any} = {};
        for(var key in this.original) {
            if(key in this.changed) {
                values[key] = this.changed[key];
            } else {
                values[key] = this.original[key];
            }
        }
        return values;
    }

    public getColumn(column: string) {
        if(column in this.changed) {
            return this.changed[column];
        } else if(column in this.original) {
            return this.original[column];
        }
        return null;
    }
    
    public getAdditionalColumns() : object {
        return this.additionalColumns;
    }

    public getAdditionalColumn(column: string) {
        if(column in this.additionalColumns) {
            return this.additionalColumns[column];
        }
        return null;
    }

    public toJSON() {
        var base = this.getColumns();
        for(let key in this.additionalColumns) {
            base[key] = this.additionalColumns[key];
        }
        if(this.visibleColumns.length > 0) {
            for(var key in base) {
                if(this.visibleColumns.indexOf(key) === -1) {
                    delete base[key];
                }
            }
        }
        for(var key in this.relations) {
            const relation = this.relations[key];
            if(relation instanceof ModelCollection) {
                base[key] = [];
                relation.getModels().forEach((related)=>{
                    base[key].push(related.toJSON());
                });
            } else if(relation) {
                base[key] = relation.toJSON();
            }
        }
        return base;
    }

    public setVisibleColumns(columns: string[]) : any {
        this.visibleColumns = [];
        var allFields = Object.keys(this.original).concat(Object.keys(this.additionalColumns));
        columns.forEach(col=>{
            if(allFields.indexOf(col) > -1) {
                this.visibleColumns.push(col);
            }       
        });
        return this;
    }

    public save(): Promise<boolean> {
        return new Promise((resolve,reject) => {
            const da = this.createDA();
            var updateObj:{[key:string]:any} = {};
            for(var key in this.changed) {
                updateObj[key] = this.changed[key];
            }
            if(!this.isNew) {
                da.update(updateObj,true);
                da.where(this.primaryKey,"=",this.original[this.primaryKey],true);
            } else {
                da.insert(updateObj,true);
            }
            da.save().then((result)=>{
                if(result.rows_affected > 0) {
                    if(this.isNew) {
                        if(result.insert_id > 0) {
                            this.original[this.primaryKey] = result.insert_id;
                        }
                        this.isNew = false;
                    }
                    for(var key in this.changed) {
                        this.original[key] = this.changed[key];
                    }
                }                
                resolve(result.rows_affected > 0);
            }).catch((err)=>{
                reject(err);
            });
            
        });
    }

    public delete(): Promise<boolean> {
        return new Promise((resolve,reject) => {
            if(this.isNew) {
                return reject("record doesn't exist");
            }
            const da = this.createDA();
            da.where(this.primaryKey,"=",this.original[this.primaryKey],true);
            da.delete().then((result)=>{           
                resolve(result.rows_affected > 0);
            }).catch((err)=>{
                reject(err);
            });
            
        });
    }

    public belongsTo(modelFunc: new (...args: any[]) => BaseModel, foreignKey: string) {
        return new BelongsTo(this,modelFunc,foreignKey);
    }
    
    public hasOne(modelFunc: new (...args: any[]) => BaseModel, foreignKey: string) {
        return new HasOne(this,modelFunc,foreignKey);
    }
    
    public hasMany(modelFunc: new (...args: any[]) => BaseModel, foreignKey: string) {
        return new HasMany(this,modelFunc,foreignKey);
    }
    
    public belongsToMany(modelFunc: new (...args: any[]) => BaseModel, linkTable: string, primaryForeignKey: string, secondaryForeignKey: string) {
        return new BelongsToMany(this,modelFunc,linkTable,primaryForeignKey,secondaryForeignKey);
    }

    public setRelation(relationName: string, models: ModelCollection | BaseModel | null) {
        if(typeof this[relationName as keyof this] !== "undefined") {
            this.relations[relationName] = models;
        }
    }
    public getRelation(relationName: string) {
        if(relationName in this.relations) {
            return this.relations[relationName];
        }
        return null;
    }
    public hasRelation(relationName:string): boolean {
        return relationName in this.relations;
    }

    public addAdditionalColumn(field:string,value:any) {
        this.additionalColumns[field] = value;
    }

    public eagerLoad(relations:Map<string, (q: iSQL)=>iSQL>) {
        var collection = new ModelCollection;
        collection.add(this);
        return collection.eagerLoad(relations);
        
    }
}