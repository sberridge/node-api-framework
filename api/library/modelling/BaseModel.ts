
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
    private original: object = {};
    private changed: object = {};
    private isNew: boolean;
    private relations: object = {};
    private additionalColumns: object = {};
    private visibleColumns: string[] = [];
    private incrementingField: string;

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

    public find(id: any) : Promise<BaseModel> {
        var da = dataFactory.create(this.sqlConfig);
        if(this.incrementingField) {
            da.setIncrementingField(this.incrementingField);
        }
        da.table(this.tableName);
        da.cols(this.columns);
        da.where(this.primaryKey,"=",id,true);
        var self = this;
        return new Promise(function(resolve,reject) {
            da.fetch().then(function(result: SQLResult) {
                if(result.success && result.rows.length > 0) {
                    self.original = result.rows[0];
                    self.isNew = false;
                    resolve(self);
                } else {
                    reject(null);
                }                
            });
        });            
    }

    public loadData(data: object) {
        for(var key in data) {
            if(Object.keys(this.original).indexOf(key) > -1) {
                this.original[key] = data[key];
            }
        }
        this.isNew = false;
        return this;
    }

    public all():iSQL {
        var da = dataFactory.create(this.sqlConfig);
        if(this.incrementingField) {
            da.setIncrementingField(this.incrementingField);
        }
        da.toModel(this.constructor);
        da.table(this.tableName);
        da.cols(this.columns);
        return da;
    }

    public setSelectColumns(columns: string[]): any {
        if(columns.indexOf(this.primaryKey) == -1) {
            columns.push(this.primaryKey);
        }
        var self = this;
        var selectColumns: string[] = [];
        columns.forEach((col)=>{
            if(Object.keys(self.original).indexOf(col) > -1) {
                selectColumns.push(self.tableName + "." + col);
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
            this.updateColumn(key,values[key]);
        }
    }

    public getColumns() : object {
        var values = {};
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
            if(this.relations[key] instanceof ModelCollection) {
                base[key] = [];
                this.relations[key].getModels().forEach((related)=>{
                    base[key].push(related.toJSON());
                });
            } else {
                base[key] = this.relations[key].toJSON();
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
        var self = this;
        return new Promise(function(resolve,reject) {
            var da:iSQL = dataFactory.create(self.sqlConfig);
            if(self.incrementingField) {
                da.setIncrementingField(self.incrementingField);
            }
            da.table(self.tableName);
            var updateObj = {};
            for(var key in self.changed) {
                updateObj[key] = self.changed[key];
            }
            if(!self.isNew) {
                da.update(updateObj,true);
                da.where(self.primaryKey,"=",self.original[self.primaryKey],true);
            } else {
                da.insert(updateObj,true);
            }
            da.save().then(function(result) {
                if(result.rows_affected > 0) {
                    if(self.isNew) {
                        if(result.insert_id > 0) {
                            self.original[self.primaryKey] = result.insert_id;
                        }
                        self.isNew = false;
                    }
                    for(var key in self.changed) {
                        self.original[key] = self.changed[key];
                    }
                }                
                resolve(result.rows_affected > 0);
            }).catch((err)=>{
                reject(err);
            });
            
        });
    }

    public delete(): Promise<boolean> {
        var self = this;
        return new Promise(function(resolve,reject) {
            if(self.isNew) {
                return reject("record doesn't exist");
            }
            var da:iSQL = dataFactory.create(self.sqlConfig);
            if(self.incrementingField) {
                da.setIncrementingField(self.incrementingField);
            }
            da.table(self.tableName);
            da.where(self.primaryKey,"=",self.original[self.primaryKey],true);
            da.delete().then(function(result) {           
                resolve(result.rows_affected > 0);
            }).catch((err)=>{
                reject(err);
            });
            
        });
    }

    public belongsTo(modelFunc: CallableFunction, foreignKey: string) {
        return new BelongsTo(this,modelFunc,foreignKey);
    }
    
    public hasOne(modelFunc: CallableFunction, foreignKey: string) {
        return new HasOne(this,modelFunc,foreignKey);
    }
    
    public hasMany(modelFunc: CallableFunction, foreignKey: string) {
        return new HasMany(this,modelFunc,foreignKey);
    }
    
    public belongsToMany(modelFunc: CallableFunction, linkTable: string, primaryForeignKey: string, secondaryForeignKey: string) {
        return new BelongsToMany(this,modelFunc,linkTable,primaryForeignKey,secondaryForeignKey);
    }

    public setRelation(relationName: string, models: ModelCollection) {
        if(typeof this[relationName] !== "undefined") {
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

    public addAdditionalColumn(field,value) {
        this.additionalColumns[field] = value;
    }

    public eagerLoad(relations:Map<string, (q: iSQL)=>iSQL>) {
        var collection = new ModelCollection;
        collection.add(this);
        return collection.eagerLoad(relations);
        
    }
}