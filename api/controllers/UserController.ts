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
    sub.table("posts");
    sub.cols(["user_id"])
    sub.where("user_id","=",5,true);
    let sub2 = db.newQuery();
    sub2.table("posts");
    sub2.cols(["user_id"])
    sub2.where("user_id","=",5,true);
    db.table('users');
    db.whereIn("id",sub);
    db.whereIn("id",sub2);
    db.where("id","=",5,true);
    db.cols(["*"]);
    db.fetch().then((result)=>{
        console.log(result);        
    });

    
    let getUsers = (new User()).all();
    let pagination  = await getUsers.paginate(10,1);
    let totalRows = pagination.total_rows;
    res.json(responseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};