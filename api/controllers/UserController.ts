'use strict';
import { NextFunction, Request, Response } from 'express';
import { ResponseGenerator } from './../library/ResponseGenerator';
import {User} from '../models/User';
import {DataAccessFactory} from '../library/data-access/factory';
const factory:DataAccessFactory = require('./../library/data-access/factory');

exports.get_users = async function(req:Request, res:Response, next:NextFunction) {
    let d = factory.create('postgres');
    d.table("users");
    d.cols(["*"]);
    let sub = d.newQuery();
    sub.table("posts");
    sub.cols(["*"]);
    d.join(sub,"posts",(q)=>{
        q.on("posts.user_id", "=", "users.id");
        q.on("posts.table","=","dfg",true);
        return q;
    });
    let a = await d.fetch();
    console.log(a);
    let getUsers = (new User()).all();
    let pagination  = await getUsers.paginate(10,1);
    let totalRows = pagination.total_rows;
    res.json(ResponseGenerator.success((await getUsers.fetchModels()).toJSON(), totalRows));
    next();
};