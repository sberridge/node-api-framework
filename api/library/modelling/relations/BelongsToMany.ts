import iRelation from './interface/RelationInterface';
import iSQL from '../../data-access/sql/interface/SQLInterface';
import BaseModel from '../BaseModel';
import ModelCollection from '../ModelCollection';
import Query from './../../data-access/sql/Query';
import DataAccessFactory from './../../data-access/factory';
import SQLResult from './../../data-access/sql/SQLResult';
const dataFactory = DataAccessFactory.getInstance();

export default class BelongsToMany implements iRelation {
    private primaryModel: BaseModel;
    private foreignModel: BaseModel;
    private linkTable: string;
    private primaryForeignKey: string;
    private secondaryForeignKey: string;
    private query: iSQL;
    private linkColumns: string[] | undefined;
    public returnsMany: boolean = true;

    constructor(primaryModel: any, foreignFunc: any, linkTable: string, primaryForeignKey: string, secondaryForeignKey: string) {
        this.primaryModel = primaryModel;
        this.foreignModel = new foreignFunc();
        this.linkTable = linkTable;
        this.primaryForeignKey = primaryForeignKey;
        this.secondaryForeignKey = secondaryForeignKey;
        this.query = this.generateQuery();
    }

    public setLinkColumns(cols:string[]) {
        this.linkColumns = cols;
        cols.forEach((col)=>{
            this.query.addCol(col);
        });
    }

    public getQuery(applyWhere:boolean):iSQL
    public getQuery(): iSQL
    public getQuery(applyWhere:boolean = true): iSQL {
        if(applyWhere) {
            this.query.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
        }
        return this.query;
    }

    public generateQuery(): iSQL {
        var daQuery = dataFactory.create(this.primaryModel.getSqlConfig());
        if(!daQuery) {
            throw("No database found");
        }
        daQuery.toModel(this.foreignModel.constructor)
        var self = this;
        daQuery.table(this.primaryModel.getTable() + " __primary__");
        var selectCols = ["__primary__." + this.primaryModel.getPrimaryKey() + " __table_" + this.primaryModel.getTable() + "__key"];
        this.foreignModel.getSelectColumns().forEach((col)=>{
            selectCols.push(col);
        });
        daQuery.cols(selectCols);

        daQuery.join(this.linkTable,(query)=>{
            query.on("__primary__." + self.primaryModel.getPrimaryKey(),"="," " + self.linkTable + "." + self.primaryForeignKey);
            return query;
        });

        daQuery.join(this.foreignModel.getTable(), (query: Query)=>{
            query.on(self.linkTable + "." + self.secondaryForeignKey, "=", self.foreignModel.getTable() + "." + self.foreignModel.getPrimaryKey());
            return query;
        });
        return daQuery
    }

