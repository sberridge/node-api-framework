'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import {User} from '../models/User';
import { DataAccessFactory } from './../library/data-access/factory';
const factory:DataAccessFactory = require('./../library/data-access/factory');

var responseGenerator:ResponseGenerator = require('./../library/ResponseGenerator');

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    let db = factory.create('post');
    let sub = db.newQuery();
    db.table('users');
    db.cols(["*"]);
    db.stream(1,(result)=>{
        return new Promise((res,rej)=>{
            console.log(result);    
            return res();
        })
        
    })

    
    let getUsers = (new User()).all();
    let pagination  = await getUsers.paginate(10,1);
    let totalRows = pagination.total_rows;
    res.json(responseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};