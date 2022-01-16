import {BaseModel} from './../library/modelling/BaseModel';
import { City } from './City';
import { Gender } from './Gender';
import { Country } from './Country';
import { Title } from './Title';
import { UserSettings } from './UserSettings';
import { Party } from './Party';


export class User extends BaseModel {
    constructor() { 
        super("test","users","id",[
            "id",
            "first_name",
            "surname",
            "email",
            "title_id",
            "gender_id",
            "date_of_birth",
            "phone_number",
            "city_id",
            "country_id",
            "postcode",
            "street_address"
        ]);
    }

    public city() {
        return this.belongsTo(City,"city_id");
    }
    
    public gender() {
        return this.belongsTo(Gender,"gender_id");
    }
    
    public country() {
        return this.belongsTo(Country,"country_id");
    }
    
    public title() {
        return this.belongsTo(Title,"title_id");
    }

    public settings() {
        return this.hasOne(UserSettings,"user_id");
    }

    public parties() {
        var relation = this.belongsToMany(Party,"party_guests","user_id","party_id");
        relation.setLinkColumns(["user_id","party_id","accepted"]);
        return relation;
    }
}