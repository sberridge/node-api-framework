'use strict';
import {Request} from 'express';
import {WSUser, WSControl} from '../library/websockets/WSControl'
import { JWT } from './../library/authentication/JWT';
import expressWs = require('express-ws');
const WSController:WSControl = WSControl.getInstance();

var WSUserID = 0;


module.exports = function(app:expressWs.Application) {
    
    app.ws('/ws',(ws,req:Request)=>{

      let isAlive = true
      
      isAlive = true;

      const authData = JWT.getInstance().verify(req);

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
        isAlive = true;
      });

      var pingTimeout = setInterval(()=>{
        if(!isAlive) {
          clearTimeout(pingTimeout);
          return ws.close();
        }
        isAlive = false;
        ws.ping(()=>{});
      },30000);
    });
    
    
};