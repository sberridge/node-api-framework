import BaseModel from './../library/modelling/BaseModel';
import {City} from './City';
import {User} from './User';

export class Party extends BaseModel {
    constructor() {        
        super("test",Party.table,Party.fields.id,Object.values(Party.fields));
    }

    static table = "parties";
    static fields = {
        "id": "id",
        "date": "date",
        "city_id": "city_id"
    }

    public city() {
        return this.belongsTo(City, Party.fields.city_id);
    }

    public guests() {
        return this.belongsToMany(User,"party_guests","party_id","user_id");
    }
}