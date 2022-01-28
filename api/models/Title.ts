import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Title extends BaseModel {
    constructor() {        
        super("test",Title.table,Title.fields.id,Object.values(Title.fields));
    }

    static table = "titles";
    static fields = {
        "id": "id",
        "title": "title"
    };

    public users() {
        return this.hasMany(User,User.fields.title_id);
    }
}