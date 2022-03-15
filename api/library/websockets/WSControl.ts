import { WebSocket } from "ws";
export class WSUser {
    public ws:WebSocket;
    public user;
    constructor(ws:WebSocket,user) {
        this.ws = ws;
        this.user = user;
    }
}
export class WSControl {
    private websockets:Map<string,WSUser> = new Map;
    private static instance: WSControl = null;
    private constructor() {

    }
    public static getInstance() {
        if(WSControl.instance === null) {
            WSControl.instance = new WSControl;
        }
        return WSControl.instance;
    }
    public setUser(key:string, wsUser: WSUser) {
        this.websockets.set(key,wsUser);
        
    }
    public getUser(key:string): WSUser {
        if(this.websockets.has(key)) {
            return this.websockets.get(key);
        }
        return null;
    }
    public removeUser(key:string) {
        if(this.websockets.has(key)) {
            return this.websockets.delete(key);
        }
        return false;
    }
    public forEach(cb:(WSUser:WSUser,id:string)=>void) {
        this.websockets.forEach((v,key)=>{
            cb(v,key);
        });
    }
    public send(token:string,body:object) {
        let user : WSUser = this.getUser(token);
        if(user) {
            user.ws.send(JSON.stringify(body));
        }
    }
    public sendToAll(body:object) {
        this.forEach((v,k)=>{
            this.send(k,body);
        });
    }
}