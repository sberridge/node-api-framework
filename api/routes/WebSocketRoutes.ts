'use strict';
import {Express} from 'express';
import {WSUser, WSControl} from './../library/WSControl'
import { JWT } from './../library/authentication/JWT';
var WSController:WSControl = require("./../library/WSControl");

var JWTLib: JWT = require('../library/authentication/JWT');

var WSUserID = 0;


module.exports = function(app:Express) {
    
    app['ws']('/ws',(ws,req)=>{
      ws.isAlive = true;
      var thisUser = {
        "id": WSUserID++
      };
      WSController.forEach((ws,token)=>{
        WSController.send(token,{
          "action": "message",
          "message": "User connected: " + thisUser['id']
        });
      });
      
      WSController.setUser(thisUser['id'].toString(),new WSUser(ws,thisUser));
      
      ws.on('message',async (message:string)=>{
        var body:object = JSON.parse(message);
        WSController.forEach((ws:WSUser,token)=>{
            if(ws.user['id'] !== thisUser['id']) {
                WSController.send(token,body);
            }
            
        });
      });
      ws.on('close',(e)=>{
        WSController.removeUser(thisUser['id'].toString());
        WSController.forEach((ws:WSUser,token)=>{
          WSController.send(token,{
            "action": "message",
            "message": "User disconnected: " + thisUser['id']
          });
        })
      });

      WSController.send(thisUser['id'].toString(),{
        "action": "message",
        "message": 'hello ' + thisUser['id']
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