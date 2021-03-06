import * as pg from 'pg';
import iSQL from "./interface/SQLInterface";
import {SQLOrder} from "./interface/SQLOrder";
import Query from"./Query";
import ModelCollection from './../../modelling/ModelCollection';
import WeightedCondition from './../sql/WeightedCondition';
import SQLResult from "./../sql/SQLResult";
import BaseModel from "./../../modelling/BaseModel";
import { comparison, pagination } from "./interface/SQLTypes";
import ConnectionConfig from './interface/SQLConnectionConfig';

const  QueryStream = require('pg-query-stream');


export default class PostgresData implements iSQL {
    private tableName? : string;
    private selectColumns : string[] = [];
    private additionalColumns: string[] = [];
    private subStatement? : PostgresData;
    private tableAlias? : string;
    private weightedConditions:WeightedCondition[] = [];
    private joins: object[] = [];
    private static pools : Map<string, pg.Pool> = new Map;
    private params : any[] = [];
    private insertValues? : {[key:string]:any};
    private multiInsertValues? : {[key:string]:any}[];
    private updateValues? : {[key:string]:any};
    private offsetAmount? : number;
    private limitAmount? : number;
    private query = new Query(true);
    private usedConfig : ConnectionConfig;
    private modelFunc?: new (...args: any[]) => BaseModel;
    private ordering: SQLOrder[] = [];
    private groupFields?: string[];
    private incrementingField?: string;

    constructor(connectionConfig : ConnectionConfig) {
        this.usedConfig = connectionConfig;      
        this.query.setParamSymbol("$");
        this.query.setPrefix("");
        this.query.increaseParamNum(1);
    }

