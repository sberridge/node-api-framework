import BaseModel from '../../BaseModel';
import ModelCollection from '../../ModelCollection';
import iSQL from 'api/library/data-access/sql/interface/SQLInterface';

export default interface iRelation {
    returnsMany: boolean;
    generateQuery(): any
    
    getQuery(applyWhere:boolean): iSQL
    getQuery(): iSQL

    getResult(ids: any[]): Promise<object>
    getResult(): Promise<BaseModel>
    
    getResults(ids: any[]): Promise<object>
    getResults(): Promise<ModelCollection>
}
    