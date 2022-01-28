import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Country extends BaseModel {
    constructor() {        
        super("test",Country.table,Country.fields.id,Object.values(Country.fields));
    }

    static table = "countries";
    static fields = {
        "id": "id",
        "country": "country"
    };

    public users() {
        return this.hasMany(User,User.fields.country_id);
    }
}