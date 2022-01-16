import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class City extends BaseModel {
    constructor() {        
        super("test","cities","id",[
            "id",
            "city"
        ]);
    }

    public users() {
        return this.hasMany(User,"city_id");
    }
}