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