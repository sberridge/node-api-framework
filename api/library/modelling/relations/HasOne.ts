import iRelation from './interface/RelationInterface';
import iSQL from '../../data-access/sql/interface/SQLInterface';
import BaseModel from '../BaseModel';
import ModelCollection from '../ModelCollection';
import Query from './../../data-access/sql/Query';
import DataAccessFactory from './../../data-access/factory';
const dataFactory = DataAccessFactory.getInstance();

export default class HasOne implements iRelation {
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
            query.on("__primary__." + self.primaryModel.getPrimaryKey(), "=", self.foreignModel.getTable() + "." + self.foreignKey);
            return query;
        });
        return daQuery
    }

    private async getFilteredResult(ids:any[]) {
        let daQuery = this.query;
        daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
        let results = await daQuery.fetch();
        let groupedResults = {};
        let modelConstructor: any = this.foreignModel.constructor;
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
        return results;
    }

    private async getUnfilteredResult() {
        let daQuery = this.query;
        daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
        let results = await daQuery.fetchModels();
        var model = results.first();
        return model;            
    }

    public getResult(ids: any[]): Promise<object>
    public getResult(): Promise<BaseModel>
    public getResult(ids: any = null): Promise<any> {
        return new Promise(async (resolve,reject)=>{
            if(ids !== null) {
                resolve(await this.getFilteredResult(ids));
            } else {
                resolve(await this.getUnfilteredResult());
            }            
            
        });            
    }


    private async getFilteredResults(ids:any[]) {
        let daQuery = this.query;
        daQuery.whereIn("__primary__." + this.primaryModel.getPrimaryKey(),ids, true);
        let results = await daQuery.fetch();
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

        return groupedResults;
    }

    private async getUnfilteredResults() {
        let daQuery = this.query;
        daQuery.where("__primary__." + this.primaryModel.getPrimaryKey(),"=",this.primaryModel.getColumn(this.primaryModel.getPrimaryKey()), true);
        let results = await daQuery.fetchModels();
        return results;
    }

    public getResults(ids: any[]): Promise<object>
    public getResults(): Promise<ModelCollection>
    public getResults(ids: any = null): Promise<any> {
        return new Promise(async (resolve,reject)=>{
            var daQuery = this.query;
            if(ids !== null) {
                resolve(await this.getFilteredResults(ids));
            } else {
                resolve(await this.getUnfilteredResults());
            }            
            
        });            
    }



}
