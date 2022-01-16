import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class UserSettings extends BaseModel {
    constructor() {        
        super("test","user_settings","id",[
            "id",
            "user_id"
        ]);
    }

    public user() {
        return this.belongsTo(User,"user_id");
    }
}