    private connect(): pg.Pool | undefined {
        if(!this.usedConfig.name) {
            return undefined;
        }
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
            const connection = this.connect();
            if(!connection) {
                return reject();
            }
            connection.connect((err,client,done)=>{
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
                if(res.rows.length > 0) {
                    const result = res.rows[0] as {"num":number};
                    return resolve(result.num > 0);
                }
                resolve(false);
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
                if(res.rows.length > 0) {
                    const result = res.rows[0] as {"num":number};
                    return resolve(result.num > 0);
                }
                resolve(false);
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
                if(res.rows.length > 0) {
                    const result = res.rows[0] as {"num":number};
                    return resolve(result.num > 0);
                }
                resolve(false);
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
                if(res.rows.length > 0) {
                    const result = res.rows[0] as {"num":number};
                    return resolve(result.num > 0);
                }
                resolve(false);
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
                const connection = PostgresData.pools.get(key);
                if(!connection) {
                    return resolve();
                }
                connection.end(function() {
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
    public table(tableName : string | PostgresData, tableAlias? : string) : PostgresData {
        if(tableName instanceof PostgresData && tableAlias) {
            this.subStatement = tableName
            this.tableAlias = this.checkReserved(tableAlias);
        } else if(typeof tableName == "string") {
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
        this.selectColumns = selectColumns.map(this.checkReserved);            
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
                    return `"${value}"`;
                }
                return value;
            }).join('.');
        } else {
            if(reservedWords.indexOf(value.toLowerCase()) > -1) {
                value = `"${value}"`;
            }
        }
        return value;
    }
    
    public where(field : string, comparator : comparison, value : any, escape : boolean = true) : PostgresData {
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
    public whereIn(field : string, values : any[] | PostgresData, escape : boolean = true) : PostgresData {
        if(Array.isArray(values)) {
            this.query.whereIn(this.checkReserved(field),values,escape);
        } else {
            this.query.whereIn(this.checkReserved(field),values);
        }        
        return this;
    }

    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : PostgresData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean = true) : PostgresData {
        var weightedQuery = new Query(true);
        weightedQuery.setParamSymbol("$");
        weightedQuery.setPrefix("");
        weightedQuery.increaseParamNum(1);
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        this.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }
    
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight:number | WeightedCondition, escape : boolean = true) : WeightedCondition {
        var weightedQuery = new Query(true);
        weightedQuery.setParamSymbol("$");
        weightedQuery.setPrefix("");
        weightedQuery.increaseParamNum(1);
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
        return `CASE WHEN ${ifThis} THEN ${thenVal} ELSE ${elseVal} END`;
    }

    private applyWeightedConditions() {
        let newParams:any[] = [];
        if(this.weightedConditions.length > 0) {
            var weightedConditionQueries = this.weightedConditions.map((condition:WeightedCondition)=>{
                condition.increaseParamNum(this.getParamNum() - 1);
                let startParamNum = condition.getParamNum();
                let query = condition.applyCondition(this, newParams, []);
                let diff = condition.getParamNum() - startParamNum;
                this.increaseParamNum(diff);
                return query;
            });
            this.selectColumns.push(`${weightedConditionQueries.join(' + ')} __condition_weight__`);
            this.ordering.unshift({
                'field': '__condition_weight__',
                'direction': "desc"
            });
        }
        return newParams;
    }

    private applySubStatement(): [string, any[]] {
        if(!this.subStatement) {
            return ["",[]]
        }
        let startParamNum = this.subStatement.getParamNum();
        let query = ` (${this.subStatement.generateSelect()}) ${this.tableAlias} `;
        let diff = this.subStatement.getParamNum() - startParamNum;
        this.increaseParamNum(diff);
        return [query, this.subStatement.getParams()];
    }

    private applyJoins(): [string, any[]] {
        let newParams:any[] = [];
        let joinStrings:string[] = [];
        this.joins.forEach((join : any)=>{
            let joinDetails = join.func(...join.args);
            joinDetails.params.forEach(function(param: any) {
                newParams.push(param);
            });
            joinDetails.query.increaseParamNum(this.getParamNum()-1);
            let startParamNum = joinDetails.query.getParamNum();
            joinStrings.push(` ${joinDetails.type}  ${joinDetails.table} ON ${(joinDetails.query.applyWheres(newParams,[]))} `);
            let diff = joinDetails.query.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        });
        return [joinStrings.join(" "), newParams];
    }

    public generateSelect() : string {
        var params = [];
        var query = "SELECT ";       

        params.push(...this.applyWeightedConditions())

        query += `${this.selectColumns.join(",")} FROM `;

        if(typeof this.subStatement != "undefined") {
            let [subQuery, subParams] = this.applySubStatement();
            query += subQuery;
            params.push(...subParams)
        } else {
            query += ` ${this.tableName} `;
        }

        const [joinString, joinParams] = this.applyJoins();
        query += joinString;
        params.push(...joinParams);
        
        if(this.query.getWheres().length > 0) {
            query += ` WHERE ${(this.query.applyWheres(params,[]))} `;
        }                
        this.params = params;

        if(typeof this.groupFields != "undefined" && this.groupFields.length > 0) {
            query += ` GROUP BY ${this.groupFields.join(",")} `;
        }

        if(this.ordering.length > 0) {
            query += " ORDER BY ";
            var orders = this.ordering.map((val)=>{
                return this.checkReserved(val['field']) + " " + val["direction"];
            });
            query += orders.join(",");
        }        

        if(typeof this.limitAmount != "undefined") {
            query += ` LIMIT ${this.limitAmount} `;
        }

        if(typeof this.offsetAmount != "undefined") {
            query += ` OFFSET ${this.offsetAmount} `;
        }
        
        return query;
    }

    public fetch(): Promise<SQLResult> {
        return new Promise((resolve,reject)=>{
            this.execute(this.generateSelect()).then((results) => {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });            
    }

    private resultToModel(result:{[key:string]:any}):BaseModel | null {
        if(!this.modelFunc || !this.usedConfig.name) {
            return null;
        }
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
        return new Promise((resolve,reject)=>{
            this.execute(this.generateSelect()).then((results: SQLResult)=>{
                var modelCollection = new ModelCollection;
                results.rows.forEach((result)=>{
                    let model = this.resultToModel(result);
                    if(model) {
                        modelCollection.add(model);
                    }                    
                });
                resolve(modelCollection);
            }).catch(err=>{
                reject(err);
            });
        }); 
    }

    public streamModels(num: number, callback: (models:ModelCollection)=>Promise<boolean>): Promise<void> {
        return new Promise((resolve,reject)=>{
            this.stream(num, async (results) => {
                var modelCollection = new ModelCollection;
                results.forEach((result)=>{
                    var model = this.resultToModel(result);
                    if(model) {
                        modelCollection.add(model);
                    }                    
                });
                return await callback(modelCollection);
            }).then(()=>{
                resolve();
            }).catch(err=>{
                reject(err);
            });
        });
        
    }

    public stream(num : number, callback : (results:any[])=>Promise<boolean>): Promise<void> {
        return new Promise((resolve,reject)=>{
            const connection = this.connect();
            if(!connection) {
                return reject();
            }
            connection.connect((err,connection) => {
                var results:any[] = [];
                const query = new QueryStream(this.generateSelect(), this.params);
                const stream = connection.query(query);
                stream.on("data",async (data:any)=>{
                    results.push(data);
                    if(results.length >= num) {
                        stream.pause();
                        const shouldContinue = await callback(results);
                        results = [];
                        if(!shouldContinue) {
                            stream.destroy();
                            stream.cursor.close();
                            connection.release();
                            resolve();
                        } else {
                            stream.resume();
                        }                        
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

    private multiInsert(columnValues: {[key:string]:any}[], escape: boolean) {
        var params:any[] = [];
        var multiInsertValues:any[] = [];
        columnValues.forEach((insertRecord:{[key:string]:any})=>{
            if(escape) {
                for(var key in insertRecord) {
                    var num = params.push(insertRecord[key]);
                    var name = num.toString();
                    insertRecord[key] = "$" + name;
                }
            }
            multiInsertValues.push(insertRecord);
        });
        this.multiInsertValues = multiInsertValues;
        this.params = params;
    }

    private singleInsert(columnValues: {[key:string]:any}, escape: boolean) {
        var params = [];
        if(escape) {
            for(var key in columnValues) {
                var num = params.push(columnValues[key]);
                var name = num.toString();
                columnValues[key] = "$" + name;
            }
        }
        this.insertValues = columnValues;
        this.params = params;
    }


    public insert(columnValues : {[key:string]:any}[], escape : boolean) : PostgresData
    public insert(columnValues : {[key:string]:any}, escape : boolean) : PostgresData
    public insert(columnValues : any, escape : boolean = true) : PostgresData {
        if(Array.isArray(columnValues)) {
            this.multiInsert(columnValues, escape);            
        } else {
            this.singleInsert(columnValues, escape);
        }        
        return this;
    }
    
    public update(columnValues : {[key:string]:any}, escape : boolean = true) : PostgresData {
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

    private generateMultiInsert(): string {
        if(!this.multiInsertValues) {
            return "";
        }
        const columns = Object.keys(this.multiInsertValues[0]).map(this.checkReserved);
        let query = columns.join(",") + ") VALUES ";
        query += this.multiInsertValues.map((insertRow:object)=>{
            return `(${Object.values(insertRow).join(",")})`;
        }).join(',');
        return query;
    }

    private generateSingleInsert(): string {
        if(!this.insertValues) {
            return "";
        }
        const columns = Object.keys(this.insertValues).map(this.checkReserved);
        let query = columns.join(",") + ") VALUES ";
        query += `(${Object.values(this.insertValues).join(",")})`;
        return query;
    }

    public generateInsert() : string {
        var query = `INSERT INTO ${this.tableName} (`;

        if(typeof this.multiInsertValues == "undefined") {
            query += this.generateSingleInsert();
        } else {
            query += this.generateMultiInsert();
        }

        if(this.incrementingField) {
            query += ` returning ${this.incrementingField}`;
        }
        return query;
    }

    public generateUpdate() : string {
        var query = "UPDATE " + this.tableName + " SET ";
        for(var key in this.updateValues) {
            query += ` ${this.checkReserved(key)} = ${this.updateValues[key]}, `;
        }
        query = (query.substring(0,query.length - 2)) + " ";

        if(this.query.getWheres().length > 0) {
            query += ` WHERE ${(this.query.applyWheres(this.params,[]))} `;
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
        return new Promise((resolve,reject) => {
            this.execute(query).then((results) => {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public generateDelete() : string {
        var query = `DELETE FROM ${this.tableName} `;
        this.params = [];
        if(this.query.getWheres().length > 0) {
            query += ` WHERE ${(this.query.applyWheres(this.params,[]))} `;
        }
        return query;
    }

    public delete(): Promise<SQLResult> {
        var query = this.generateDelete();
        return new Promise((resolve,reject) => {
            this.execute(query).then((results) => {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public execute(query : string): Promise<SQLResult> {
        return new Promise((resolve,reject)=>{
            const connection = this.connect();
            if(!connection) {
                return reject();
            }
            connection.connect(async (err,connection)=>{
                if(err) {
                    reject(err);
                } else {
                    connection.query(query,this.params,(error,results)=>{
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

    private addJoin(type: string, table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) | undefined = undefined, arg4 : string | undefined = undefined):void {
        this.joins.push({
            func: (type: string, table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) | undefined = undefined, arg4 : string | undefined = undefined) => {
                var tableName = "";
                var primaryKey: string | ((q:Query)=>Query) | undefined;
                var foreignKey: string | undefined;
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
                if(primaryKey && typeof primaryKey != "string") {
                    primaryKey(query);
                } else if(typeof primaryKey == "string") {
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
    public join(table : string | PostgresData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) | undefined = undefined, arg4 : string | undefined = undefined) : PostgresData {
        this.addJoin("JOIN", table, arg2, arg3, arg4);
        return this;
    }
    
    public leftJoin(tableName : PostgresData, tableAlias : string, queryFunc : (q: Query) => Query) : PostgresData
    public leftJoin(tableName : PostgresData, tableAlias : string, primaryKey : string, foreignKey : string) : PostgresData
    public leftJoin(tableName : string, queryFunc : (q: Query) => Query) : PostgresData
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : PostgresData
    public leftJoin(table : any, arg2 : any, arg3 : any | undefined = undefined, arg4 : any | undefined = undefined) : PostgresData {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4);        
        return this;
    }

    public count(): Promise<number> {
        var sql = new PostgresData(this.usedConfig);
        sql.table(this,"count_sql");
        sql.cols(["COUNT(*) num"]);
        return new Promise((resolve,reject) => {
            sql.fetch().then((result) => {
                if(result.rows.length > 0) {
                    const res = result.rows[0] as {num:number};
                    return resolve(res.num);
                }
                resolve(0);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public paginate(perPage: number, page: number): Promise<pagination> {
        return new Promise((resolve,reject)=>{
            this.count().then((num)=>{
                this.limit(perPage);
                this.offset(perPage*(page-1));
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