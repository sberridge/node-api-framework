import * as pg from 'pg';
import {iSQL} from "./interface/SQLInterface";
import {SQLOrder} from "./interface/SQLOrder";
import {Query} from"./Query";
import {ModelCollection} from './../../modelling/ModelCollection';
import {WeightedCondition} from './../sql/WeightedCondition';
import { SQLResult } from "./../sql/SQLResult";
import { BaseModel } from "./../../modelling/BaseModel";
import { comparison, pagination } from "./interface/SQLTypes";
import { ConnectionConfig } from './interface/SQLConnectionConfig';

const  QueryStream = require('pg-query-stream');


export class PostgresData implements iSQL {
    private tableName : string;
    private selectColumns : string[];
    private additionalColumns: string[] = [];
    private subStatement : PostgresData;
    private tableAlias : string;
    private weightedConditions:WeightedCondition[] = [];
    private joins: object[] = [];
    private static pools : Map<string, pg.Pool> = new Map;
    private params : any[];
    private insertValues : object;
    private multiInsertValues : object[];
    private updateValues : object;
    private offsetAmount : number;
    private limitAmount : number;
    private query = new Query(true);
    private usedConfig : ConnectionConfig;
    private modelFunc: new (...args: any[]) => BaseModel;
    private ordering: SQLOrder[] = [];
    private groupFields: string[];
    private incrementingField: string;

    constructor(connectionConfig : ConnectionConfig) {
        this.usedConfig = connectionConfig;      
        this.query.setParamSymbol("$");
        this.query.setPrefix("");
        this.query.increaseParamNum(1);
    }

    private connect(): pg.Pool {
        if(!PostgresData.pools.has(this.usedConfig.name)) {
            
            let config:pg.PoolConfig = {
                host: this.usedConfig.host,
                user: this.usedConfig.user,
                password: this.usedConfig.password,
                database: this.usedConfig.database
            };
            if("port" in this.usedConfig) {
                config.port = this.usedConfig.port;
            }
            PostgresData.pools.set(this.usedConfig['name'], new pg.Pool(config));
        }
        
        return PostgresData.pools.get(this.usedConfig['name']);
    }

    public newQuery():PostgresData {
        return new PostgresData(this.usedConfig);
    }

    public checkConnection():Promise<boolean> {
        return new Promise((resolve,reject)=>{
            this.connect().connect((err,client,done)=>{
                if(err) {
                    return reject();
                }
                done();
                return resolve(true);
            })
        });
        
    }

