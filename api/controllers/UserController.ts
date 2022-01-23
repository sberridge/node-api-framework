'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import {User} from '../models/User';
import { DataAccessFactory } from './../library/data-access/factory';
const factory:DataAccessFactory = require('./../library/data-access/factory');

var responseGenerator:ResponseGenerator = require('./../library/ResponseGenerator');

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    let db = factory.create('post');
    let fromSub = db.newQuery();
    fromSub.table("users");
    fromSub.cols(["*"]);
    fromSub.where("id","=",10,true);

    db.table(fromSub, "users");
    db.cols(["*"]);
    db.join("posts",(q)=>{
        q.on("users.id","=","posts.user_id",false);
        q.on("users.id","=",4,true);
        return q;
    });
    db.leftJoin("posts p2", "users.id", "p2.user_id");

    let sub = db.newQuery();
    sub.table("posts");
    sub.cols(["user_id"]);
    sub.where("user_id","=",5,true);

    db.leftJoin(sub,"p3",(q)=>{
        q.on("users.id","=","p3.user_id",false);
        q.on("p3.user_id","=",6,true);
        return q;
    })

    db.where("users.id","=",7,true);
    db.fetch().then(res=>{
        console.log(res);
    })

    
    let getUsers = (new User()).all();
    let pagination  = await getUsers.paginate(10,1);
    let totalRows = pagination.total_rows;
    res.json(responseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};