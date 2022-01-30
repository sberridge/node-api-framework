import * as mssql from 'mssql';
import {iSQL} from "./interface/SQLInterface";
import {SQLOrder} from "./interface/SQLOrder";
import {Query} from"./Query";
import {ModelCollection} from './../../modelling/ModelCollection';
import { WeightedCondition } from "./WeightedCondition";
import { SQLResult } from "./SQLResult";
import { BaseModel } from "./../../modelling/BaseModel";
import { comparison, pagination } from "./interface/SQLTypes";
import { ConnectionConfig } from "./interface/SQLConnectionConfig";


export class MSSQLData implements iSQL {
    private tableName : string;
    private selectColumns : string[];
    private additionalColumns: string[] = [];
    private subStatement : MSSQLData;
    private tableAlias : string;
    private weightedConditions:WeightedCondition[] = [];
    private joins: object[] = [];
    private static pools : Map<string, mssql.ConnectionPool> = new Map;
    private pool: mssql.ConnectionPool;
    private params : any[];
    private paramNames : any[];
    private paramPrefix : string = "param";
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

    constructor(connectionConfig : ConnectionConfig = null) {
        this.query.increaseParamNum(1);
        if(connectionConfig !== null) {
            this.usedConfig = connectionConfig;   
            
        }
        
    }

    private async connect():Promise<boolean> {
        if(!MSSQLData.pools.has(this.usedConfig.name)) {
            var config:mssql.config = {
                server: this.usedConfig.host,
                user: this.usedConfig.user,
                password: this.usedConfig.password,
                database: this.usedConfig.database
            };
            if("port" in this.usedConfig) {
                config.port = this.usedConfig.port;
            }
            try {
                let pool = await (new mssql.ConnectionPool(config)).connect()
                MSSQLData.pools.set(this.usedConfig.name, pool);
        
            } catch (e) {
                return false;
            }
            
        }
        this.pool = MSSQLData.pools.get(this.usedConfig.name);
        return true;
    }

