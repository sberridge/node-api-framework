import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Gender extends BaseModel {
    constructor() {        
        super("test","genders","id",[
            "id",
            "gender"
        ]);
    }

    public users() {
        return this.hasMany(User,"gender_id");
    }
}