var assert:Chai.Assert = require('chai').assert;
var should:Chai.Should = require('chai').should();
var expect:Chai.ExpectStatic = require('chai').expect;
import {User} from './../api/models/User';
import {Country} from './../api/models/Country';
import {City} from './../api/models/City';
import {Gender} from './../api/models/Gender';
import {Title} from './../api/models/Title';
import {UserSettings} from './../api/models/UserSettings';
import { ModelCollection } from './../api/library/modelling/ModelCollection';
import { iSQL } from './../api/library/data-access/sql/interface/SQLInterface';
import { SQLResult } from './../api/library/data-access/sql/SQLResult';
import { Party } from './../api/models/Party';
var factory = require('./../api/library/data-access/factory');
describe('ModellingTests',function(){
    
    it('find model',function(done) {
        factory.onReady(async ()=>{
            try {
                var result:User = <User>(await (new User).find(1));
                expect(result).to.not.be.null;
                expect(result).to.be.instanceOf(User);
                expect(result.getColumn('id')).to.equal(1);
                var json = result.toJSON();
                json.should.contain.keys([
                    "id",
                    "first_name",
                    "surname",
                    "email",
                    "gender_id",
                    "date_of_birth",
                    "phone_number",
                    "city_id",
                    "country_id",
                    "postcode",
                    "street_address"
                ]);
                done();
            } catch(e) {
                done(e);
            }
            
        });
    });
    
    it('fetch models',function(done){
        factory.onReady(async ()=>{
            try {
                var results:ModelCollection = await (new User).all().limit(5).fetchModels();
                results.should.be.instanceOf(ModelCollection);
                var models = results.getModels();
                expect(models[0]).to.be.instanceOf(User);
                done();
            } catch(e) {
                done(e);
            }
            
        });        
    });
    
    it('create model',function(done){
        factory.onReady(async ()=>{
            try {
                var user:User = (new User);
                var columns = {
                    "first_name": "test",
                    "surname": "test",
                    "title_id": 1,
                    "gender_id": 1,
                    "country_id": 1,
                    "city_id": 1,
                    "date_of_birth": "2020-01-01 00:00:00",
                    "email": "test@test.com",
                    "phone_number": "111",
                    "postcode": "ST12 8UE",
                    "street_address": "123 fake street"
                };
                user.updateColumns(columns);
                var result = await user.save();
                var userColumns = user.getColumns();
                for(var field in userColumns) {
                    if(field in columns) {
                        expect(userColumns[field]).to.equal(columns[field]);
                    }
                }
                expect(user.getColumn('id')).is.not.null;
                done();
            } catch(e) {
                done(e);
            }            
        });        
    });
    
    it('update model',function(done){
        factory.onReady(async ()=>{
            try {
                var user:User = <User>(await (new User).all().where('street_address','=','123 fake street',true).fetchModels()).first();
                user.updateColumn('email','test2@email.com');
                var result = await user.save();
                expect(result).to.be.a("boolean");
                expect(result).to.be.true;
                done();
            } catch(e) {
                done(e);
            }            
        });        
    });
    
    it('delete model',function(done){
        factory.onReady(async ()=>{
            try {
                var user:User = <User>(await (new User).all().where('street_address','=','123 fake street',true).fetchModels()).first();
                
                var result = await user.delete();
                expect(result).to.be.a("boolean");
                expect(result).to.be.true;
                done();
            } catch(e) {
                done(e);
            }            
        });        
    });

    it('fetch relation tests',function(done){
        factory.onReady(async ()=>{
            try {
                var user:User = <User>(await (new User).find(1));
                expect(user).to.not.be.null;
                expect(user).to.be.instanceOf(User);

                //belongs to
                var city:City = <City>(await user.city().getResult());
                expect(city).to.not.be.null;
                expect(city).to.be.instanceOf(City);
                expect(city.getColumn('id')).to.equal(user.getColumn('city_id'));

                //has many
                var cityUsers:ModelCollection = await city.users().getResults();
                expect(cityUsers).to.not.be.null;
                expect(cityUsers).to.be.instanceOf(ModelCollection);
                for(var model of cityUsers) {
                    expect(model.getColumn('city_id')).to.equal(city.getColumn('id'));
                }

                //has one
                var settings:UserSettings = <UserSettings>await user.settings().getResult();
                expect(settings).to.not.be.null;
                expect(settings).to.be.instanceOf(UserSettings);
                expect(settings.getColumn('user_id')).to.be.equal(user.getColumn('id'));
                
                //belongs to many
                var userParties:ModelCollection = await user.parties().getResults();
                expect(userParties).to.not.be.null;
                expect(userParties).to.be.instanceOf(ModelCollection);
                for(var model of userParties) {
                    expect(model.getAdditionalColumn('user_id')).to.equal(user.getColumn('id'));
                }

                //query relationship
                var cityUsersQuery : iSQL = city.users().getQuery();
                cityUsersQuery.where('first_name','LIKE','%e%',true);
                cityUsers = await cityUsersQuery.fetchModels();
                for(var cityUser of cityUsers) {
                    expect(cityUser.getColumn('first_name').toLowerCase()).to.contain("e");
                }

                done();
            } catch(e) {
                done(e);
            }            
        });
    });
    
    it('update belongs to many relation test',function(done){
        factory.onReady(async ()=>{
            try {
                var user:User = <User>(await (new User).find(1));
                expect(user).to.not.be.null;
                expect(user).to.be.instanceOf(User);
                
                //belongs to many
                var userParties:ModelCollection = await user.parties().getResults();
                expect(userParties).to.not.be.null;
                expect(userParties).to.be.instanceOf(ModelCollection);
                for(var model of userParties) {
                    var result = await user.parties().update(model.getColumn('id'),{
                        'accepted': 1
                    });
                    expect(result).to.be.instanceOf(SQLResult);
                    expect(result).to.contain.keys(["rows_affected"]);
                    result = await user.parties().update(model.getColumn('id'),{
                        'accepted': 0
                    });
                }
                done();
            } catch(e) {
                done(e);
            }            
        });
    });

    it('should eagerload different types of relationship',function(done) {
        factory.onReady(async()=>{
            try {
                var user:User = <User>(await (new User).find(1));
                await user.eagerLoad(new Map([
                    ["city.users",(q)=>{
                        q.where("users.id","=",1,true);
                        return q;
                    }],
                    ["settings",(q)=>{return q;}],
                    ["parties",(q)=>{return q;}],
                ]));
                let city:City = user.getRelation("city");
                expect(city).to.be.instanceOf(City);
                let users:ModelCollection = city.getRelation("users");
                expect(users).to.be.instanceOf(ModelCollection);
                expect(users.getModels().length).to.eq(1);
                expect(users.first().getColumn("id")).to.eq(1);
                let settings:UserSettings = user.getRelation("settings");
                expect(settings).to.be.instanceOf(UserSettings);

                let parties:ModelCollection = user.getRelation("parties");
                expect(parties).to.be.instanceOf(ModelCollection);
                expect(parties.first()).to.be.instanceOf(Party);
                expect(parties.first().getAdditionalColumns()).to.contain.keys("user_id","party_id","accepted");
                expect(parties.first().getAdditionalColumns()['user_id']).to.eq(1);
                done();
            } catch(e) {
                done(e);
            }
        })
    });

    it('should set visible columns',function(done) {
        factory.onReady(async ()=>{
            try {
                let user:User = <User>await (new User()).find(1);
                user.setVisibleColumns([
                    "id",
                    "first_name"
                ]);
                let userData = user.toJSON();
                expect(userData).to.be.an("object");
                expect(userData).to.contain.keys("id","first_name");
                expect(Object.keys(userData)).to.be.length(2);
                done();
            } catch(e) {
                done(e);
            }
            
        })
    });
    
    it('should set visible columns when eagerloading',function(done) {
        factory.onReady(async ()=>{
            try {
                let user:User = <User>(await (new User).find(1));
                await user.eagerLoad(new Map([
                    ["city",(q)=>{
                        q.removeCol("cities.city");
                        return q;
                    }],
                    ["city.users",(q)=>{
                        q.removeCol("users.id");
                        return q;
                    }],
                    ["settings",(q)=>{
                        q.removeCol("user_settings.id");
                        return q;
                    }],
                    ["parties",(q)=>{
                        q.removeCol("parties.id");
                        q.removeCol("accepted");
                        return q;
                    }],
                ]));
                let userData = user.toJSON();
                let cityData:object = userData['city'];
                expect(Object.keys(cityData)).length.greaterThan(0);
                expect(cityData).to.not.contain.keys("city");
                let cityUser:object = cityData['users'][0];
                expect(Object.keys(cityUser)).length.greaterThan(0);
                expect(cityUser).to.not.contain.keys("id");
                let settingsData:object = userData['settings'];
                expect(Object.keys(settingsData)).length.greaterThan(0);
                expect(settingsData).to.not.contain.keys('id');
                let partyData:object = userData['parties'][0];
                expect(Object.keys(partyData)).length.greaterThan(0);
                expect(partyData).to.not.contain.keys("id","accepted");
                done();
            } catch(e) {
                done(e);
            }
            
        })
    });
})