    public async doesTableExist(table:string):Promise<boolean> {
        return new Promise((resolve,reject)=> {
            var db = new PostgresData(this.usedConfig);
            db.table("information_schema.TABLES");
            db.cols(['COUNT(*) num']);
            db.where("table_catalog","=",this.usedConfig['database'],true);
            db.where("table_name","=",table,true);
            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });

    }
    public async doesColumnExist(table:string,column:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new PostgresData(this.usedConfig);
            db.table("information_schema.columns");
            db.cols(['COUNT(*) num']);
            db.where("table_catalog","=",this.usedConfig['database'],true);
            db.where("table_name","=",table,true);
            db.where("column_name","=",column,true);

            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        })

    }

    public async doesTriggerExist(triggerName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new PostgresData(this.usedConfig);
            db.table("information_schema.triggers");
            db.cols(['COUNT(*) num']);
            db.where("tigger_catalog","=",this.usedConfig['database'],true);
            db.where("trigger_name","=",triggerName,true);
            db.fetch().then((res)=>{
                resolve(res[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });
    }
    
    public async doesStoredProcedureExist(procedureName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new PostgresData(this.usedConfig);
            db.table("information_schema.routines");
            db.cols(['COUNT(*) num']);
            db.where("routine_catalog","=",this.usedConfig['database'],true);
            db.where("routine_name","=",procedureName,true);
            db.fetch().then((res)=>{
                resolve(res[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });
    }

    public raw(query:string,params:any): Promise<SQLResult> {
        this.params = [];
        if(typeof params !== "undefined") {
            if(Array.isArray(params)){
                params.forEach((param)=>{
                    this.params.push(param);
                });
            } else {
                throw new Error("Must pass an array containing param values when running MSSQL query");
            }
        }
        return this.execute(query);

    }

    public closePool(key:string):Promise<void> {
        return new Promise((resolve,reject)=>{
            if(PostgresData.pools.has(key)) {
                PostgresData.pools.get(key).end(function() {
                    PostgresData.pools.delete(key);
                    resolve();
                });
            } else {
                resolve();
            }            
        });        
    }

    public closePools():Promise<void> {
        return new Promise((resolve,reject)=>{
            var promises = [];
            for(let key of PostgresData.pools.keys()) {
                promises.push(this.closePool(key));
            }
            Promise.all(promises).then(()=>{
                resolve();
            });
        })
        
    }

    public toModel(model: any) : PostgresData {
        this.modelFunc = model;
        return this;
    }

    
    public table(tableName : PostgresData, tableAlias : string) : PostgresData
    public table(tableName : string) : PostgresData
    public table(tableName : any, tableAlias? : string) : PostgresData {
        if(typeof tableName == "object") {
            this.subStatement = tableName
            this.tableAlias = this.checkReserved(tableAlias);
        } else {
            this.tableName = this.checkReserved(tableName);
        }            
        return this;
    }

    public getParams() {
        return this.params;
    }
    public getParamNames() {
        return [];
    }

    public increaseParamNum(num: number) {
        this.query.increaseParamNum(num);
    }

    public getParamNum(): number {
        return this.query.getParamNum();
    }

    public setIncrementingField(field: string): PostgresData {
        this.incrementingField = this.checkReserved(field);
        return this;
    }

    public cols(selectColumns : string[]) : PostgresData {
        var self = this;
        this.selectColumns = selectColumns.map(function(col) {
            return self.checkReserved(col);
        });            
        return this;
    }

    public addCol(column:string) : PostgresData {
        this.selectColumns.push(this.checkReserved(column));
        var colSplit = column.split(/ |\./);
        this.additionalColumns.push(colSplit[colSplit.length-1]);
        return this;
    }
    
    public removeCol(column:string) : PostgresData {
        var col = this.checkReserved(column);
        if(this.selectColumns.indexOf(col) > -1) {
            this.selectColumns.splice(this.selectColumns.indexOf(col),1);
        }
        return this;
    }
    
    public removeCols(columns:string[]) : PostgresData {
        columns.forEach((column)=>this.removeCol(column));
        return this;
    }
    
    public keepCols(columns:string[]) : PostgresData {
        columns = columns.map((col)=>this.checkReserved(col));
        this.selectColumns = this.selectColumns.filter((column)=>{
            return columns.includes(column);
        });
        return this;
    }

    public checkReserved(value : string) : string {
        var reservedWords = [
            'select',
            'insert',
            'delete',
            'update',
            'where',
            'table',
            'join',
            'order',
            'read',
            'check'
        ];
        if(value.indexOf('.') > -1) {
            var valueParts = value.split('.');
            value = valueParts.map(function(value,index) {
                if(reservedWords.indexOf(value.toLowerCase()) > -1) {
                    return '"' + value + '"';
                }
                return value;
            }).join('.');
        } else {
            if(reservedWords.indexOf(value.toLowerCase()) > -1) {
                value = '"' + value + '"';
            }
        }
        return value;
    }
    
    public where(field : string, comparator : comparison, value : any, escape : boolean = true) : PostgresData {
        if(!escape) {
            value = this.checkReserved(value);
        }
        this.query.where(this.checkReserved(field),comparator,value,escape);
        return this;
    }
    
    public whereNull(field : string) : PostgresData {
        this.query.whereNull(this.checkReserved(field));
        return this;
    }
    
    public whereNotNull(field : string) : PostgresData {
        this.query.whereNotNull(this.checkReserved(field));
        return this;
    }
    
    public whereIn(field : string, subQuery : PostgresData) : PostgresData
    public whereIn(field : string, values : any[], escape : boolean) : PostgresData
    public whereIn(field : string, values : any, escape : boolean = true) : PostgresData {
        var self = this;
        if(Array.isArray(values) && !escape) {
            values = values.map(function(val) {
                return self.checkReserved(val);
            });
        }
        this.query.whereIn(field,values,escape);
        return this;
    }

    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : PostgresData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : PostgresData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: any, nonMatchWeight:any, escape : boolean = true) : PostgresData {
        if(!escape) {
            value = this.checkReserved(value);
        }
        var weightedQuery = new Query(false);
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        this.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }
    
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: any, nonMatchWeight:any, escape : boolean = true) : WeightedCondition {
        if(!escape) {
            value = this.checkReserved(value);
        }
        var weightedQuery = new Query(false);
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        return new WeightedCondition(weightedQuery,weight,nonMatchWeight);
    }
    
    public or() : PostgresData {
        this.query.or();
        return this;
    }
    
    public and() : PostgresData {
        this.query.and();
        return this;
    }
    
    public openBracket() : PostgresData {
        this.query.openBracket();
        return this;
    }
    
    public closeBracket() : PostgresData {
        this.query.closeBracket();
        return this;
    }

    public generateConditional(ifThis:string,thenVal:string,elseVal:string):string {
        return "CASE WHEN " + ifThis + ' THEN ' + thenVal + ' ELSE ' + elseVal + " END";
    }

    public generateSelect() : string {
        var params = [];
        var query = "SELECT ";       

        if(this.weightedConditions.length > 0) {
            var weightedConditionQueries = this.weightedConditions.map((condition:WeightedCondition)=>{
                return condition.applyCondition(this,params,[]);
            });
            this.selectColumns.push(weightedConditionQueries.join(' + ') + ' __condition_weight__');
            this.ordering.unshift({
                'field': '__condition_weight__',
                'direction': "desc"
            });
        }

        query += this.selectColumns.join(",");

        query += " FROM ";

        if(typeof this.subStatement != "undefined") {
            let startParamNum = this.subStatement.getParamNum();
            query += "(" + this.subStatement.generateSelect() + ") " + this.tableAlias + " ";
            let diff = this.subStatement.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
            this.subStatement.getParams().forEach(function(param) {
                params.push(param);
            });
        } else {
            query += " " + this.tableName + " ";
        }

        this.joins.forEach((join : any)=>{
            let joinDetails = join.func(...join.args);
            joinDetails.params.forEach(function(param) {
                params.push(param);
            });
            joinDetails.query.increaseParamNum(this.getParamNum()-1);
            let startParamNum = joinDetails.query.getParamNum();
            query += " " + joinDetails.type + " " + " " + joinDetails.table + " ON " + (joinDetails.query.applyWheres(params,[]));
            let diff = joinDetails.query.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        });
        if(this.query.getWheres().length > 0) {
            query += " WHERE " + (this.query.applyWheres(params,[])) + " ";
        }                
        this.params = params;

        if(typeof this.groupFields != "undefined" && this.groupFields.length > 0) {
            query += " GROUP BY " + this.groupFields.join(",");
        }

        if(this.ordering.length > 0) {
            query += " ORDER BY ";
            var orders = this.ordering.map((val)=>{
                return this.checkReserved(val['field']) + " " + val["direction"];
            });
            query += orders.join(",");
        }        

        if(typeof this.limitAmount != "undefined") {
            query += " LIMIT " + this.limitAmount + " ";
        }

        if(typeof this.offsetAmount != "undefined") {
            query += " OFFSET " + this.offsetAmount + " ";
        }

        return query;
    }

    public fetch(): Promise<SQLResult> {
        var self = this;
        return new Promise(function(resolve,reject) {
            self.execute(self.generateSelect()).then(function(results) {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });            
    }

    private resultToModel(result:object):BaseModel {
        var model:BaseModel = new this.modelFunc();
        if(!model.getSqlConfig()) {
            model.setSqlConfig(this.usedConfig["name"]);
        }
        this.additionalColumns.forEach((field)=>{
            if(field in result) {
                model.addAdditionalColumn(field,result[field]);
            }                        
        });
        model.setVisibleColumns(Object.keys(result));
        model.loadData(result);
        return model;
    }

    public fetchModels(): Promise<ModelCollection> {
        var self = this;
        return new Promise(function(resolve,reject) {
            self.execute(self.generateSelect()).then(function(results: SQLResult) {
                var modelCollection = new ModelCollection;
                results.rows.forEach((result)=>{
                    let model:BaseModel = self.resultToModel(result);
                    modelCollection.add(model);
                });
                resolve(modelCollection);
            }).catch(err=>{
                reject(err);
            });
        }); 
    }

    public streamModels(num: number, callback: (models:ModelCollection)=>Promise<void>): Promise<void> {
        var self = this;
        return new Promise((resolve,reject)=>{
            self.stream(num, async function(results) {
                var modelCollection = new ModelCollection;
                results.forEach((result)=>{
                    var model = self.resultToModel(result);
                    modelCollection.add(model);
                });
                await callback(modelCollection);
            }).then(()=>{
                resolve();
            }).catch(err=>{
                reject(err);
            });
        });
        
    }

    public stream(num : number, callback : (results:any[])=>Promise<void>): Promise<void> {
        var self = this;
        return new Promise(function(resolve,reject) {
            self.connect().connect(function(err,connection) {
                var results = [];
                const query = new QueryStream(self.generateSelect(), self.params);
                const stream = connection.query(query);
                stream.on("data",async (data)=>{
                    results.push(data);
                    if(results.length >= num) {
                        stream.pause();
                        await callback(results);
                        results = [];
                        stream.resume();
                    }
                })
                .on("end",async ()=>{
                    if(results.length > 0) {
                        await callback(results);
                    }
                    connection.release();
                    resolve();
                })                
            });
        });
        
    }
    public insert(columnValues : object[], escape : boolean) : PostgresData
    public insert(columnValues : object, escape : boolean) : PostgresData
    public insert(columnValues : any, escape : boolean = true) : PostgresData {            
        var params = [];
        var paramNames = [];
        if(Array.isArray(columnValues)) {
            var multiInsertValues = [];
            columnValues.forEach((insertRecord:object)=>{
                if(escape) {
                    for(var key in insertRecord) {
                        var num = params.push(insertRecord[key]);
                        var name = num.toString();
                        insertRecord[key] = "$" + name;
                        paramNames.push(name);
                    }
                }
                multiInsertValues.push(insertRecord);
            });
            this.multiInsertValues = multiInsertValues;
            
        } else {
            if(escape) {
                for(var key in columnValues) {
                    var num = params.push(columnValues[key]);
                    var name = num.toString();
                    columnValues[key] = "$" + name;
                }
            }
            this.insertValues = columnValues;
        }
        this.params = params;
        
        return this;
    }
    
    public update(columnValues : object, escape : boolean = true) : PostgresData {
        var params = [];
        if(escape) {
            for(var key in columnValues) {
                var num = params.push(columnValues[key]);
                var name = num.toString();
                columnValues[key] = "$" + name;
            }
            this.query.increaseParamNum(params.length);
        }
        this.params = params;
        this.updateValues = columnValues;
        return this;
    } 

    public generateInsert() : string {
        var self = this;
        var query = "INSERT INTO " + this.tableName + " (";
        var columns = [];
        if(typeof this.multiInsertValues == "undefined") {
            columns = Object.keys(this.insertValues).map(function(val) {
                return self.checkReserved(val);
            });
        } else {
            columns = Object.keys(this.multiInsertValues[0]).map(function(val) {
                return self.checkReserved(val);
            });
        }

        query += columns.join(",") + ") VALUES ";

        if(typeof this.multiInsertValues == "undefined") {
            query += "(" + Object.values(this.insertValues).join(",") + ")";
        } else {
            query += this.multiInsertValues.map((insertRow:object)=>{
                return "(" + Object.values(insertRow).join(",") + ")";
            }).join(',');            
        }
        if(this.incrementingField) {
            query += " returning " + this.incrementingField;
        }
        return query;
    }

    public generateUpdate() : string {
        var query = "UPDATE " + this.tableName + " SET ";
        for(var key in this.updateValues) {
            query += " " + this.checkReserved(key) + " = " + this.updateValues[key] + ", ";
        }
        query = (query.substring(0,query.length - 2)) + " ";

        if(this.query.getWheres().length > 0) {
            query += " WHERE " + (this.query.applyWheres(this.params,[])) + " ";
        }

        return query;
    }
    
    public save() : Promise<SQLResult> {
        var query : string;
        if(typeof this.updateValues != "undefined") {
            query = this.generateUpdate();
        } else if(typeof this.insertValues != "undefined") {
            query = this.generateInsert();
        } else if(typeof this.multiInsertValues != "undefined") {
            query = this.generateInsert();
            
        } else {
            throw "No update or insert parameters set";
        }
        var self = this;
        return new Promise(function(resolve,reject) {
            self.execute(query).then(function(results) {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public generateDelete() : string {
        var query = "DELETE FROM " + this.tableName + " ";
        this.params = [];
        if(this.query.getWheres().length > 0) {
            query += " WHERE " + (this.query.applyWheres(this.params,[])) + " ";
        }
        return query;
    }

    public delete(): Promise<SQLResult> {
        var query = this.generateDelete();
        var self = this;
        return new Promise(function(resolve,reject) {
            self.execute(query).then(function(results) {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public execute(query : string): Promise<SQLResult> {
        var self = this;
        return new Promise((resolve,reject)=>{
            self.connect().connect(async (err,connection)=>{
                if(err) {
                    reject(err);
                } else {
                    connection.query(query,self.params,(error,results)=>{
                        let result = new SQLResult();
                        connection.release();
                        if(error !== null) {
                            result.error = error;
                            result.success = false;
                            return reject(error);
                        }
                        result.success = true;
                        if(results.command == "INSERT") {
                            result.rows_affected = results.rowCount;
                            result.rows_changed = results.rowCount;
                            if(this.incrementingField) {
                                result.insert_id = results.rows[0][results.fields[0].name]
                            }
                        } else if(["UPDATE", "DELETE"].includes(results.command)) {
                            result.rows_affected = results.rowCount;
                            result.rows_changed = results.rowCount;
                        } else {
                            result.rows = results.rows;
                        }
                        return resolve(result);
                    });   
                }                                 
            });
            
        });
    }

    public limit(limitAmount: number) : PostgresData {
        this.limitAmount = limitAmount;
        return this;
    }
    
    public offset(offsetAmount: number) : PostgresData {
        this.offsetAmount = offsetAmount;
        return this;
    }

    private addJoin(type: string, table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null):void {
        this.joins.push({
            func: (type: string, table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) => {
                var tableName = "";
                var primaryKey: string | ((q:Query)=>Query);
                var foreignKey: string;
                var params = [];
                if(typeof table == "string") {
                    tableName = table;
                    primaryKey = arg2;
                    foreignKey = <string>arg3;
                } else {
                    table.increaseParamNum(this.getParamNum()-1);
                    let startParamNum = table.getParamNum();
                    tableName = "(" + table.generateSelect() + ") " + arg2 + " ";
                    let paramDif = table.getParamNum() - startParamNum;
                    this.increaseParamNum(paramDif);
                    primaryKey = arg3;
                    foreignKey = arg4;
                    params = table.getParams();
                }
                var query = new Query(true);
                query.setParamSymbol("$");
                query.setPrefix("");
                query.increaseParamNum(1);
                if(typeof primaryKey != "string") {
                    primaryKey(query);
                } else {
                    query.on(primaryKey,"=",foreignKey);            
                }
                return {
                    type: type,
                    table: tableName,
                    query: query,
                    params: params
                };
            },
            args: [
                type,
                table,
                arg2,
                arg3,
                arg4
            ]
        })
    }

    public join(tableName : PostgresData, tableAlias : string, queryFunc : (q: Query) => Query) : PostgresData
    public join(tableName : PostgresData, tableAlias : string, primaryKey : string, foreignKey : string) : PostgresData
    public join(tableName : string, queryFunc : (q: Query) => Query) : PostgresData
    public join(tableName : string, primaryKey : string, foreignKey : string) : PostgresData
    public join(table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) : PostgresData {
        this.addJoin("JOIN", table, arg2, arg3, arg4);
        return this;
    }
    
    public leftJoin(tableName : PostgresData, tableAlias : string, queryFunc : (q: Query) => Query) : PostgresData
    public leftJoin(tableName : PostgresData, tableAlias : string, primaryKey : string, foreignKey : string) : PostgresData
    public leftJoin(tableName : string, queryFunc : (q: Query) => Query) : PostgresData
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : PostgresData
    public leftJoin(table : any, arg2 : any, arg3 : any = null, arg4 : any = null) : PostgresData {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4);        
        return this;
    }

    public count(): Promise<number> {
        var sql = new PostgresData(this.usedConfig);
        sql.table(this,"count_sql");
        sql.cols(["COUNT(*) num"]);
        return new Promise(function(resolve,reject) {
            sql.fetch().then(function(result) {
                var num = result.rows[0]['num'];
                resolve(num);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public paginate(perPage: number, page: number): Promise<pagination> {
        var self = this;
        return new Promise((resolve,reject)=>{
            self.count().then((num)=>{
                self.limit(perPage);
                self.offset(perPage*(page-1));
                resolve({
                    total_rows: num
                })
            }).catch(err=> {
                reject(err);
            });
        });
        
        
        
    }
    
    public order(field:string,direction:SQLOrder.Direction):PostgresData {
        this.ordering.push({
            field: field,
            direction: direction
        });
        return this;
    }

    public group(groupFields:string[]):PostgresData {
        this.groupFields = groupFields.map(this.checkReserved);
        return this;
    }



}