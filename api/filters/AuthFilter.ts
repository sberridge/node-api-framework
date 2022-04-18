import { NextFunction, Request, Response } from "express";
import { JWT } from "./../library/authentication/JWT";
import { ResponseGenerator } from "./../library/ResponseGenerator";

export function AuthFilter(req:Request,res:Response,next:NextFunction) {
    var jwtPayload = JWT.getInstance().verify(req);
    if(jwtPayload === null) {
        return res.status(403).json(ResponseGenerator.authentication());
    } else {
        (req as any)['currentUser'] = jwtPayload;
    }
    next();
};