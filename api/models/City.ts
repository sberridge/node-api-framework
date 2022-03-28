import BaseModel from './../library/modelling/BaseModel';
import { Party } from './Party';
import {User} from './User';

export class City extends BaseModel {
    constructor() {        
        super("test",City.table,City.fields.id,Object.values(City.fields));
    }

    static table = "cities";
    static fields = {
        "id": "id",
        "city": "city"
    };

    public users() {
        return this.hasMany(User,User.fields.city_id);
    }

    public parties() {
        return this.hasMany(Party, Party.fields.city_id);
    }
}