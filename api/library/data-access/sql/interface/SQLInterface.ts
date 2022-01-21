import { ModelCollection } from './../../../modelling/ModelCollection';
import { SQLResult } from "../SQLResult";
import { WeightedCondition } from "../WeightedCondition";
import { Query } from '../Query';
import { SQLOrder } from './SQLOrder';
import { comparison, pagination } from './SQLTypes';

    export interface iSQL {

        doesTableExist(tableName:string) : Promise<boolean>
        doesColumnExist(tableName:string,column:string) : Promise<boolean>
        doesTriggerExist(triggerName:string) : Promise<boolean>
        doesStoredProcedureExist(procedureName:string) : Promise<boolean>

        checkConnection():Promise<boolean>

        newQuery():iSQL

        raw(query:string,params:any) : Promise<SQLResult>

        closePool(key: string) : any
        closePools() : any

        toModel(model: any) : any
        
        table(tableName : iSQL, tableAlias : string) : iSQL
        table(tableName : string) : iSQL
        
        getParams() : any[]
        getParamNames() : any[]

        increaseParamNum(num:number):void
        getParamNum():number

        cols(columns : string[]) : iSQL
        addCol(column : string) : iSQL
        removeCol(column : string) : iSQL
        removeCols(columns : string[]) : iSQL
        keepCols(columns : string[]) : iSQL
        
        where(field : string, comparator : comparison, value : any, escape : boolean) : iSQL
        
        whereNull(field : string) : iSQL

        whereNotNull(field : string) : iSQL

        whereIn(field : string, subQuery : any) : iSQL
        whereIn(field : string, values : any[], escape : boolean) : iSQL

        weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : iSQL
        weightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : iSQL
        
        subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : WeightedCondition
        subWeightedWhere(field : string, comparator : comparison, value : any, weight: number, nonMatchWeight: number, escape : boolean) : WeightedCondition

        generateConditional(ifThis:string,thenVal:string,elseVal:string):string

        or() : iSQL

        and() : iSQL

        openBracket() : iSQL
        closeBracket() : iSQL

        generateSelect() : string

        fetch() : Promise<SQLResult>
        fetchModels() : Promise<ModelCollection>
        
        stream(num : number, callback : (results:any[])=>Promise<void>): Promise<void>
        streamModels(num: number, callback: (models:ModelCollection)=>Promise<void>): Promise<void>

        generateInsert():string
        insert(columnValues : object[], escape : boolean) : iSQL
        insert(columnValues : object, escape : boolean) : iSQL

        generateUpdate():string
        update(columnValues : object, escape : boolean) : iSQL

        save() : Promise<SQLResult>

        generateDelete(): string
        delete(): Promise<SQLResult>
        limit(limitAmount: number) : iSQL
        offset(offsetAmount: number) : iSQL

        join(tableName : any, tableAlias : string, queryFunc : (q: Query) => Query) : iSQL
        join(tableName : any, tableAlias : string, primaryKey : string, foreignKey : string) : iSQL
        join(tableName : string, queryFunc : (q: Query) => Query) : iSQL
        join(tableName : string, primaryKey : string, foreignKey : string) : iSQL
        
        leftJoin(tableName : any, tableAlias : string, queryFunc : (q: Query) => Query) : iSQL
        leftJoin(tableName : any, tableAlias : string, primaryKey : string, foreignKey : string) : iSQL
        leftJoin(tableName : string, queryFunc : (q: Query) => Query) : iSQL
        leftJoin(tableName : string, primaryKey : string, foreignKey : string) : iSQL

        count() : Promise<number> 

        paginate(perPage: number, page: number): Promise<pagination>

        order(field:string,direction:SQLOrder.Direction): iSQL

        group(groupFields:string[]): iSQL
    }
