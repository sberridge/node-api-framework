import Config from "./Config";
import * as crypto from "crypto"
import Rijndael = require("rijndael-js");

export class Encryption {
    static encrypt(string:string): string {
        const iv = crypto.randomBytes(16);
        const secret = Config.get().encryption_key;
        const hash = crypto.createHash('sha256')
                    .update(Buffer.from(secret,'utf8'))
                    .digest();
        const cipher = new Rijndael(hash,'cbc');        
        let cipherText = Buffer.from(cipher.encrypt(string,"128",iv));

        return iv.toString("base64").replace("==","") + "==" + cipherText.toString("base64");
    }

    static decrypt(string:string): string {
        const secret = Config.get().encryption_key;
        const iv = string.split('==');
        let ivStr = iv[0];
        ivStr += "==";
        string = (ivStr.length == 3 ? iv[1] + '==' : iv[1]);

        const hash = crypto.createHash('sha256')
                    .update(Buffer.from(secret,'utf8'))
                    .digest();

        const cipher = new Rijndael(hash,'cbc');
        const cipherString = Buffer.from(string,'base64')
        return Buffer.from(cipher.decrypt(cipherString,"128",Buffer.from(ivStr,'base64'))).toString().trim();
    }
}