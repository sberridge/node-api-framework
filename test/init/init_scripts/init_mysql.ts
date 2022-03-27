import { iSQL } from "../../../api/library/data-access/sql/interface/SQLInterface";
import DataAccessFactory from "../../../api/library/data-access/factory";
import { Response } from "node-fetch";
var factory:DataAccessFactory = DataAccessFactory.getInstance();
const fetch = require('node-fetch');

export async function init() {
    var db:iSQL = factory.create('test');
    var seeded = await db.doesTableExist("users");
    if(!seeded) {
        var createUserTableQuery = [
            "CREATE TABLE IF NOT EXISTS `users` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`title_id` INT NOT NULL,",
            "`first_name` VARCHAR(50) NOT NULL,",
            "`surname` VARCHAR(50) NOT NULL,",
            "`email` VARCHAR(200) NOT NULL,",
            "`gender_id` int NOT NULL,",
            "`date_of_birth` DATETIME NOT NULL,",
            "`phone_number` VARCHAR(50) NOT NULL,",
            "`city_id` int NOT NULL,",
            "`country_id` int NOT NULL,",
            "`postcode` VARCHAR(100) NOT NULL,",
            "`street_address` VARCHAR(100) NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        await db.raw(createUserTableQuery,[]);
        
        var createTitleTableQuery = [
            "CREATE TABLE `titles` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`title` VARCHAR(10) NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createTitleTableQuery,[]);
        
        var createGendersTableQuery = [
            "CREATE TABLE `genders` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`gender` VARCHAR(10) NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createGendersTableQuery,[]);
        
        var createCountriesTableQuery = [
            "CREATE TABLE `countries` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`country` VARCHAR(50) NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createCountriesTableQuery,[]);
        
        var createCitiesTableQuery = [
            "CREATE TABLE `cities` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`city` VARCHAR(50) NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createCitiesTableQuery,[]);
        
        var createUserSettingsTableQery = [
            "CREATE TABLE `user_settings` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`user_id` INT NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createUserSettingsTableQery,[]);
        
        var createPartiesTableQery = [
            "CREATE TABLE `parties` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`date` DATETIME NOT NULL,",
            "`city_id` INT NOT NULL,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createPartiesTableQery,[]);
        
        var createUserPartiesTableQuery = [
            "CREATE TABLE `party_guests` (",
            "`id` INT NOT NULL AUTO_INCREMENT,",
            "`user_id` INT NOT NULL,",
            "`party_id` INT NOT NULL,",
            "`accepted` TINYINT(1) NOT NULL DEFAULT 0,",
            "PRIMARY KEY (`id`)",
            ")",
            "COLLATE='utf8mb4_general_ci';"
        ].join("");
        
        await db.raw(createUserPartiesTableQuery,[]);

        async function getRecordId(record:string,table:string,field:string):Promise<number> {
            var getRecordDb:iSQL = factory.create('test');
            getRecordDb.table(table);
            getRecordDb.cols(['id']);
            getRecordDb.where(field,'=',record,true);
            var res = await getRecordDb.fetch();
            if(res.rows.length > 0) {
                return parseInt(res.rows[0]['id']);
            }
            var insertRecordDb:iSQL = factory.create('test');
            insertRecordDb.table(table);
            var insertObj = {};
            insertObj[field] = record;
            insertRecordDb.insert(insertObj,true);
            var insertRes = await insertRecordDb.save();
            return insertRes.insert_id;
        }

        async function createParty() {
            var date = new Date;
            date.setDate(date.getDate()+Math.round(Math.random()*20+1))
            var insertPartyDb = factory.create('test');
            insertPartyDb.table('parties');
            insertPartyDb.insert({
                "date": date.getFullYear() + "-" + (date.getMonth()+1).toString().padStart(2,"0") + "-" + date.getDate().toString().padStart(2,"0") + " " + date.getHours().toString().padStart(2,"0") + ":" + date.getMinutes().toString().padStart(2,"0") + ":" + date.getSeconds().toString().padStart(2,"0"),
                "city_id": cityId
            },true);
            var partyResult = await insertPartyDb.save();
            var partyId = partyResult.insert_id;
            for(var j = 0; j < partyGuests.length; j++) {
                var insertPartyGuestDb = factory.create('test');
                insertPartyGuestDb.table('party_guests');
                insertPartyGuestDb.insert({
                    "party_id": partyId,
                    "user_id": partyGuests[j]
                },true);
                var partyGuestResult = await insertPartyGuestDb.save();
            }
        }

        var res:Response = await fetch("https://randomuser.me/api/?results=1000&nat=gb");
        var json = await res.json();
        var partyGuests:number[] = [];
        var toInvite = Math.floor(Math.random() * (100 - 5 + 1) + 5);
        for(var i = 0, l = json.results.length; i < l; i++) {
            var user = json.results[i];
            var insertDb = factory.create('test');
            var cityId = await getRecordId(user.location.city,"cities","city");
            var dob = user.dob.date.split('T');
            var dobTime = dob[1].split('.');
            var dobStr = dob[0] + ' ' + dobTime[0];
            insertDb.table('users');
            insertDb.insert({
                "title_id": await getRecordId(user.name.title,"titles","title"),
                "first_name": user.name.first,
                "surname": user.name.last,
                "email": user.email,
                "gender_id": await getRecordId(user.gender,"genders","gender"),
                "date_of_birth": dobStr,
                "phone_number": user.phone,
                "city_id": cityId,
                "country_id": await getRecordId(user.location.country,"countries","country"),
                "postcode": user.location.postcode,
                "street_address": user.location.street.number.toString() + " " + user.location.street.name
            },true);
            var result = await insertDb.save();
            var userId = result.insert_id;
            var insertSettingsDb = factory.create('test');
            insertSettingsDb.table('user_settings');
            insertSettingsDb.insert({
                "user_id": userId
            },true);
            await insertSettingsDb.save();

            partyGuests.push(userId);
            if(partyGuests.length === toInvite) {
                await createParty();
                partyGuests = [];
                toInvite = Math.floor(Math.random() * (100 - 5 + 1) + 5);
            }
        }
        if(partyGuests.length > 0) {
            await createParty();
        }
        /* var users = JSON.parse();
        console.log(users); */


       
    }
    
    await db.closePools();
}