import { iSQL } from "../../../api/library/data-access/sql/interface/SQLInterface";
import {DataAccessFactory} from "../../../api/library/data-access/factory";
import { Request, Response } from "node-fetch";
var factory:DataAccessFactory = require('../../../api/library/data-access/factory');
const fetch = require('node-fetch');

export async function init() {
    var db:iSQL = factory.create('postgres');
    var seeded = await db.doesTableExist("users");
    if(!seeded) {
        await db.raw(`CREATE TABLE IF NOT EXISTS public.users
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            title_id integer,
            first_name character varying(50) COLLATE pg_catalog."default",
            surname character varying(50) COLLATE pg_catalog."default",
            email character varying(200) COLLATE pg_catalog."default" NOT NULL,
            gender_id integer,
            date_of_birth timestamp without time zone,
            phone_number character varying(50) COLLATE pg_catalog."default",
            city_id integer,
            country_id integer NOT NULL,
            postcode character varying(100) COLLATE pg_catalog."default",
            street_address character varying(100) COLLATE pg_catalog."default",
            active boolean NOT NULL DEFAULT true,
            CONSTRAINT users_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.user_settings
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            user_id integer NOT NULL,
            CONSTRAINT user_settings_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);


        await db.raw(`CREATE TABLE IF NOT EXISTS public.titles
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            title character varying(10) COLLATE pg_catalog."default" NOT NULL,
            CONSTRAINT titles_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.party_guests
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            party_id integer NOT NULL,
            user_id integer NOT NULL,
            accepted boolean NOT NULL DEFAULT false,
            CONSTRAINT party_guests_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.parties
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            date timestamp without time zone NOT NULL,
            city_id integer,
            CONSTRAINT parties_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.genders
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            gender character varying(10) COLLATE pg_catalog."default" NOT NULL,
            CONSTRAINT genders_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.countries
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            country character varying(50) COLLATE pg_catalog."default" NOT NULL,
            CONSTRAINT countries_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);

        await db.raw(`CREATE TABLE IF NOT EXISTS public.cities
        (
            id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
            city character varying(50) COLLATE pg_catalog."default" NOT NULL,
            CONSTRAINT cities_pkey PRIMARY KEY (id)
        )
        
        TABLESPACE pg_default;`,[]);
        
        

        async function getRecordId(record:string,table:string,field:string):Promise<number> {
            var getRecordDb:iSQL = factory.create('postgres');
            getRecordDb.table(table);
            getRecordDb.cols(['id']);
            getRecordDb.where(field,'=',record,true);
            var res = await getRecordDb.fetch();
            if(res.rows.length > 0) {
                return parseInt(res.rows[0]['id']);
            }
            var insertRecordDb:iSQL = factory.create('postgres');
            insertRecordDb.setIncrementingField("id");
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
            var insertPartyDb = factory.create('postgres');
            insertPartyDb.setIncrementingField("id");
            insertPartyDb.table('parties');
            insertPartyDb.insert({
                "date": date.getFullYear() + "-" + (date.getMonth()+1).toString().padStart(2,"0") + "-" + date.getDate().toString().padStart(2,"0") + " " + date.getHours().toString().padStart(2,"0") + ":" + date.getMinutes().toString().padStart(2,"0") + ":" + date.getSeconds().toString().padStart(2,"0"),
                "city_id": cityId
            },true);
            var partyResult = await insertPartyDb.save();
            var partyId = partyResult.insert_id;
            for(var j = 0; j < partyGuests.length; j++) {
                var insertPartyGuestDb = factory.create('postgres');
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
            var insertDb = factory.create('postgres');
            var cityId = await getRecordId(user.location.city,"cities","city");
            var dob = user.dob.date.split('T');
            var dobTime = dob[1].split('.');
            var dobStr = dob[0] + ' ' + dobTime[0];
            insertDb.table('users');
            insertDb.setIncrementingField("id");
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
            var insertSettingsDb = factory.create('postgres');
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
    }
    
    await db.closePools();
}