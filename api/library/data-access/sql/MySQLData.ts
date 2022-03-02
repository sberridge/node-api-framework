import * as mysql from 'mysql';
import {iSQL} from "./interface/SQLInterface";
import {SQLOrder} from "./interface/SQLOrder";
import {Query} from"./Query";
import {ModelCollection} from './../../modelling/ModelCollection';
import {WeightedCondition} from './../sql/WeightedCondition';
import { SQLResult } from "./../sql/SQLResult";
import { BaseModel } from "./../../modelling/BaseModel";
import { comparison, pagination } from "./interface/SQLTypes";
import { ConnectionConfig } from './interface/SQLConnectionConfig';


export class MySQLData implements iSQL {
    private tableName : string;
    private selectColumns : string[];
    private additionalColumns: string[] = [];
    private subStatement : MySQLData;
    private tableAlias : string;
    private weightedConditions:WeightedCondition[] = [];
    private joins: object[] = [];
    private static pools : Map<string, mysql.Pool> = new Map;
    private params : any[];
    private insertValues : object;
    private multiInsertValues : object[];
    private updateValues : object;
    private offsetAmount : number;
    private limitAmount : number;
    private query = new Query(false);
    private usedConfig : ConnectionConfig;
    private modelFunc: new (...args: any[]) => BaseModel;
    private ordering: SQLOrder[] = [];
    private groupFields: string[];

    constructor(connectionConfig : ConnectionConfig) {
        this.usedConfig = connectionConfig;      
    }

    private connect(): mysql.Pool {
        if(!MySQLData.pools.has(this.usedConfig.name)) {
            let config:mysql.PoolConfig = {
                connectionLimit: 100,
                host: this.usedConfig.host,
                user: this.usedConfig.user,
                password: this.usedConfig.password,
                database: this.usedConfig.database
            };
            if("port" in this.usedConfig) {
                config.port = this.usedConfig.port;
            }
            MySQLData.pools.set(this.usedConfig['name'], mysql.createPool(config));
        }
        
        return MySQLData.pools.get(this.usedConfig['name']);
    }

    public newQuery():MySQLData {
        return new MySQLData(this.usedConfig);
    }

    public checkConnection():Promise<boolean> {
        return new Promise((resolve,reject)=>{
            this.connect().getConnection((err,connection)=>{
                if(err) {
                    reject(err);
                } else {
                    connection.release();
                    resolve(true);
                }
            })
        });
        
    }

