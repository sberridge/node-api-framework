'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import {User} from '../models/User';
import {WSControl} from './../library/websockets/WSControl';
import {JWT} from './../library/authentication/JWT';
const ws:WSControl = require('./../library/websockets/WSControlFactory');


exports.fake_auth = async function(req:Request, res:Response, next:NextFunction) {
    JWT.getInstance().sign({
        "user_id": "123"
    }, req);
    res.json(ResponseGenerator.success("done"));
    next();
};

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    const authData = JWT.getInstance().verify(req);
    if(authData) {
        ws.send(authData['user_id'], {
            "message": "you called get_users"
        });
    }
    let getUsers = (new User()).all();
    let pagination  = await getUsers.paginate(10,1);
    let totalRows = pagination.total_rows;
    res.json(ResponseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};