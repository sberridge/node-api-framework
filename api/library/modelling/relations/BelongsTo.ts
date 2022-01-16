var dataFactory = require('./../../data-access/factory');
import {iRelation} from './interface/RelationInterface';
import {iSQL} from '../../data-access/sql/interface/SQLInterface';
import {BaseModel} from '../BaseModel';
import {Query} from './../../data-access/sql/Query';
import { ModelCollection } from '../ModelCollection';
import { SQLResult } from './../../data-access/sql/SQLResult';

export class BelongsTo implements iRelation {
    private primaryModel: BaseModel;
    private foreignModel: BaseModel;
    private foreignKey: string;
    private query: iSQL;
    public returnsMany: boolean = false;

    constructor(primaryModel: any, foreignFunc: any, foreignKey: string) {
        this.primaryModel = primaryModel;
        this.foreignModel = new foreignFunc();
        this.foreignKey = foreignKey;
        this.query = this.generateQuery();
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
        var daQuery: iSQL = dataFactory.create(this.primaryModel.getSqlConfig());
        daQuery.toModel(this.foreignModel.constructor)
        var self = this;
        daQuery.table(this.primaryModel.getTable() + " __primary__");
        var selectCols = ["__primary__." + this.primaryModel.getPrimaryKey() + " __table_" + this.primaryModel.getTable() + "__key"];
        this.foreignModel.getSelectColumns().forEach((col)=>{
            selectCols.push(col);
        });
        daQuery.cols(selectCols);

        daQuery.join(this.foreignModel.getTable(), (query: Query)=>{
            query.on("__primary__." + self.foreignKey, "=", self.foreignModel.getTable() + "." + self.foreignModel.getPrimaryKey());
            return query;
        });
        return daQuery
    }

    public getResult(ids: any[]): Promise<object>
    public getResult(): Promise<BaseModel>
    public getResult(ids: any = null): Promise<any> {
        return new Promise((resolve,reject)=>{
            var daQuery = this.query;
            if(ids !== null) {
                daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
                daQuery.fetch().then((results: SQLResult)=>{
                    var groupedResults = {};
                    var modelConstructor: any = this.foreignModel.constructor;
                    results.rows.forEach(result=>{
                        if(!(result["__table_" + this.primaryModel.getTable() + "__key"] in groupedResults)) {
                            var resModel: BaseModel = new modelConstructor();
                            if(!resModel.getSqlConfig()) {
                                resModel.setSqlConfig(this.primaryModel.getSqlConfig());
                            }
                            resModel.loadData(result);
                            resModel.setVisibleColumns(Object.keys(result));
                            groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]] = resModel;
                        }
                    });
                    resolve(results);
                });
            } else {
                daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
                daQuery.fetchModels().then((results: ModelCollection)=>{
                    var model = results.first();
                    resolve(model);
                });
            }            
            
        });            
    }

    public getResults(ids: any[]): Promise<object>
    public getResults(): Promise<ModelCollection>
    public getResults(ids: any = null): Promise<any> {
        return new Promise((resolve,reject)=>{
            var daQuery = this.query;
            if(ids !== null) {
                daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
                daQuery.fetch().then((results: SQLResult)=>{
                    var groupedResults = {};
                    var modelConstructor: any = this.foreignModel.constructor;
                    results.rows.forEach(result=>{
                        if(!(result["__table_" + this.primaryModel.getTable() + "__key"] in groupedResults)) {
                            groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]] = new ModelCollection;
                        }
                        var resModel: BaseModel = new modelConstructor();
                        if(!resModel.getSqlConfig()) {
                            resModel.setSqlConfig(this.primaryModel.getSqlConfig());
                        }
                        resModel.loadData(result);
                        resModel.setVisibleColumns(Object.keys(result));
                        groupedResults[result["__table_" + this.primaryModel.getTable() + "__key"]].add(resModel);
                    });

                    resolve(groupedResults);
                });
            } else {
                daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
                daQuery.fetchModels().then((results: ModelCollection)=>{
                    resolve(results);
                });
            }            
            
        });            
    }

}