    public closePool(key:string):Promise<void> {
        return new Promise((resolve,reject)=>{
            if(MSSQLData.pools.has(key)) {
                MSSQLData.pools.get(key).close(function(err) {
                    MSSQLData.pools.delete(key);
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
            for(let key of MSSQLData.pools.keys()) {
                promises.push(this.closePool(key));
            }
            Promise.all(promises).then(()=>{
                resolve();
            });
        })
        
    }

    public toModel(model: any) : MSSQLData {
        this.modelFunc = model;
        return this;
    }

    public async doesTableExist(table:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MSSQLData(this.usedConfig);
            db.table("information_schema.TABLES");
            db.cols(['COUNT(*) num']);
            db.where("TABLE_CATALOG","=",this.usedConfig['database'],true);
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
            var db = new MSSQLData(this.usedConfig);
            db.table("information_schema.COLUMNS");
            db.cols(['COUNT(*) num']);
            db.where("TABLE_CATALOG","=",this.usedConfig['database'],true);
            db.where("TABLE_NAME","=",table,true);
            db.where("COLUMN_NAME","=",column,true);
            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch(e=>{
                reject(e);
            });
        });
        
    }

    public async doesTriggerExist(triggerName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MSSQLData(this.usedConfig);
            db.table("sys.triggers");
            db.cols(['COUNT(*) num']);
            db.where("name","=",triggerName,true);
            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });
    }

    public async doesStoredProcedureExist(procedureName:string):Promise<boolean> {
        return new Promise((resolve,reject)=>{
            var db = new MSSQLData(this.usedConfig);
            db.table("information_schema.ROUTINES");
            db.cols(['COUNT(*) num']);
            db.where("ROUTINE_CATALOG","=",this.usedConfig['database'],true);
            db.where("ROUTINE_NAME","=",procedureName,true);
            db.fetch().then((res)=>{
                resolve(res.rows[0]['num'] > 0);
            }).catch((e)=>{
                reject(e);
            });
        });
    }

    public checkConnection():Promise<boolean> {
        return new Promise(async (resolve,reject)=>{
            let connected = await this.connect();
            resolve(connected && this.pool.connected);
        });
    }

    public newQuery():MSSQLData {
        return new MSSQLData(this.usedConfig);
    }

    public raw(query:string,params:any): Promise<SQLResult> {
        this.params = [];
        this.paramNames = [];
        if(typeof params !== "undefined") {
            if(!Array.isArray(params)){
                for(var key in params) {
                    this.params.push(params[key]);
                    this.paramNames.push(key);
                }
            } else {
                throw new Error("Must pass an object containing key to value pairs for named parameters when running MSSQL query");
            }
        }
        return this.execute(query);

    }

    
    public table(tableName : MSSQLData, tableAlias : string) : MSSQLData
    public table(tableName : string) : MSSQLData
    public table(tableName : MSSQLData | string, tableAlias? : string) : MSSQLData {
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
        return this.paramNames;
    }

    public setParamPrefix(prefix: string) {
        this.paramPrefix = prefix;
        this.query.setPrefix(prefix);
    }

    public increaseParamNum(num: number) {
        this.query.increaseParamNum(num);
    }

    public getParamNum(): number {
        return this.query.getParamNum();
    }

    public setIncrementingField(field: string): MSSQLData {
        return this;
    }

    public cols(selectColumns : string[]) : MSSQLData {
        var self = this;
        this.selectColumns = selectColumns.map(function(col) {
            return self.checkReserved(col);
        });            
        return this;
    }

    public addCol(column:string) : MSSQLData {
        this.selectColumns.push(this.checkReserved(column));
        var colSplit = column.split(/ |\./);
        this.additionalColumns.push(colSplit[colSplit.length-1]);
        return this;
    }
    
    public removeCol(column:string) : MSSQLData {
        var col = this.checkReserved(column);
        if(this.selectColumns.indexOf(col) > -1) {
            this.selectColumns.splice(this.selectColumns.indexOf(col),1);
        }
        return this;
    }

    public removeCols(columns:string[]) : MSSQLData {
        columns.forEach((column)=>this.removeCol(column));
        return this;
    }
    
    public keepCols(columns:string[]) : MSSQLData {
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
            'order'
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
    
    public where(field : string, comparator : comparison, value : any, escape : boolean = true) : MSSQLData {
        this.query.where(this.checkReserved(field),comparator,value,escape);
        return this;
    }
    
    public whereNull(field : string) : MSSQLData {
        this.query.whereNull(this.checkReserved(field));
        return this;
    }
    
    public whereNotNull(field : string) : MSSQLData {
        this.query.whereNotNull(this.checkReserved(field));
        return this;
    }
    
    public whereIn(field : string, subQuery : MSSQLData) : MSSQLData
    public whereIn(field : string, values : any[], escape : boolean) : MSSQLData
    public whereIn(field : string, values : any[] | MSSQLData, escape : boolean = true) : MSSQLData {
        if(Array.isArray(values)) {
            this.query.whereIn(this.checkReserved(field),values,escape);
        } else {
            this.query.whereIn(this.checkReserved(field),values);
        }
        return this;
    }

    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : MSSQLData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : MSSQLData
    public weightedWhere(field : string, comparator : comparison, value : any, weight: any, nonMatchWeight:any, escape : boolean = true) : MSSQLData {
        var weightedQuery = new Query(true);
        weightedQuery.setPrefix("weight" + weight.toString());
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        this.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }

    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : comparison, value : any, weight: any, nonMatchWeight:any, escape : boolean = true) : WeightedCondition {
        var weightedQuery = new Query(true);
        weightedQuery.setPrefix("weight" + weight.toString());
        weightedQuery.where(this.checkReserved(field),comparator,value,escape);
        return new WeightedCondition(weightedQuery,weight,nonMatchWeight);
    }

    public generateConditional(ifThis:string,thenVal:string,elseVal:string):string {
        return "CASE WHEN " + ifThis + ' THEN ' + thenVal + ' ELSE ' + elseVal + " END";
    }
    
    public or() : MSSQLData {
        this.query.or();
        return this;
    }
    
    public and() : MSSQLData {
        this.query.and();
        return this;
    }
    
    public openBracket() : MSSQLData {
        this.query.openBracket();
        return this;
    }
    
    public closeBracket() : MSSQLData {
        this.query.closeBracket();
        return this;
    }

    public generateSelect() : string {
        var params = [];
        var paramNames = [];
        var query = "SELECT ";

        if(this.weightedConditions.length > 0) {
            var weightedConditionQueries = this.weightedConditions.map((condition:WeightedCondition)=>{
                return condition.applyCondition(this,params,paramNames);
            });
            this.selectColumns.push(weightedConditionQueries.join(' + ') + ' __condition_weight__');
            this.ordering.push({
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
            this.subStatement.getParamNames().forEach((paramName)=>{
                paramNames.push(paramName);
            });
        } else {
            query += " " + this.tableName + " ";
        }

        this.joins.forEach((join : any)=>{
            let joinDetails = join.func(...join.args);
            joinDetails.params.forEach(function(param) {
                params.push(param);
            });
            joinDetails.paramNames.forEach(function(paramName) {
                paramNames.push(paramName);
            });
            joinDetails.query.increaseParamNum(this.getParamNum()-1);
            let startParamNum = joinDetails.query.getParamNum();
            query += " " + joinDetails.type + " " + " " + joinDetails.table + " ON " + (joinDetails.query.applyWheres(params,paramNames));
            let diff = joinDetails.query.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        });
        if(this.query.getWheres().length > 0) {
            query += " WHERE " + (this.query.applyWheres(params,paramNames)) + " ";
        }                
        this.params = params;
        this.paramNames = paramNames;

        if(typeof this.groupFields != "undefined" && this.groupFields.length > 0) {
            query += " GROUP BY " + this.groupFields.join(",") + " ";
        }

        if(this.ordering.length > 0) {
            query += " ORDER BY ";
            var orders = this.ordering.map((val)=>{
                return this.checkReserved(val['field']) + " " + val["direction"];
            });
            query += orders.join(",");

            if(typeof this.offsetAmount != "undefined") {
                query += " OFFSET " + this.offsetAmount + " ROWS ";
            }

            if(typeof this.limitAmount != "undefined") {
                query += " FETCH NEXT " + this.limitAmount + " ROWS ONLY ";
            }
        }

        return query;
    }

    public fetch(): Promise<SQLResult> {
        return new Promise((resolve,reject) => {
            this.execute(this.generateSelect()).then((results) => {
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
        return new Promise((resolve,reject) => {
            this.execute(this.generateSelect()).then((results) => {
                var modelCollection = new ModelCollection;
                results.rows.forEach((result)=>{
                    let model = this.resultToModel(result);
                    modelCollection.add(model);
                });
                resolve(modelCollection);
            }).catch(err=>{
                reject(err);
            });
        }); 
    }

    public streamModels(num: number, callback: (models:ModelCollection)=>Promise<void>): Promise<void> {
        return new Promise((resolve,reject)=>{
            this.stream(num, async (results) => {
                var modelCollection = new ModelCollection;
                results.forEach((result)=>{
                    var model = new this.modelFunc();
                    model.loadData(result);
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
        return new Promise(async (resolve,reject) => {
            await this.connect();

            var results = [];

            var request = this.pool.request();
            request.stream = true;
            var query = this.generateSelect();
            var data = {};
            this.params.forEach((val,i)=>{
                switch(typeof val) {
                    case "number":
                        request.input(this.paramNames[i],mssql.Int,val);
                        break;
                    case "string":
                        request.input(this.paramNames[i],mssql.NVarChar,val);
                        break;
                    case "boolean":
                        request.input(this.paramNames[i],mssql.Bit,val);
                        break;
                }
                data[this.paramNames[i]] = val;           
            });
            request.query(query);
            request.on('recordset',columns=>{

            });
            request.on('row',async(row)=>{
                results.push(row);
                if(results.length >= num) {
                    request.pause();
                    await callback(results);
                    results = [];
                    request.resume();
                }
            });
            request.on('error', err => {
                // May be emitted multiple times
            });
            
            request.on('done', async (result) => {
                if(results.length > 0) {
                    await callback(results);
                }
                resolve();
            });
        });
        
    }

    public insert(columnValues : object[], escape : boolean) : MSSQLData
    public insert(columnValues : object, escape : boolean) : MSSQLData
    public insert(columnValues : object[] | object, escape : boolean = true) : MSSQLData {            
        var params = [];
        var paramNames = [];
        if(Array.isArray(columnValues)) {
            var multiInsertValues = [];
            columnValues.forEach((insertRecord:object)=>{
                if(escape) {
                    for(var key in insertRecord) {
                        var num = params.push(insertRecord[key]);
                        var name = this.paramPrefix + num.toString();
                        insertRecord[key] = "@" + name;
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
                    var name = this.paramPrefix + num.toString();
                    columnValues[key] = "@" + name;
                    paramNames.push(name);
                }
            }
            this.insertValues = columnValues;
        }
        this.params = params;
        this.paramNames = paramNames;
        
        return this;
    }
    
    public update(columnValues : object, escape : boolean = true) : MSSQLData {
        var params = [];
        var paramNames = [];
        if(escape) {
            for(var key in columnValues) {
                var num = params.push(columnValues[key]);
                var name = "update" + this.paramPrefix + num.toString();
                columnValues[key] = "@" + name;
                paramNames.push(name);
            }
        }
        this.params = params;
        this.paramNames = paramNames;
        this.updateValues = columnValues;
        return this;
    } 

    public generateInsert() : string {
        var query = "INSERT INTO " + this.tableName + " (";
        var columns = [];
        if(typeof this.multiInsertValues == "undefined") {
            columns = Object.keys(this.insertValues).map(this.checkReserved);
        } else {
            columns = Object.keys(this.multiInsertValues[0]).map(this.checkReserved);
        }
        query += columns.join(",") + ") VALUES";

        if(typeof this.multiInsertValues == "undefined") {
            query += "(" + Object.values(this.insertValues).join(",") + "); SELECT IDENT_CURRENT('" + this.tableName + "') AS last_insert_id;";
        } else {
            query += this.multiInsertValues.map((insertRow:object)=>{
                return "(" + Object.values(insertRow).join(",") + ")";
            }).join(',');    
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
            query += " WHERE " + (this.query.applyWheres(this.params,this.paramNames)) + " ";
        }

        return query + ";";
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
        return new Promise((resolve,reject)=> {
            this.execute(query).then((results)=> {
                resolve(results);
            }).catch(err=>{
                reject(err);
            });
        });
    }

    public generateDelete() : string {
        var query = "DELETE FROM " + this.tableName + " ";
        this.params = [];
        this.paramNames = [];
        if(this.query.getWheres().length > 0) {
            query += " WHERE " + (this.query.applyWheres(this.params,this.paramNames)) + " ";
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
        return new Promise(async (resolve,reject)=>{
            await this.connect();
            var request = this.pool.request();
            this.params.forEach((val,i)=>{
                switch(typeof val) {
                    case "number":
                        request.input(this.paramNames[i],mssql.Int,val);
                        break;
                    case "string":
                        request.input(this.paramNames[i],mssql.NVarChar,val);
                        break;
                    case "boolean":
                        request.input(this.paramNames[i],mssql.Bit,val);
                        break;
                    default:
                        request.input(this.paramNames[i],mssql.NVarChar,val);
                }      
            });
            let sqlResult = new SQLResult();
            request.query(query).then((result)=>{
                if(typeof result == "object" && "recordset" in result) {
                    sqlResult.success = true;
                    if(typeof this.updateValues != "undefined") {
                        sqlResult.rows_affected = result['rowsAffected'][0];
                    } else if(typeof this.insertValues != "undefined") {
                        sqlResult.rows_affected = result['rowsAffected'][0];
                        sqlResult.insert_id = result['recordset'][0]['last_insert_id'] || 0
                    } else if(typeof result['recordset'] !== "undefined") {
                        sqlResult.rows = result['recordset'];
                    }                        
                }
                resolve(sqlResult);
            }).catch(e=>{
                reject(e);
            });
            
        });
            
            
    }

    public limit(limitAmount: number) : MSSQLData {
        this.limitAmount = limitAmount;
        return this;
    }
    
    public offset(offsetAmount: number) : MSSQLData {
        this.offsetAmount = offsetAmount;
        return this;
    }

    private addJoin(type: string, table : string | MSSQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null):void {
        this.joins.push({
            func: (type: string, table : string | MSSQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) => {
                var tableName = "";
                var primaryKey: string | ((q:Query)=>Query);
                var foreignKey: string;
                var params = [];
                var paramNames = [];
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
                    paramNames = table.getParamNames();
                }
                var query = new Query(true);
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
                    params: params,
                    paramNames: paramNames
                };
            },
            args: [
                type,
                table, 
                arg2, 
                arg3, 
                arg4
            ]
        });
    }

    public join(tableName : MSSQLData, tableAlias : string, queryFunc : (q: Query) => Query) : MSSQLData
    public join(tableName : MSSQLData, tableAlias : string, primaryKey : string, foreignKey : string) : MSSQLData
    public join(tableName : string, queryFunc : (q: Query) => Query) : MSSQLData
    public join(tableName : string, primaryKey : string, foreignKey : string) : MSSQLData
    public join(table : string | MSSQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) : MSSQLData {       
        this.addJoin("JOIN", table, arg2, arg3, arg4)
        return this;
    }
    
    public leftJoin(tableName : MSSQLData, tableAlias : string, queryFunc : (q: Query) => Query) : MSSQLData
    public leftJoin(tableName : MSSQLData, tableAlias : string, primaryKey : string, foreignKey : string) : MSSQLData
    public leftJoin(tableName : string, queryFunc : (q: Query) => Query) : MSSQLData
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : MSSQLData
    public leftJoin(table : string | MSSQLData, arg2 : string | ((q: Query)=>Query), arg3 : string | ((q: Query)=>Query) = null, arg4 : string = null) : MSSQLData {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4)        
        return this;
    }

    public count(): Promise<number> {
        var sql = new MSSQLData(this.usedConfig);
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

    public order(field:string,direction:SQLOrder.Direction):MSSQLData {
        this.ordering.push({
            field: field,
            direction: direction
        });
        return this;
    }

    public group(groupFields:string[]):MSSQLData {
        this.groupFields = groupFields.map(this.checkReserved);
        return this;
    }



}