import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Country extends BaseModel {
    constructor() {        
        super("test","countries","id",[
            "id",
            "country"
        ]);
    }

    public users() {
        return this.hasMany(User,"country_id");
    }
}