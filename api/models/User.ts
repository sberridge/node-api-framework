import BaseModel from './../library/modelling/BaseModel';
import { City } from './City';
import { Gender } from './Gender';
import { Country } from './Country';
import { Title } from './Title';
import { UserSettings } from './UserSettings';
import { Party } from './Party';


export class User extends BaseModel {
    constructor() { 
        super("test",User.table,User.fields.id,Object.values(User.fields));
    }

    static table = "users";

    static fields = {
        "id": "id",
        "first_name": "first_name",
        "surname": "surname",
        "email": "email",
        "title_id": "title_id",
        "gender_id": "gender_id",
        "date_of_birth": "date_of_birth",
        "phone_number": "phone_number",
        "city_id": "city_id",
        "country_id": "country_id",
        "postcode": "postcode",
        "street_address": "street_address"
    };

    public city() {
        return this.belongsTo(City,User.fields.city_id);
    }
    
    public gender() {
        return this.belongsTo(Gender,User.fields.gender_id);
    }
    
    public country() {
        return this.belongsTo(Country,User.fields.country_id);
    }
    
    public title() {
        return this.belongsTo(Title,User.fields.title_id);
    }

    public settings() {
        return this.hasOne(UserSettings,UserSettings.fields.user_id);
    }

    public parties() {
        var relation = this.belongsToMany(Party,"party_guests","user_id","party_id");
        relation.setLinkColumns(["user_id","party_id","accepted"]);
        return relation;
    }
}