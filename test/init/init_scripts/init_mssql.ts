import { iSQL } from "../../../api/library/data-access/sql/interface/SQLInterface";
import {DataAccessFactory} from "../../../api/library/data-access/factory";
import { Request, Response } from "node-fetch";
var factory:DataAccessFactory = require('../../../api/library/data-access/factory');
const fetch = require('node-fetch');

export async function init() {
    var db:iSQL = factory.create('mssql');
    var seeded = await db.doesTableExist("users");
    if(!seeded) {
        await db.raw(`CREATE TABLE [dbo].[users](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [title_id] [int] NOT NULL,
            [first_name] [varchar](50) NOT NULL,
            [surname] [varchar](50) NOT NULL,
            [email] [varchar](200) NULL,
            [gender_id] [int] NOT NULL,
            [date_of_birth] [datetime] NOT NULL,
            [phone_number] [varchar](50) NOT NULL,
            [city_id] [int] NOT NULL,
            [country_id] [int] NULL,
            [postcode] [varchar](100) NOT NULL,
            [street_address] [varchar](100) NOT NULL,
            [active] [tinyint] NULL
        CONSTRAINT [PK_users] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`ALTER TABLE [dbo].[users] ADD  DEFAULT ((0)) FOR [active]`,{});

        await db.raw(`CREATE TABLE [dbo].[user_settings](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [user_id] [int] NOT NULL,
         CONSTRAINT [PK_user_settings] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});


        await db.raw(`CREATE TABLE [dbo].[titles](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [title] [varchar](10) NOT NULL,
         CONSTRAINT [PK_titles] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`CREATE TABLE [dbo].[party_guests](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [party_id] [int] NOT NULL,
            [user_id] [int] NOT NULL,
            [accepted] [tinyint] NOT NULL,
         CONSTRAINT [PK_party_guests] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`ALTER TABLE [dbo].[party_guests] ADD  DEFAULT ((0)) FOR [accepted]`,{});

        await db.raw(`CREATE TABLE [dbo].[parties](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [date] [datetime] NOT NULL,
            [city_id] [int] NOT NULL,
         CONSTRAINT [PK_parties] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`CREATE TABLE [dbo].[genders](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [gender] [varchar](10) NOT NULL,
         CONSTRAINT [PK_genders] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`CREATE TABLE [dbo].[countries](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [country] [varchar](50) NOT NULL,
         CONSTRAINT [PK_countries] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});

        await db.raw(`CREATE TABLE [dbo].[cities](
            [id] [int] IDENTITY(1,1) NOT NULL,
            [city] [varchar](50) NOT NULL,
         CONSTRAINT [PK_cities] PRIMARY KEY CLUSTERED 
        (
            [id] ASC
        )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
        ) ON [PRIMARY]`,{});
        
        

        async function getRecordId(record:string,table:string,field:string):Promise<number> {
            var getRecordDb:iSQL = factory.create('mssql');
            getRecordDb.table(table);
            getRecordDb.cols(['id']);
            getRecordDb.where(field,'=',record,true);
            var res = await getRecordDb.fetch();
            if(res.rows.length > 0) {
                return parseInt(res.rows[0]['id']);
            }
            var insertRecordDb:iSQL = factory.create('mssql');
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
            var insertPartyDb = factory.create('mssql');
            insertPartyDb.table('parties');
            insertPartyDb.insert({
                "date": date.getFullYear() + "-" + (date.getMonth()+1).toString().padStart(2,"0") + "-" + date.getDate().toString().padStart(2,"0") + " " + date.getHours().toString().padStart(2,"0") + ":" + date.getMinutes().toString().padStart(2,"0") + ":" + date.getSeconds().toString().padStart(2,"0"),
                "city_id": cityId
            },true);
            var partyResult = await insertPartyDb.save();
            var partyId = partyResult.insert_id;
            for(var j = 0; j < partyGuests.length; j++) {
                var insertPartyGuestDb = factory.create('mssql');
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
            var insertDb = factory.create('mssql');
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
            var insertSettingsDb = factory.create('mssql');
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