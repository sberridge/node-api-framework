import BaseModel from './../library/modelling/BaseModel';
import {User} from './User';

export class UserSettings extends BaseModel {
    constructor() {        
        super("test",UserSettings.table,UserSettings.fields.id,Object.values(UserSettings.fields));
    }

    static table = "user_settings";
    static fields = {
        "id": "id",
        "user_id": "user_id"
    };

    public user() {
        return this.belongsTo(User,UserSettings.fields.user_id);
    }
}