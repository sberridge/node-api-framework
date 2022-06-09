import BaseModel from '../../BaseModel';
import ModelCollection from '../../ModelCollection';
import iSQL from '../../../data-access/sql/interface/SQLInterface';
import SQLResult from '../../../data-access/sql/SQLResult';

export default interface iRelation {
    returnsMany: boolean;
    generateQuery(): any
    
    getQuery(applyWhere:boolean): iSQL
    getQuery(): iSQL

    getResult(ids: any[]): Promise<SQLResult>
    getResult(): Promise<BaseModel>
    
    getResults(ids: any[]): Promise<{[key:string]:ModelCollection}>
    getResults(): Promise<ModelCollection>
}
    