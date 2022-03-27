'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import {User} from '../models/User';
import {WSControl} from './../library/websockets/WSControl';
import {JWT} from './../library/authentication/JWT';
import { paginationURLQuery } from './types/ControllerTypes';
import { applyQueryPagination } from './functions/ControllerFunctions';
const ws:WSControl = WSControl.getInstance();


exports.fake_auth = async function(req:Request, res:Response, next:NextFunction) {
    JWT.getInstance().sign({
        "user_id": "123"
    }, req);
    res.json(ResponseGenerator.success("done"));
    next();
};

exports.get_users = async function(req:Request<{},{},{},paginationURLQuery>, res:Response, next:NextFunction) {

    const error = ()=>{
        return res.json(ResponseGenerator.failure("Something went wrong fetching the users list"));
    }

    const {query} = req;
    const authData = JWT.getInstance().verify(req);
    if(authData) {
        ws.send(authData['user_id'], {
            "message": "you called get_users"
        });
    }

    let getUsers = (new User()).all();
    const paginationResult = await applyQueryPagination(getUsers, query);
    if(!paginationResult.success) {
        return error();
    }
    
    let totalRows = paginationResult.result.total_rows;
    res.json(ResponseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};