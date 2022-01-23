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