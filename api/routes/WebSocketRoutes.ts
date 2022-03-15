'use strict';
import {Express, Request} from 'express';
import {WSUser, WSControl} from '../library/websockets/WSControl'
import { JWT } from './../library/authentication/JWT';
const WSController:WSControl = require("./../library/websockets/WSControlFactory");

const JWTLib: JWT = require('../library/authentication/JWT');

var WSUserID = 0;


module.exports = function(app:Express) {
    
    app['ws']('/ws',(ws,req:Request)=>{
      
      ws.isAlive = true;

      const authData = JWTLib.verify(req);

      let user:WSUser = null;
      if(authData) {
        //authenticated
        user = new WSUser(ws, {
          "id": authData['user_id']
        });
      } else {
        //anonymous
        user = new WSUser(ws, {
          "id": WSUserID++
        });
      }

      WSController.forEach((ws,token)=>{
        WSController.send(token,{
          "action": "message",
          "message": `User connected: ${user.user.id}`
        });
      });
      
      WSController.setUser(user.user.id.toString(),user);      

      WSController.send(user.user.id.toString(),{
        "action": "message",
        "message": `hello ${user.user.id}`
      });


      ws.on('message',async (message:string)=>{
        var body:object = JSON.parse(message);
        WSController.forEach((ws:WSUser,token)=>{
            if(ws.user['id'] !== user.user.id) {
                WSController.send(token,body);
            }
            
        });
      });

      ws.on('close',(e)=>{
        WSController.removeUser(user.user.id.toString());
        WSController.forEach((ws:WSUser,token)=>{
          WSController.send(token,{
            "action": "message",
            "message": `User disconnected: ${user.user.id}`
          });
        })
      });

      
      ws.on('pong',()=>{
        ws.isAlive = true;
      });

      var pingTimeout = setInterval(()=>{
        if(!ws.isAlive) {
          clearTimeout(pingTimeout);
          return ws.close();
        }
        ws.isAlive = false;
        ws.ping(()=>{});
      },30000);
    });
    
    
};