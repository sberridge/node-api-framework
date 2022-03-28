'use strict';
import { MultiQuery } from "../api/library/data-access/sql/MultiQuery";
import iSQL from "../api/library/data-access/sql/interface/SQLInterface";
import Query from "../api/library/data-access/sql/Query";
import SQLResult from "../api/library/data-access/sql/SQLResult";
import DataAccessFactory from "../api/library/data-access/factory";

var assert:Chai.Assert = require('chai').assert;
var should:Chai.Should = require('chai').should();
var expect:Chai.ExpectStatic = require('chai').expect;
var factory:DataAccessFactory = DataAccessFactory.getInstance();

describe('MSSQLTests',function(){
    
    it('can check if a db column exists',function(done) {
        factory.onReady(async ()=>{
            try {
                var db:iSQL = factory.create('mssql');
                var res = await db.doesColumnExist("users","title_id");
                expect(res).to.be.true;
                var db:iSQL = factory.create('mssql');
                var res = await db.doesColumnExist("users","foobar");
                expect(res).to.be.false;
                await db.closePools();
                done();
            } catch(e) {
                done(e); 
            }
        }); 
    });
    
    it('can check if a db table exists',function(done) {
        factory.onReady(async ()=>{
            try {
                var db:iSQL = factory.create('mssql');
                var res = await db.doesTableExist("users");
                expect(res).to.be.true;
                var db:iSQL = factory.create('mssql');
                var res = await db.doesTableExist("foobar");
                expect(res).to.be.false;
                await db.closePools();
                done();
            } catch(e) {
               done(e); 
            }
        })
    });
    
    it('select tests',function(done){
        factory.onReady(async ()=>{

            try {
                    //standard select with a join and limit
                    var db:iSQL = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.join('titles',"title_id","titles.id");
                    db.limit(10);
                    db.offset(0);
                    db.order("users.id","asc");
                    var selectQuery:string = db.generateSelect().trim();
                    var match = /^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+JOIN(?: )+titles(?: )+ON(?: )+title_id(?: )+\=(?: )+titles\.id(?: )+ORDER BY(?: )+users.id(?: )+asc(?: )+OFFSET 0 ROWS(?: )+FETCH NEXT 10 ROWS ONLY$/.test(selectQuery);            
                    assert.isTrue(match);
                    var results = await db.fetch();
                    assert.lengthOf(results.rows,10);
                    var result = results.rows[0];
                    expect(result).to.have.property('id'); 
                    
                    //standard select with a left join and limit
                    var db:iSQL = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.leftJoin('titles',"title_id","titles.id");
                    db.limit(10);
                    db.offset(0);
                    db.order("users.id","asc");
                    var selectQuery:string = db.generateSelect().trim();
                    var match = /^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+LEFT JOIN(?: )+titles(?: )+ON(?: )+title_id(?: )+\=(?: )+titles\.id(?: )+ORDER BY(?: )+users.id(?: )+asc(?: )+OFFSET 0 ROWS(?: )+FETCH NEXT 10 ROWS ONLY$/.test(selectQuery);            
                    assert.isTrue(match);
                    var results = await db.fetch();
                    assert.lengthOf(results.rows,10);
                    var result = results.rows[0];
                    expect(result).to.have.property('id');

                    //simple where's
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.where('city_id','=',1,true);
                    db.whereNull('country_id');
                    db.whereNotNull('gender_id');
                    db.whereIn('title_id',[1],true);
                    selectQuery = db.generateSelect().trim();
                    expect(selectQuery).to.match(/^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+WHERE(?: )+city_id(?: )+=(?: )+\@param1(?: )+AND(?: )+country_id(?: )+IS NULL(?: )+AND(?: )+gender_id(?: )+IS NOT NULL(?: )+AND(?: )+title_id IN (?: )+\(\@param2\)$/);
                    await db.fetch();

                    //where in with subquery
                    var sub:iSQL = factory.create('mssql');
                    sub.table('cities');
                    sub.cols(['id']);
                    sub.where('city','>','e',true);
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.whereIn('city_id',sub);
                    selectQuery = db.generateSelect().trim();
                    expect(selectQuery).to.match(/^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+WHERE(?: )+city_id(?: )+IN(?: )+\(SELECT(?: )+id(?: )+FROM(?: )+cities(?: )+WHERE(?: )+city(?: )+\>(?: )+\@param1(?: )+\)$/);
                    results = await db.fetch();
    
                    //subquery join test
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['users.id','users.first_name','getCities.city']);
                    var citiesDb:iSQL = factory.create('mssql');
                    citiesDb.table('cities');
                    citiesDb.cols(['id','city']);
                    citiesDb.where('city','LIKE','%wolv%',true);
                    db.join(citiesDb,'getCities','users.city_id','getCities.id');
                    selectQuery = db.generateSelect().trim();
                    expect(selectQuery).to.match(/^SELECT(?: )+users\.id,users\.first_name,getCities\.city(?: )+FROM(?: )+users(?: )+JOIN(?: )+\(SELECT(?: )+id,city(?: )+FROM(?: )+cities(?: )+WHERE(?: )+city(?: )+LIKE(?: )+\@param1(?: )+\)(?: )+getCities(?: )+ON(?: )+users\.city_id(?: )+=(?: )+getCities\.id$/);
                    results = await db.fetch();
                    
                    //subquery left join test
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['users.id','users.first_name','getCities.city']);
                    var citiesDb:iSQL = factory.create('mssql');
                    citiesDb.table('cities');
                    citiesDb.cols(['id','city']);
                    citiesDb.where('city','LIKE','%wolv%',true);
                    db.leftJoin(citiesDb,'getCities','users.city_id','getCities.id');
                    selectQuery = db.generateSelect().trim();
                    expect(selectQuery).to.match(/^SELECT(?: )+users\.id,users\.first_name,getCities\.city(?: )+FROM(?: )+users(?: )+LEFT JOIN(?: )+\(SELECT(?: )+id,city(?: )+FROM(?: )+cities(?: )+WHERE(?: )+city(?: )+LIKE(?: )+\@param1(?: )+\)(?: )+getCities(?: )+ON(?: )+users\.city_id(?: )+=(?: )+getCities\.id$/);
                    results = await db.fetch();
    
                    //brackets test
                    db = factory.create('mssql');
                    db.table('cities');
                    db.cols(['*']);
                    db.openBracket();
                    db.where('id','>',5,true);
                    db.closeBracket();
                    db.openBracket();
                    db.where('city','LIKE','derby',true);
                    db.or();
                    db.where('city','LIKE','%wolve%',true);
                    db.closeBracket();
                    selectQuery = db.generateSelect().trim();
                    selectQuery.should.match(/^SELECT(?: )+\*(?: )+FROM(?: )+cities(?: )+WHERE(?: )+\((?: )+id(?: )+\>(?: )+\@param1(?: )+\)(?: )+AND(?: )+\((?: )+city(?: )+LIKE(?: )+\@param2(?: )+OR(?: )+city(?: )+LIKE(?: )+\@param3(?: )+\)$/);
                    results = await db.fetch();
    
                    //select from subquery test
                    sub = factory.create('mssql');
                    sub.table('cities');
                    sub.cols(['*']);
                    sub.limit(2);
                    sub.offset(0);
                    sub.order("id","asc")
                    db = factory.create('mssql');
                    db.table(sub,'citySub');
                    db.cols(['*']);
                    selectQuery = db.generateSelect().trim();
                    selectQuery.should.match(/^SELECT(?: )+\*(?: )+FROM(?: )+\(SELECT(?: )+\*(?: )+FROM(?: )+cities(?: )+ORDER BY id asc(?: )+OFFSET 0 ROWS(?: )+FETCH NEXT 2 ROWS ONLY(?: )+\)(?: )+citySub$/);
                    results = await db.fetch();
                    
                    //group, order
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['COUNT(*) num','cities.id']);
                    db.join('cities','cities.id','users.city_id');
                    db.group(['cities.id']);
                    db.order('num', "desc");
                    selectQuery = db.generateSelect().trim();                    
                    expect(selectQuery).to.match(/^SELECT(?: )+COUNT\(\*\) num,cities\.id(?: )+FROM(?: )+users(?: )+JOIN(?: )+cities(?: )+ON(?: )+cities\.id(?: )+=(?: )+users\.city_id(?: )+GROUP BY(?: )+cities.id(?: )+ORDER BY(?: )+num(?: )+desc$/);
                    results = await db.fetch();
                    results.rows.reduce((cur,las)=> {
                        assert.isAtMost(las['num'],cur['num']);
                        return las;
                    });

                    //complex join
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.join('cities',(query:Query)=>{
                        query.on('cities.id','=','users.city_id');
                        query.on('cities.city','=','Derby',true);
                        return query;
                    });
                    selectQuery = db.generateSelect().trim();
                    selectQuery.should.match(/^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+JOIN(?: )+cities(?: )+ON(?: )+cities\.id(?: )+\=(?: )+users.city_id(?: )+AND(?: )+cities\.city(?: )+\=(?: )+\@param1$/);
                    results = await db.fetch();
                    
                    //complex left join
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    db.leftJoin('cities',(query:Query)=>{
                        query.on('cities.id','=','users.city_id');
                        query.on('cities.city','=','Derby',true);
                        return query;
                    });
                    selectQuery = db.generateSelect().trim();
                    selectQuery.should.match(/^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+LEFT JOIN(?: )+cities(?: )+ON(?: )+cities\.id(?: )+\=(?: )+users.city_id(?: )+AND(?: )+cities\.city(?: )+\=(?: )+\@param1$/);
                    results = await db.fetch();
                    
                    //count test
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    selectQuery = db.generateSelect().trim();
                    var num = await db.count();
                    num.should.be.a('number');

                    //paginate test
                    var paginateInfo = await db.paginate(10,2);
                    
                    db.order("users.id","asc");
                    expect(paginateInfo['total_rows']).to.equal(num);
                    selectQuery = db.generateSelect().trim();
                    selectQuery.should.match(/^SELECT(?: )+\*(?: )+FROM(?: )+users(?: )+ORDER BY users.id asc(?: )+OFFSET 10 ROWS(?: )+FETCH NEXT 10 ROWS ONLY$/);
                    results = await db.fetch();

                    //stream test
                    db = factory.create('mssql');
                    db.table('users');
                    db.cols(['*']);
                    var timesLooped = 0;
                    await db.stream(100,(records)=>{
                        return new Promise((res,rej)=>{
                            timesLooped++;
                            res(true);
                        });                        
                    });
                    expect(timesLooped).to.be.equal(10);   

                    //check if table exists
                    var exists:boolean = await db.doesTableExist('users');
                    expect(exists).to.be.true;
                    exists = await db.doesTableExist('noexist');
                    expect(exists).to.be.false;
                    
                    //check if column exists
                    exists = await db.doesColumnExist('users','city_id');
                    expect(exists).to.be.true;
                    exists = await db.doesColumnExist('users','foo');
                    expect(exists).to.be.false;

                    //raw query
                    db = factory.create('mssql');
                    result = await db.raw("SELECT * FROM users WHERE id = @param1",{"param1":1});
                    expect(result).to.be.instanceOf(SQLResult);                    
                    
                    //weighted query
                    const weightedQuery = () => {
                        let db = factory.create('mssql');
                        db.table('users');
                        db.cols(['*']);
                        db.join('cities','cities.id','users.city_id');
                        db.join('genders','genders.id','users.gender_id');
                        db.weightedWhere('cities.city','=','Derby',100,0,true);
                        db.weightedWhere('cities.city','=','Wolverhampton',50,db.subWeightedWhere("genders.gender","=","male",40,0,true),true);
                        db.whereIn('cities.city',["derby","Wolverhampton","Nottingham"], true);
                        return db;
                    }
                    
                    var results = await weightedQuery().fetch();
                    selectQuery = weightedQuery().generateSelect().trim();
                    expect(selectQuery).to.match(/^SELECT(?: )+\*,CASE WHEN(?: )+cities.city(?: )+=(?: )+\@param1(?: )+THEN(?: )+100(?: )+ELSE(?: )+0(?: )+END(?: )+\+(?: )+CASE WHEN(?: )+cities.city(?: )+=(?: )+\@param2(?: )+THEN(?: )+50(?: )+ELSE(?: )+CASE WHEN(?: )+genders.gender(?: )+=(?: )+\@param3(?: )+THEN(?: )+40(?: )+ELSE(?: )+0(?: )+END(?: )+END(?: )+__condition_weight__ FROM(?: )+users(?: )+JOIN(?: )+cities ON(?: )+cities.id =(?: )+users.city_id(?: )+JOIN(?: )+genders ON(?: )+genders.id =(?: )+users.gender_id(?: )+WHERE(?: )+cities.city(?: )+IN(?: )+\(@param4,@param5,@param6\)(?: )+ORDER BY __condition_weight__ desc/);
                    

                    //multi test
                    var multi1:iSQL = factory.create('mssql');
                    multi1.table('users');
                    multi1.cols(['*']);
                    multi1.limit(5);
                    
                    var multi2:iSQL = factory.create('mssql');
                    multi2.table('countries');
                    multi2.cols(['*']);
                    multi2.limit(5);
                    
                    var multi3:iSQL = factory.create('mssql');
                    multi3.table('cities');
                    multi3.cols(['*']);
                    multi3.limit(5);

                    var multiResults = await (new MultiQuery(new Map([
                        ["users", multi1],
                        ["countries", multi2],
                        ["cities", multi3]
                    ]))).run();
                    expect(multiResults).to.contain.keys(["users","countries","cities"]);

    
                    await db.closePools();                   
                    
    
                    done();
            }catch(e) {
                done(e);
            }
            
            
        });
        
    });
    
    it('insert test',function(done){
        factory.onReady(async ()=>{
            try {

                //insert single
                var db:iSQL = factory.create('mssql');
                db.table('users');
                db.insert({
                    "first_name": "steve",
                    "surname": "general",
                    "title_id": 1,
                    "email": "steve@general.com",
                    "gender_id": 1,
                    "date_of_birth": "2000-01-01 11:01:44",
                    "phone_number": "111",
                    "city_id": 1,
                    "country_id": 1,
                    "postcode": "DE64 23U",
                    "street_address": "12 Warrington Road"
                },true);
                var insertQuery = db.generateInsert().trim();     
                var match = /^INSERT(?: )+INTO(?: )+users(?: )+\(first_name,surname,title_id,email,gender_id,date_of_birth,phone_number,city_id,country_id,postcode,street_address\)(?: )+VALUES\(@param1,@param2,@param3,@param4,@param5,@param6,@param7,@param8,@param9,@param10,@param11\); SELECT IDENT_CURRENT\(\'users\'\) AS last_insert_id;$/.test(insertQuery);                
                assert.isTrue(match);                
                var result = await db.save();
                expect(result).to.be.instanceOf(SQLResult)
                expect(result).to.have.property("rows_affected");

                //insert multi
                var mult1:iSQL = factory.create('mssql');
                mult1.table('countries');
                mult1.insert({
                    "country": "France"
                },true);                
                var mult2:iSQL = factory.create('mssql');
                mult2.table('cities');
                mult2.insert({
                    "city": "Paris"
                },true);
                var multiResults = await (new MultiQuery(new Map([
                    ["country", mult1],
                    ["city", mult2]
                ]),MultiQuery.Type.Save)).run();
                expect(multiResults).to.contain.keys(["country","city"]);

                var multiRowInsert:iSQL = factory.create('mssql');
                multiRowInsert.table('cities');
                multiRowInsert.insert([
                    {
                        "city": "Hamburg"
                    },
                    {
                        "city": "Berlin"
                    }
                ],true);
                var multiInsertQuery = multiRowInsert.generateInsert();
                var match = /^INSERT(?: )+INTO(?: )+cities(?: )+\(city\)(?: )+VALUES\(@param1\),\(@param2\)$/.test(multiInsertQuery);                
                assert.isTrue(match);   

                var result = await multiRowInsert.save();


                await db.closePools();

                


                
                done();
            } catch(e) {
                done(e);
            }
            
        });
        
    });
    
    it('update test',function(done){
        factory.onReady(async ()=>{
            try {
                //update single
                var db:iSQL = factory.create('mssql');
                db.table('users');
                db.where('street_address','=','12 Warrington Road',true);
                db.where('email','=','steve@general.com',true);
                db.update({
                    "street_address": "122 Warrington Road"
                },true);                            
                var result = await db.save();                
                expect(result).to.be.instanceOf(SQLResult)
                expect(result).to.have.property("rows_affected");

                //update multi
                var mult1:iSQL = factory.create('mssql');
                mult1.table('countries');
                mult1.update({
                    "country": "Francais"
                },true);
                mult1.where('country','=','France',true);                
                var mult2:iSQL = factory.create('mssql');
                mult2.table('cities');
                mult2.update({
                    "city": "Parais"
                },true);
                mult2.where('city','=','Paris',true);
                var multiResults = await (new MultiQuery(new Map([
                    ['country', mult1],
                    ['city', mult2]
                ]),MultiQuery.Type.Save)).run();
                expect(multiResults).to.contain.keys(["country","city"]);

                await db.closePools();

                
                done();
            }catch(e) {
                done(e);
            }
            
        });
        
    });
    
    it('delete test',function(done){
        factory.onReady(async ()=>{

            try {
                //single delete
                var db:iSQL = factory.create('mssql');
                db.table('users');
                db.where('street_address','=','122 Warrington Road',true);
                db.where('email','=','steve@general.com',true);
                var result = await db.delete();                
                expect(result).to.be.instanceOf(SQLResult);
                expect(result).to.have.property("rows_affected");

                //multi delete
                var mult1:iSQL = factory.create('mssql');
                mult1.table('countries');
                mult1.where('country','=','Francais',true);                
                var mult2:iSQL = factory.create('mssql');
                mult2.table('cities');
                mult2.where('city','=','Parais',true);
                mult2.or();
                mult2.where('city','=','Berlin',true);
                mult2.or();
                mult2.where('city','=','Hamburg',true);
                var multiResults = await (new MultiQuery(new Map([
                    ['country', mult1],
                    ['city', mult2]
                ]),MultiQuery.Type.Delete)).run();
                expect(multiResults).to.contain.keys(["country","city"]);
                await db.closePools();

                
                done();
            }catch(e) {
                done(e);
            }           
            
        });        
    });
})