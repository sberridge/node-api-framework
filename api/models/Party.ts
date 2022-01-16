import {BaseModel} from './../library/modelling/BaseModel';
import {City} from './City';
import {User} from './User';

export class Party extends BaseModel {
    constructor() {        
        super("test","parties","id",[
            "id",
            "date",
            "city_id"
        ]);
    }

    public city() {
        return this.belongsTo(City,"city_id");
    }

    public guests() {
        return this.belongsToMany(User,"party_guests","party_id","user_id");
    }
}