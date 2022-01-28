import { NextFunction, Request, Response } from "express";
import { JWT } from "./../library/authentication/JWT";
import { ResponseGenerator } from "./../library/ResponseGenerator";

var JWTLib: JWT = require('../library/authentication/JWT');
export function AuthFilter(req:Request,res:Response,next:NextFunction) {
    var jwtPayload = JWTLib.verify(req);
    if(jwtPayload === null) {
        return res.status(403).json(ResponseGenerator.authentication());
    } else {
        req['currentUser'] = jwtPayload;
    }
    next();
};