    public async doesTableExist(table:string):Promise<boolean> {
        return new Promise((resolve,reject)=> {
            var db = new MySQLData(this.usedConfig);
            db.table("information_schema.TABLES");
            db.cols(['COUNT(*) num']);
            db.where("TABLE_SCHEMA","=",this.usedConfig['database'],true);
            db.where("TABLE_NAME","=",table,true);
            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });

    }
    public async doesColumnExist(table:string,column:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MySQLData(this.usedConfig);
            db.table("information_schema.COLUMNS");
            db.cols(['COUNT(*) num']);
            db.where("TABLE_SCHEMA","=",this.usedConfig['database'],true);
            db.where("TABLE_NAME","=",table,true);
            db.where("COLUMN_NAME","=",column,true);

            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        })

    }

    public async doesTriggerExist(triggerName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MySQLData(this.usedConfig);
            db.table("information_schema.TRIGGERS");
            db.cols(['COUNT(*) num']);
            db.where("TRIGGER_SCHEMA","=",this.usedConfig['database'],true);
            db.where("TRIGGER_NAME","=",triggerName,true);
            db.fetch().then((res)=>{
                resolve(res[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });
    }
    
    public async doesStoredProcedureExist(procedureName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MySQLData(this.usedConfig);
            db.table("information_schema.ROUTINES");
            db.cols(['COUNT(*) num']);
            db.where("ROUTINE_SCHEMA","=",this.usedConfig['database'],true);
            db.where("ROUTINE_NAME","=",procedureName,true);
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
            if(MySQLData.pools.has(key)) {
                MySQLData.pools.get(key).end(function(err) {
                    MySQLData.pools.delete(key);
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
            for(let key of MySQLData.pools.keys()) {
                promises.push(this.closePool(key));
            }
            Promise.all(promises).then(()=>{
                resolve();
            });
        })
        
    }

    public toModel(model: any) : MySQLData {
        this.modelFunc = model;
        return this;
    }

    
    public table(tableName : MySQLData, tableAlias : string) : MySQLData
    public table(tableName : string) : MySQLData
    public table(tableName : string | MySQLData, tableAlias? : string) : MySQLData {
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

    public setIncrementingField(field: string): MySQLData {
        return this;
    }

    public cols(selectColumns : string[]) : MySQLData {
        this.selectColumns = selectColumns.map(this.checkReserved);       
        return this;
    }

    public addCol(column:string) : MySQLData {
        this.selectColumns.push(this.checkReserved(column));
        var colSplit = column.split(/ |\./);
        this.additionalColumns.push(colSplit[colSplit.length-1]);
        return this;
    }
    
    public removeCol(column:string) : MySQLData {
        var col = this.checkReserved(column);
        if(this.selectColumns.indexOf(col) > -1) {
            this.selectColumns.splice(this.selectColumns.indexOf(col),1);
        }
        return this;
    }
    
    public removeCols(columns:string[]) : MySQLData {
        columns.forEach((column)=>this.removeCol(column));
        return this;
    }
    
    public keepCols(columns:string[]) : MySQLData {
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
                    return '`' + value + '`';
                }
                return value;
            }).join('.');
        } else {
            if(reservedWords.indexOf(value.toLowerCase()) > -1) {
                value = '`' + value + '`';
            }
        }
        return value;
    }
    
    public where(field : string, comparator : comparison, value : any, escape : boolean = true) : MySQLData {
        this.query.where(this.checkReserved(field),comparator,value,escape);
        return this;
    }
    
    public whereNull(field : string) : MySQLData {
        this.query.whereNull(this.checkReserved(field));
        return this;
    }
    
    public whereNotNull(field : string) : MySQLData {
        this.query.whereNotNull(this.checkReserved(field));
        return this;
    }
    
    public whereIn(field : string, subQuery : MySQLData) : MySQLData
    public whereIn(field : string, values : any[], escape : boolean) : MySQLData
    public whereIn(field : string, values : MySQLData | any[], escape : boolean = true) : MySQLData {
        field = this.checkReserved(field);
        if(Array.isArray(values)) {
            this.query.whereIn(field,values,escape);                
        } else {
            this.query.whereIn(field,values);
        }        
        return this;
    }

    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : MySQLData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : MySQLData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight:any, escape : boolean = true) : MySQLData {
        var weightedQuery = new Query(false);
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        this.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }
    
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight:any, escape : boolean = true) : WeightedCondition {
        var weightedQuery = new Query(false);
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        return new WeightedCondition(weightedQuery,weight,nonMatchWeight);
    }
    
    public or() : MySQLData {
        this.query.or();
        return this;
    }
    
    public and() : MySQLData {
        this.query.and();
        return this;
    }
    
    public openBracket() : MySQLData {
        this.query.openBracket();
        return this;
    }
    
    public closeBracket() : MySQLData {
        this.query.closeBracket();
        return this;
    }

    public generateConditional(ifThis:string,thenVal:string,elseVal:string):string {
        return "if(" + ifThis + ', ' + thenVal + ', ' + elseVal + ")";
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
            query += "(" + this.subStatement.generateSelect() + ") " + this.tableAlias + " ";
            this.subStatement.getParams().forEach(function(param) {
                params.push(param);
            });
        } else {
            query += " " + this.tableName + " ";
        }

        this.joins.forEach(function(join : any) {
            join.params.forEach(function(param) {
                params.push(param);
            });
            query += " " + join.type + " " + " " + join.table + " ON " + (join.query.applyWheres(params,[]));
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
        return new Promise((resolve,reject)=>{
            this.execute(this.generateSelect()).then((results)=>{
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
        return new Promise((resolve,reject)=>{
            this.execute(this.generateSelect()).then((results: SQLResult)=>{
                var modelCollection = new ModelCollection;
                results.rows.forEach((result)=>{
                    let model:BaseModel = this.resultToModel(result);
                    modelCollection.add(model);
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
                    modelCollection.add(model);
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
        return new Promise((resolve,reject) => {
            this.connect().getConnection((err,connection) => {
                var results = [];
                connection.query(this.generateSelect(),this.params)
                    .on('error',function(err) {
                        reject(err);
                    })
                    .on('result',async (result) => {
                        results.push(result);
                        if(results.length >= num) {
                            connection.pause();
                            const shouldContinue = await callback(results);
                            results = [];
                            if(!shouldContinue) {
                                connection.destroy();
                                resolve();
                            } else {
                                connection.resume();
                            }
                        }
                    })
                    .on('end',async () => {
                        if(results.length > 0) {
                            await callback(results);
                        }
                        connection.release();
                        resolve();
                    });
                
            });
        });
        
    }
    private multiInsert(columnValues: object[], escape: boolean) {
        var params = [];
        var multiInsertValues = [];
        columnValues.forEach((insertRecord:object)=>{
            if(escape) {
                for(var key in insertRecord) {
                    params.push(insertRecord[key]);
                    insertRecord[key] = "?";
                }
            }
            multiInsertValues.push(insertRecord);
        });
        this.multiInsertValues = multiInsertValues;
        this.params = params;
    }
    private singleInsert(columnValues:object, escape: boolean) {
        var params = [];
        if(escape) {
            for(var key in columnValues) {
                params.push(columnValues[key]);
                columnValues[key] = "?";
            }
        }
        this.params = params;
        this.insertValues = columnValues;
    }
    public insert(columnValues : object[], escape : boolean) : MySQLData
    public insert(columnValues : object, escape : boolean) : MySQLData
    public insert(columnValues : object[] | object, escape : boolean = true) : MySQLData {            
        
        if(Array.isArray(columnValues)) {
            this.multiInsert(columnValues, escape);
        } else {
           this.singleInsert(columnValues, escape);
        }
        
        return this;
    }
    
    public update(columnValues : object, escape : boolean = true) : MySQLData {
        var params = [];
        if(escape) {
            for(var key in columnValues) {
                params.push(columnValues[key]);
                columnValues[key] = "?";
            }
        }
        this.params = params;
        this.updateValues = columnValues;
        return this;
    } 

    private generateMultiInsert(): string {
        var columns = Object.keys(this.multiInsertValues[0]).map(this.checkReserved);
        var insert = columns.join(",") + ") VALUES ";
        insert += this.multiInsertValues.map((insertRow:object)=>{
            return "(" + Object.values(insertRow).join(",") + ")";
        }).join(',');
        return insert;
    }

    private generateSingleInsert(): string {
        var columns = Object.keys(this.insertValues).map(this.checkReserved);
        var insert = columns.join(",") + ") VALUES ";
        insert += "(" + Object.values(this.insertValues).join(",") + ")";
        return insert;
    }

    public generateInsert() : string {
        var query = "INSERT INTO " + this.tableName + " (";
        if(typeof this.multiInsertValues == "undefined") {
            query += this.generateSingleInsert();
        } else {
            query += this.generateMultiInsert();
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
        return new Promise((resolve,reject)=>{
            this.execute(query).then(function(results) {
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
        return new Promise((resolve,reject)=>{
            this.execute(query).then(function(results) {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public execute(query : string): Promise<SQLResult> {
        return new Promise((resolve,reject)=>{
            this.connect().getConnection(async (err,connection)=>{
                if(err) {
                    reject(err);
                } else {
                    connection.query(query,this.params,(error,results,fields)=>{
                        let result = new SQLResult();
                        connection.release();
                        if(error !== null) {
                            result.error = error;
                            result.success = false;
                            return reject(error);
                        }
                        result.success = true;
                        let resultType = results.constructor.name;
                        if(resultType === 'OkPacket') {
                            result.rows_affected = results.affectedRows;
                            result.rows_changed = results.changedRows;
                            result.insert_id = results.insertId;
                        } else {
                            result.rows = results;
                        }
                        return resolve(result);
                    });   
                }                                 
            });
            
        });
    }

    public limit(limitAmount: number) : MySQLData {
        this.limitAmount = limitAmount;
        return this;
    }
    
    public offset(offsetAmount: number) : MySQLData {
        this.offsetAmount = offsetAmount;
        return this;
    }

    private addJoin(type: string, table : string | MySQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null):void {
        var tableName = "";
        var primaryKey: string | ((q:Query)=>Query);
        var foreignKey: string;
        var params = [];
        if(typeof table == "string") {
            tableName = table;
            primaryKey = arg2;
            foreignKey = <string>arg3;
        } else {
            tableName = "(" + table.generateSelect() + ") " + arg2 + " ";
            primaryKey = arg3;
            foreignKey = arg4;
            params = table.getParams();
        }
        var query = new Query(false);
        if(typeof primaryKey != "string") {
            primaryKey(query);
        } else {
            query.on(primaryKey,"=",foreignKey);
            
        }
        this.joins.push({
            type: type,
            table: tableName,
            query: query,
            params: params
        });
    }

    public join(tableName : MySQLData, tableAlias : string, queryFunc : (q: Query) => Query) : MySQLData
    public join(tableName : MySQLData, tableAlias : string, primaryKey : string, foreignKey : string) : MySQLData
    public join(tableName : string, queryFunc : (q: Query) => Query) : MySQLData
    public join(tableName : string, primaryKey : string, foreignKey : string) : MySQLData
    public join(table : string | MySQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) : MySQLData {
        this.addJoin("JOIN", table, arg2, arg3, arg4);
        return this;
    }
    
    public leftJoin(tableName : MySQLData, tableAlias : string, queryFunc : (q: Query) => Query) : MySQLData
    public leftJoin(tableName : MySQLData, tableAlias : string, primaryKey : string, foreignKey : string) : MySQLData
    public leftJoin(tableName : string, queryFunc : (q: Query) => Query) : MySQLData
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : MySQLData
    public leftJoin(table : string | MySQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) : MySQLData {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4);
        return this;
    }

    public count(): Promise<number> {
        var sql = new MySQLData(this.usedConfig);
        sql.table(this,"count_sql");
        sql.cols(["COUNT(*) num"]);
        return new Promise((resolve,reject) => {
            sql.fetch().then((result) => {
                var num = result.rows[0]['num'];
                resolve(num);
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
    
    public order(field:string,direction:SQLOrder.Direction):MySQLData {
        this.ordering.push({
            field: field,
            direction: direction
        });
        return this;
    }

    public group(groupFields:string[]):MySQLData {
        this.groupFields = groupFields.map(this.checkReserved);
        return this;
    }



}