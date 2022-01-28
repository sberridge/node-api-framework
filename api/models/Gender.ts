import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Gender extends BaseModel {
    constructor() {        
        super("test",Gender.table,Gender.fields.id,Object.values(Gender.fields));
    }

    static table = "genders";
    static fields = {
        "id": "id",
        "gender": "gender"
    };

    public users() {
        return this.hasMany(User,User.fields.gender_id);
    }
}