    private async getFilteredResult(ids:any[]) {
        let daQuery = this.query;
        daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
        let results = await daQuery.fetch();
        let groupedResults:{[key:string]:BaseModel} = {};
        let modelConstructor: any = this.foreignModel.constructor;
        results.rows.forEach(result=>{
            if(!(result["__table_" + this.primaryModel.getTable() + "__key"] in groupedResults)) {
                var resModel: BaseModel = new modelConstructor();
                if(!resModel.getSqlConfig()) {
                    resModel.setSqlConfig(this.primaryModel.getSqlConfig());
                }
                resModel.loadData(result);                            
                if(this.linkColumns && this.linkColumns.length > 0) {
                    this.linkColumns.forEach((col)=>{
                        if(col in result) {
                            resModel.addAdditionalColumn(col, result[col]);
                        }
                    });
                }
                resModel.setVisibleColumns(Object.keys(result));
                groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]] = resModel;
            }
        });
        return results;
    }
    private async getUnFilteredResult() {
        let daQuery = this.query;
        daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
        let results = await daQuery.fetchModels()
        let model = results.first();
        return model;
    }

    public getResult(ids: any[]): Promise<SQLResult>
    public getResult(): Promise<BaseModel>
    public getResult(ids: any = null): Promise<any> {
        return new Promise(async (resolve,reject)=>{
            if(ids !== null) {
                resolve(await this.getFilteredResult(ids));
            } else {
                resolve(await this.getUnFilteredResult());
            }            
            
        });            
    }

    private async getUnfilteredResults() {
        let daQuery = this.query;
        daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
        let results = await daQuery.fetchModels();
        return results;        
    }
    
    private async getFilteredResults(ids:any[]) {
        let daQuery = this.query;
        daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
        let results = await daQuery.fetch();
        let groupedResults:{[key:string]:ModelCollection} = {};
        let modelConstructor: any = this.foreignModel.constructor;
        results.rows.forEach(result=>{
            if(!(result["__table_" + this.primaryModel.getTable() + "__key"] in groupedResults)) {
                groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]] = new ModelCollection;
            }
            var resModel: BaseModel = new modelConstructor();
            if(!resModel.getSqlConfig()) {
                resModel.setSqlConfig(this.primaryModel.getSqlConfig());
            }
            resModel.loadData(result);
            if(this.linkColumns && this.linkColumns.length > 0) {
                this.linkColumns.forEach((col)=>{
                    if(col in result) {
                        resModel.addAdditionalColumn(col, result[col]);
                    }
                });
            }                        
            resModel.setVisibleColumns(Object.keys(result));
            groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]].add(resModel);
        });
        return groupedResults;
    }

    public getResults(ids: any[]): Promise<{[key:string]:ModelCollection}>
    public getResults(): Promise<ModelCollection>
    public getResults(ids: any = null): Promise<any> {
        return new Promise(async (resolve,reject)=>{
            if(ids !== null) {
                resolve(await this.getFilteredResults(ids));
            } else {
                resolve(await this.getUnfilteredResults());
            }            
            
        });            
    }

    public link(id:any) {
        return new Promise((resolve,reject)=>{
            var daQuery = dataFactory.create(this.primaryModel.getSqlConfig());
            if(!daQuery){
                throw("No database found");
            }
            daQuery.table(this.linkTable);
            var insert:{[key:string]:any} = {};
            insert[this.primaryForeignKey] = this.primaryModel.getColumn(this.primaryModel.getPrimaryKey());
            insert[this.secondaryForeignKey] = id;
            daQuery.insert(insert,true);
            daQuery.save().then(res=>{
                if(res.rows_affected > 0) {
                    resolve(res);
                } else {
                    reject();
                }
            }).catch(e=>{
                reject(e);
            });
        });

        
        
    }

    public unlink(id:any) {
        return new Promise((resolve,reject)=>{
            var daQuery = dataFactory.create(this.primaryModel.getSqlConfig());
            if(!daQuery) {
                throw("No database found");
            }
            daQuery.table(this.linkTable);
            daQuery.where(this.primaryForeignKey,"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()),true);
            daQuery.where(this.secondaryForeignKey,"=",id,true);
            daQuery.delete().then(res=>{
                if(res.rows_affected > 0) {
                    resolve(res);
                } else {
                    reject();
                }
            }).catch(e=>{
                reject(e);
            });
        })
    }
    
    public update(id:any,updateValues:{[key:string]:any}) {
        return new Promise((resolve,reject)=>{
            var daQuery = dataFactory.create(this.primaryModel.getSqlConfig());
            if(!daQuery) {
                throw("No database found");
            }
            daQuery.table(this.linkTable);
            daQuery.where(this.primaryForeignKey,"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()),true);
            daQuery.where(this.secondaryForeignKey,"=",id,true);
            var newUpdate:{[key:string]:any} = {};
            for(var key in updateValues) {
                if(this.linkColumns && this.linkColumns.indexOf(key) > -1) {
                    newUpdate[key] = updateValues[key];
                }
            }
            if(Object.keys(newUpdate).length > 0) {
                daQuery.update(newUpdate,true);
                daQuery.save().then(res=>{
                    if(res.rows_affected > 0) {
                        return resolve(res);
                    } else {
                        return reject();
                    }
                }).catch(e=>{
                    return reject(e);
                })
            }
        })
    }



}
