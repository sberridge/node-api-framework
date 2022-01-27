# NodeJS Framework

NodeJS API Server Framework

## Installation Instructions

With NodeJS and NPM installed run "npm install" in the root folder

Run "npm start" to start the server.

Run "npm test" to run unit tests located in "/test".

## Configuration

App configuration settings are stored in api/config.json

```json
{
    "session_secret": "random string",
    "encryption_key": "random string used in the encryption module",
    "whitelisted_domains": [
        //list of domains allowed to access the app
        "http://localhost"
    ],
    "databases": {
        "sql": {
            //connection settings for SQL databases (see Data Access below)
        }
    }
}
```
## Handling Requests

The framework is built on [Express.JS](https://expressjs.com/)

Route files should be added to the api/routes directory and imported into server.ts

*server.ts*
```typescript
/**
 * IMPORT ROUTES HERE
 */

require('./api/routes/UserRoutes')(app);
```

*api/routes/UserRoutes.ts*
```typescript
'use strict';
import { Express } from "express";

import { AuthFilter} from './../filters/AuthFilter';

module.exports = function(app:Express) {
    const userController = require('../controllers/UserController');

    app.all('/users',AuthFilter);
    app.route('/users')
        .get(userController.get_users);
};
```

Controllers should be added to api/controllers and imported into the relevant route files.

*api/controllers/UserController.ts*
```typescript
'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
const responseGenerator:ResponseGenerator = require('./../library/ResponseGenerator');

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    res.json(responseGenerator.success("It works!");
    next();
};
```

### Validation

Validation can be handled using the Validator module, this can be used to validate incoming data.

```typescript
import { Validator } from './../library/validation/Validator';

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {

    /**
     * {
     *      "user": {
     *          "name": "Bob",
     *          "awards": [
     *              {
     *                  "title": "Oscar"
     *              }
     *          ]
     *      }
     * }
     */
    let validator: Validator = new Validator(req.body);
    validator.validateRequired('user');
    validator.validateRequired('user.name');
    validator.validateArray('user.awards');
    validator.validateRequired('user.awards[].title');

    let validationResult = await validator.validate();
    if(!validator.success) {
        return res.json(responseGenerator.validation(validationResult));
    }

    res.json(responseGenerator.success("Valid!");
    next();
};
```

### Response Generation

Standardised responses can be generated using the ResponseGenerator module.

```typescript
'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import { Validator } from './../library/validation/Validator';
var responseGenerator:ResponseGenerator = require('./../library/ResponseGenerator');

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    /**
     * {
     *      "success": true
     *      "message": "message"
     * }
     */
    responseGenerator.success("message");

    /**
     * {
     *      "success": true,
     *      "rows": [
     *          {
     *              "name": "bob
     *          }
     *      ],
     *      "total_rows": 100
     * }
     */
    responseGenerator.success([
        {
            "name": "bob"
        }
    ], 100);


    /**
     * {
     *      "success": true,
     *      "row": {
     *          "name": "bob
     *      }      
     * }
     */
    responseGenerator.success({
        "name": "bob"
    });


    /**
     * {
     *      "success": false,
     *      "message": "message"      
     * }
     */
    responseGenerator.failure("message");



    let validator = new Validator({});
    validator.validateRequired("name");
    let validationResult = await validator.validate();

    /**
     * {
     *      "success": false,
     *      "validation": {
     *          "name": "required"
     *      }
     * }
     */
    responseGenerator.validation(validationResult);


    next();
};
```

### Authentication

Default authentication is handled in the api/filters/AuthFilter route filter using JWT (JSON Web Tokens).

To register a JWT with the client, you must first authenticate a user via a request to the API, and then sign a JWT with some identifiable information.

*api/controllers/UserController.ts*
```typescript

import { Hashing } from './../library/Hashing';
import { Validator } from './../library/validation/Validator';
import { JWT } from './../authentication/JWT'
const jwt:JWT = require('./../authentication/JWT');

exports.login = async function(req:Request, res:Result, next:NextFunction) {

    /**
     * Example validating and confirming credentials with the Hashing module (using bcrypt)
     */
    const requestBody = req.body;
    const validation = new Validator(requestBody);

    validation.validateRequired("username");
    validation.validateRequired("password");

    const validationResult = validation.validate();

    if(!validation.success) {
        return res.json(responseGenerator.validation(validationResult));
    }

    const userResults:ModelCollection = await (new User).all()
                                                    .where("username", "=", requestBody.username, true)
                                                    .fetchModels();

    const user:User = userResults.first();

    if(!user) {
        return res.json(responseGenerator.failure("Authentication failed"));
    }

    const validPassword = await Hashing.compare(requestBody.password, user.getColumn("password"));

    if(!validPassword) {
        return res.json(responseGenerator.failure("Authentication failed"));
    }

    // Sign and register JWT in the session with users ID
    jwt.sign({
        "user_id": user.getColumn("id")
    }, req);

    next();
}
```

You can then apply the AuthFilter to a route in order to verify the JWT and retrieve the signed data.

*api/routes/UserRoutes.ts*
```typescript
'use strict';
import { Express } from "express";

import { AuthFilter} from './../filters/AuthFilter';

module.exports = function(app:Express) {
    const userController = require('../controllers/UserController');

    //AuthFilter applied to all /user routes
    app.all('/users',AuthFilter);
    app.route('/users')
        .get(userController.get_users);
        
};
```

If the JWT is successfully verified, then the data will be available via the request object in the controller.

*api/routes/UserController.ts*
```typescript
exports.get_users = async function(req:Request, res:Response, next:NextFunction) {

    /**
     * {
     *      user_id: 1
     * }
     */
    const userData = req['currentUser'];

    res.json(responseGenerator.success("foo"));
    next();
};
```

## Data Access

The framework features a fairly extensive library for handling interactions with SQL databases.

### Configuring Database Connections

Database connections are configured within the "databases"."sql" section of the app config.

```json
{
    "databases": {
        "sql": {
            "my_database": {
                "type": "MySQL",
                "host": "localhost",
                "database": "test",
                "port": 3306,
                "user": "root",
                "password": ""
            }
        }
    }
}
```

You can have multiple database connections defined in the config, with each one being identified by it's key within the "sql" object.

For example, above we have a MySQL database identified by the name "my_database.

The "type" of the database determines which SQL driver will be used, the currently supported drivers are:

* MySQL
* Postgres
* MSSQL

### Connecting to the Database

The library features a "factory" style interface for initiating database connections with one of the predefined databases.

*assumed running from a controller*
```typescript
import { DataAccessFactory } from "./../library/data-access/factory";

//uses the singleton pattern to keep the factory contained to a single shared instance
const dataFactory:DataAccessFactory = require("./../library/data-access/factory");

exports.get_users = function(req:Request, res:Response, next:NextFunction) {

    //initiate a database connection using the create function with the name defined in the config
    const dataConnection = dataFactory.create("my_database");

    next();
}
```

### Selecting from a Table

```typescript
const dataConnection = dataFactory.create("my_database");

dataConnection.table("users");
dataConnection.cols([
    "id", 
    "name"
]);

dataConnection.fetch().then(result=>{
    if(!result.success) {
        return result.error;
    }
    const rows = result.rows;
    /**
     * [
     *      {
     *          "id": 1,
     *          "name": "Bob"
     *      }
     * ]
     */
    console.log(rows);
})
```

### Inserting Rows

The "insert" and "save" functions are used to create new database records.

```typescript
//insert single row
dataConnection.table("users")
    .insert({
        "name": "Bob"
    })
    .save().then(result=>{
        const rowsInserted: number = result.rows_affected;
        const insertId: number = result.insert_id;
    });

//insert multiple rows
dataConnection.table("users")
    .insert([
        {
            "name": "George"
        },
        {
            "name": "Lauren"
        }
    ])
    .save().then(result=>{
        const rowsInserted: number = result.rows_affected;
        const firstInsertedId: number = result.insert_id;
    })
```

#### Postgres and Auto Incrementing Fields

When inserting records into a table containing an auto incrementing field in a Postgres database, that field must be specified in order for it to be returned in the "insert_id" property of the result.

```typescript
dataConnection.table("users")
    .setIncrementingField("id")
    .insert({
        "name": "Bob"
    })
    .save().then(result=>{
        const rowsInserted: number = result.rows_affected;
        const insertId: number = result.insert_id;
    });
```

### Updating Records

Updating records is done in a similar fashion to inserting, except with using the "update" function rather than "insert".

The example below will update all records in the table. See "filtering" below to see how to add conditions.

```typescript
dataConnection.table("users")
    .update({
        "name": "Bob"
    })
    .save().then(result=>{
        const rowsUpdated: number = result.rows_affected;
    });
```

### Deleting Records

Deleting records can be done using the "delete" function.

The example below will delete all records in the table. See "filtering" below to see how to add conditions.

```typescript
dataConnection.table("users")
    .delete().then(result=>{
        const rowsDeleted: number = result.rows_affected;
    });
```

#### Filtering

Various "where" functions are available to filter the results of a fetch query.

##### Basic Where

```typescript
dataConnection.table("users");
dataConnection.cols([
    "id", 
    "name"
]);

//basic where clause
//field, comparison symbol, value, boolean to control whether or not to parametise the value or use as is
dataConnection.where("id", "=", 1, true);

dataConnection.where("id", "!=", 1, true);
dataConnection.where("id", ">", 1, true);
dataConnection.where("id", "<", 1, false);
dataConnection.where("id", "<=", 1, true);
dataConnection.where("id", ">=", 1, true);
dataConnection.where("id", "<>", 1, true);
dataConnection.where("id", "LIKE", 1, true);
dataConnection.where("id", "NOT LIKE", 1, false);

dataConnection.fetch().then(res=>{

})

/**
 * SELECT
 *  id, name
 * FROM users
 * WHERE
 *  id = ?
 * AND
 *  id > ?
 * AND
 *  id < 1
 * AND
 *  id <= ?
 * AND
 *  id >= ?
 * AND
 *  id <> ?
 * AND
 *  id LIKE ?
 * AND
 *  id NOT LIKE 1
 */
```

##### Where In

To check if a field matches a list of values, use the Where In function.

```typescript
//field, list of values to check against, boolean to determine whether or not the parametise the values 
dataConnection.whereIn("id", [1,2,3], true);

dataConnection.whereIn("id", [1,2,3], false);

/**
 * WHERE
 *  id IN (?, ?, ?)
 * AND
 *  id IN (1, 2, 3)
 */
```

###### Where In Sub Query

You can use the Where In function with a sub query to fetch rows matching the results of another query.

```typescript
//the newQuery function will start a new query on the same database
const subQuery = dataConnection.newQuery();

subQuery.table("users")
    .cols(["id"])
    .where("id", "=", 1, true);

dataConnection.whereIn("id", subQuery);

/**
 * WHERE IN (
 *  SELECT id FROM users WHERE id = ?
 * )
 */
```

##### Where Null

Do null comparisons using whereNull and whereNotNull

```typescript
dataConnection.whereNull("name");

dataConnection.whereNotNull("name");

/**
 * WHERE name IS NULL AND name IS NOT NULL
 */
```

##### Changing Logic

Logic can be switched between OR and AND using the appropriate function.

```typescript
dataConnection.where("id", "=", 1, true);
dataConnection.or();
dataConnection.where("id", "=", 2, true);
dataConnection.and();
dataConnection.where("active", "=", 1, true);

/**
 * WHERE id = ? OR id = ? AND active = ?
 */
```

##### Bracketing Logic

Some complex conditions may require the use of brackets, this can be accomplished with the bracket functions.

```typescript

dataConnection.openBracket();

dataConnection.where("id", "=", 1, true);

dataConnection.or();

dataConnection.where("id", "=", 2, true);

dataConnection.closeBracket();

dataConnection.and();

dataConnection.where("active", "=", 1, true);

/**
 * WHERE ( id = ? OR id = ? ) AND active = ?
 */
```

##### Weighted Where

"Weighted" wheres allow you to order results based on certain conditions, for example if you wanted to return all records matching a certain query first, followed by rows matching another query before finally returning all other rows.

Can be useful when implementing search logic.

This is accomplished using the weightedWhere functions.

```typescript
//results are assigned a value depending on whether or not they match the criteria
//field, comparison symbol, value, value to assign if matching, value to assign if not matching, boolean to control whether or not to parametise 
dataConnection.weightedWhere("name", "=", "CEO", 10, 5, true);
dataConnection.weightedWhere("name", "=", "CTO", 9, 5, true);
```

In the above example, users with the name "CEO" will be returned first, followed by users name "CTO", then all other users will follow.

###### Sub Weighted Where

You can supply a "sub weighted where" in the place of the 5th argument in order to apply if else style conditions, for example

```typescript
const secondCondition:WeightedCondition = dataConnection.subWeightedWhere("name", "=", "CTO", 9, 5, true);

dataConnection.weightedWhere("name", "=", "CEO", 10, secondCondition, true);
```

### Table Joins

#### Basic Joins
```typescript
dataConnection.join("posts", "users.id", "users.id");

dataConnection.leftJoin("hobbies", "users.id", "hobbies.user_id");
```

#### Sub Query Join

You can supply a sub query instead of a table name to perform a sub query join.

```typescript
const subQuery = dataConnection.newQuery();

subQuery.table("posts")
    .cols(["id", "message", "user_id"])
    .where("date", ">", "2022-01-01", true);

dataConnection.join(subQuery, "table_alias", "users.id", "table_alias.user_id");
```

#### Complex Join Conditions

All of the join varieties above allow for a callback to apply more complex conditions.

```typescript
dataConnection.join("posts", (query)=>{
    query.on("users.id", "=" "posts.user_id");

    query.openBracket();

    query.on("date", ">", "2022-01-01", true);
    query.or();
    query.on("featured", "=", 1, true);

    query.closeBracket();
})
```

### Ordering

```typescript
dataConnection.order("field", "asc");
dataConnection.order("field2", "desc");
```

### Limiting and Offsetting

```typescript
dataConnection.limit(10);
dataConnection.offset(10);
```

### Grouping

```typescript
dataConnection.group(["field1", "field2"]);
```

### Pagination

A pagination function exists for quick pagination of results.

```typescript
//per page, current page
const paginationResult = await dataConnection.paginate(10, 1);

const totalRows = paginationResult.total_rows;

const results = await dataConnection.fetch();


const rows = results.rows; //first 10 rows
```

### Counting Results

```typescript
const totalRows = await dataConnection.count();
```

### Streaming Results

For queries with larger datasets, it's often advantageous to stream the results.

```typescript
//stream the results 100 rows at a time
await dataConnection.stream(100, (results)=>{
    return new Promise((resolve, reject)=>{

        //when finished with the result set, resolve the promise

        resolve();
    })
});

//stream finished
```

## Modelling
Models are classes designed to handle logic for a single database table record.

The modal classes should be stored in api/models.

Below is an example of a simple "User" model.

*api/models/User.ts*
```typescript
import { BaseModel } from './../library/modelling/BaseModel';

export class User extends BaseModel {
    constructor() { 
        super("test", User.table, User.fields.id, Object.keys(User.fields));

        //if model is for a Postgres database then, if applicable, you will need to specify an auto incrementing field

        this.setIncrementingField(User.fields.id);

    }

    static table = "users";

    static fields = {
        "id": "id",
        "name": "name"
    }

}
```

All models should extend the library/modelling/BaseModel class which provides functionality with the underlying data access library.

The constructor should pass the name of the database, the table, the primary key of the table, and a list of table fields.

### Finding Records using Models

Once created, a model class can be used to interact with the database to perform actions such as fetching, creating, updating, and deleting records.

To find a record, you can use the "find" function on the model.

```typescript
import { User } from './../models/User';

const myUser = await (new User).find(1);

if(!myUser) {
    //error, user not found
}

const userName = myUser.getColumn("name");
```

You can also return multiple models.

```typescript
import { User } from './../models/User';

const modelCollection: ModelCollection = await (new User).all()
    .where("name","LIKE", "bob%", true)
    .fetchModels();

for(const user of modelCollection) {
    const thisUserName = user.getColumn("name");
}
```

If working with a lot of records, then the streamModels function can be used instead.

```typescript
await (new User).all()
    .where("name","LIKE", "bob%", true)
    .streamModels(100, (modelCollection)=>{
        return new Promise((resolve,reject)=>{
            for(let user of modelCollection) {
                //do something with user
            }
            resolve();
        });
    });
```

### Creating Records

Model classes can also be used to create new records

```typescript
let myUser = new User();

myUser.updateColumn("name", "Bob");
myUser.updateColumns({
    "address": "123 Fake Street",
    "postcode": "IE12 ASE"
});

let saved = await myUser.save(); //true or false
```

### Updating Records

To update a record, simply update the columns on an existing model, and then call the save function.

```typescript
let user = await (new User).find(1);

user.updateColumns({
    "name": "New name"
});

let saved = await user.save();
```

### Deleting Records

To delete a record, simply use the delete function on an existing model.

```typescript
let user = await (new User).find(1);

let deleted = await user.delete();
```

### Converting Models to JSON

It is usually the case that an API route is going to be returning data from the database, the modelling system can accommodate for this use case with the "toJSON" function which can be used on either an individual model, or a model collection.

*Individual Model*
```typescript
const json = user.toJSON();
/**
 * {
 *      "id": 1,
 *      "name": "Bob"
 * }
 */
```

*Model Collection*
```typescript
const json = users.toJSON();
/**
 * [
 *      {
 *          "id": 1,
 *          "name": "Bob"
 *      },
 *      {
 *          "id": 2,
 *          "name": "James"
 *      }
 * ]
 */
```

### Model Relationships
You can define relationships between different models in their respective classes to link records together

There are 4 relation types available:

* BelongsTo (Many to One)
* HasOne (One to One)
* HasMany (One to Many)
* BelongsToMany (Many to Many)

#### BelongsTo

BelongsTo defines a "Many to One" relationship, wherein this model belongs to a record which could own one or more records from this models table.

*api/models/User.ts*
```typescript
import { BaseModel } from './../library/modelling/BaseModel';
import { UserGroup } from './UserGroup';

export class User extends BaseModel {
    constructor() { 
        super("test", User.table, User.fields.id, Object.keys(User.fields));
    }

    static table = "users";

    static fields = {
        "id": "id",
        "name": "name",
        "user_group_id": "user_group_id"
    }

    public userGroup() {
        return this.belongsTo(UserGroup, User.fields.user_group_id);
    }

}
```

##### Use Relationship

```typescript
const user = <User>await (new User()).find(1);

const userGroup = await user.userGroup().getResult();

const groupName = userGroup.getColumn(UserGroup.fields.name);
```

#### HasOne

HasOne defines a "One to One" relationship, wherein this model ones a single record from another table.

```typescript
import { BaseModel } from './../library/modelling/BaseModel';
import { UserSettings } from './UserSettings';
export class User extends BaseModel {
    constructor() { 
        super("test", User.table, User.fields.id, Object.keys(User.fields));
    }

    static table = "users";

    static fields = {
        "id": "id",
        "name": "name"
    }

    public userSettings() {
        return this.hasOne(UserSettings, UserSettings.fields.user_id);
    }

}
```

##### Use Relationship

```typescript
const user = <User>await (new User()).find(1);

const userSettings = await user.userSettings().getResult();

const theme = userGroup.getColumn(UserSettings.fields.theme_name);
```

#### HasMany

HasMany defines a "One to Many" relationship, wherein this model ones a multiple records from another table.

This is essentially the opposite relationship to "BelongsTo"

```typescript
import { BaseModel } from './../library/modelling/BaseModel';
import { Hobby } from './Hobby';
export class User extends BaseModel {
    constructor() { 
        super("test", User.table, User.fields.id, Object.keys(User.fields));
    }

    static table = "users";

    static fields = {
        "id": "id",
        "name": "name"
    }

    public hobbies() {
        return this.hasMany(Hobby, Hobby.fields.user_id);
    }

}
```

##### Use Relationship

```typescript
const user = <User>await (new User()).find(1);

const userHobbies:ModelCollection = await user.hobbies().getResults();

for(const hobby of userHobbies) {
    const hobbyName = hobby.getColumn("hobby");
}
```

#### BelongsToMany

BelongsToMany defines a "Many to Many" relationship, where in this model owns multiple records from another table, and where the records in that table also own multiple records in *this* table.

BelongsToMany relationships are supported by a "link table" which joins records from one table with records from another.

*Table: users*
|field|type|
|-----|----|
|id|int|
|name|varchar|

*Table: events*
|field|type|
|-----|----|
|id|int|
|name|varchar|
|date|date|

*Table: user_event*
|field|type|
|-----|----|
|id|int|
|user_id|int|
|event_id|int|

Above we have three tables, a users table, an events table, and then a user_event table which links records from those tables together.

We can define this relationship in the User model like so:

```typescript
import { BaseModel } from './../library/modelling/BaseModel';
import { Event } from './Event';
export class User extends BaseModel {
    constructor() { 
        super("test", User.table, User.fields.id, Object.keys(User.fields));
    }

    static table = "users";

    static fields = {
        "id": "id",
        "name": "name"
    }

    public events() {
        return this.belongsToMany(Event, "user_event", "user_id", "event_id");
    }

}
```

##### Use Relationship

```typescript
const user = <User>await (new User()).find(1);

const userEvents:ModelCollection = await user.events().getResults();

for(const event of userEvents) {
    const eventDate = event.getColumn("date");
}
```

##### Link Columns

Since BelongsToMany relationships involve a link table, it can often be the case where additional information is stored in the link table which will also need to be returned.

These fields from the link table can also be set in the relationship so that they are returned as "additional columns".

*api/models/User.ts*
```typescript
public events() {
    let relationship = this.belongsToMany(Event, "user_event", "user_id", "event_id");
    relationship.setLinkColumns(["paid"]);
    return relationship;
}
```

It will then be possible to access these fields from the results of the relationship.

```typescript
const user = <User>await (new User()).find(1);

const userEvents:ModelCollection = await user.events().getResults();

for(const event of userEvents) {
    const paid:number = event.getAdditionalColumn("paid");
}
```

#### Manipulating Relationships

By default, by using a relationship you are going to return all of the related records.

You can change this by either adding constraints to the relationship within the model, or by adding constraints as you are using the relationship.

##### Add Constraints within Model

```typescript
public hobbies() {
    let relationship = this.hasMany(Hobby, Hobby.fields.user_id);

    //remove unneeded columns from the query and only return favourited hobbies
    relationship.getQuery()
        .removeCols([
            `${Hobby.table}.${Hobby.description}`
        ])
        .where("favourite", "=", 1, true);

    return relationship;
}
```

##### Adding Constraints After

```typescript
let userHobbiesRelation:BelongsToMany = user.hobbies();

userHobbiesRelation.getQuery()
    .removeCols([
        `${Hobby.table}.${Hobby.description}`
    ])
    .where("favourite", "=", 1, true);

const userEvents:ModelCollection = await userHobbiesRelation.getResults();
```

#### EagerLoading Relations
EagerLoading is a technique which allows for the efficient preloading of related records, this is useful for two purposes:

* Loading data for multiple models without having to fetch relations individually
* Loading data to be returned in the response


```typescript
const users:ModelCollection = await (new Users).all().FetchModels();

await users.eagerLoad(new Map([
    ["hobbies", (query)=>{
        query.where("favourite", "=", 1, true);
        return query;
    }],
    ["city.parties", (query)=>{
        query.where("parties.date", ">", "2022-01-01", true);
        return query;
    }]
]));

for(const user of users) {
    const hobbies = user.getRelation("hobbies");
    const city = user.getRelation("city");
    const cityParties = city.getRelation("parties");
}

/**
 * {
 *      "success": true,
 *      "rows": [
 *          {
 *              "id": 1,
 *              "name": "Bob",
 *              "hobbies": [
 *                  {
 *                      "id": 1,
 *                      "hobby": "Origami",
 *                      "favourite": 1
 *                  }
 *              ],
 *              "city": {
 *                  "id": 1,
 *                  "city": "Lisbon",
 *                  "parties": [
 *                      {
 *                          "id": 1,
 *                          "date": "2022-02-01"
 *                      }
 *                  ]
 *              }
 *          }
 *      ]
 * }
 */
return res.json(responseGenerator.success(users.toJSON(), totalRows));
```