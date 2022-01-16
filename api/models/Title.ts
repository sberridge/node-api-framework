import {BaseModel} from './../library/modelling/BaseModel';
import {User} from './User';

export class Title extends BaseModel {
    constructor() {        
        super("test","titles","id",[
            "id",
            "title"
        ]);
    }

    public users() {
        return this.hasMany(User,"title_id");
    }
}