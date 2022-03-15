import { Request } from "express";
import * as randomString from 'crypto-random-string';
import * as crypto from 'crypto';
export class JWT {
    private key: string
    constructor() {
        this.key= randomString({length:30,characters:"1234567890qwertyuiopasdfghjklzxcvbnm!$%#-="});
    }

    private base64URL(string:string) {
        return string.replace(/=*$/,'').replace(/\+/g,'-').replace(/\//,'_');
    }
    private base64(string:string) {
        return string.replace(/\-/g,'+').replace(/\_/,'/').padEnd(14,"=");
    }

    public sign(payload,req:Request): boolean {
        var header = this.base64URL(Buffer.from(JSON.stringify({
            alg: "HS256",
            typ: "JWT"
        })).toString("base64"));
        payload = this.base64URL(Buffer.from(JSON.stringify(payload)).toString("base64"));
        var signature = this.base64URL(crypto.createHmac('sha256',this.key).update(header + "." + payload).digest('base64'));
        
        req['session'].jwt = header + '.' + payload + '.' + signature;
        return true;
    }

    public verify(req:Request): object {
        if("jwt" in req['session']) {
            var jwtParts = req['session'].jwt.split(".");
            if(jwtParts.length != 3) {
                return null;
            }

            var header = Buffer.from(this.base64(jwtParts[0]),"base64").toString("utf8");
            try {
                header = JSON.parse(header);
            } catch(e) {
                return null;
            }

            var payloadString = Buffer.from(this.base64(jwtParts[1]),"base64").toString("utf8");
            var payload;
            try {
                payload = JSON.parse(payloadString);
            } catch(e) {
                return null;
            }        
            
            var signature = this.base64URL(crypto.createHmac('sha256',this.key).update(jwtParts[0] + "." + jwtParts[1]).digest('base64'));
            if(signature !== jwtParts[2]) {
                return null;
            }

            return payload;
        } else {
            return null;
        }
        
    }
}


module.exports = new JWT()