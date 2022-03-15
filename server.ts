import { Express, NextFunction, Request, Response } from "express";
import { Config } from "./api/library/Config";

var session = require('cookie-session');
var express = require('express'),
  expressWs = require('express-ws'),
  cors = require('cors'),
  app: Express = express(),
  port = process.env.PORT || 3000,
  bodyParser = require('body-parser');

expressWs(app);
var ses = session({
  name: 'session',
  resave: false,
  saveUninitialized: false,
  secret: Config.get().session_secret,
  cookie: {
    sameSite: "lax",
    httpOnly: true
  }
});

app.use(ses);
app.use(bodyParser.urlencoded({"extended": true}));
app.use(bodyParser.json());
var originsWhitelist = Config.get().whitelisted_domains;
var corsOptions = {
  origin: function(origin, callback){
        var isWhitelisted = originsWhitelist.indexOf(origin) !== -1;
        callback(null, isWhitelisted);
  },
  credentials:true
}

app.use(cors(corsOptions));

app.use(function(req:Request,res:Response,next:NextFunction) {
  next();
});






/**
 * IMPORT ROUTES HERE
 */

require('./api/routes/UserRoutes')(app);

require('./api/routes/WebSocketRoutes')(app);





app.use(function(req,res,next) {
  //do something after the request
  //need to run next() in controller to run this
  next();
});

app.listen(port);


console.log('RESTful API server started on: ' + port);
