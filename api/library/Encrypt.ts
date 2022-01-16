import { Config } from "./Config";
const crypto2 = require('crypto');
const Rijndael = require('rijndael-js');
module.exports = new (function() {
    this.encrypt = function(string) {

    };
    this.decrypt = function(string) {
        var secret = Config.get().encryption_key;
        let iv = string.split('==');
        let ivStr = iv[0];
        ivStr += "==";
        string = (ivStr.length == 3 ? iv[1] + '==' : iv[1]);

        var hash = crypto2.createHash('sha256')
                    .update(Buffer.from(secret,'utf8'))
                    .digest();


        let cipher = new Rijndael(hash,'cbc');
        let cipherString = Buffer.from(string,'base64')
        return Buffer.from(cipher.decrypt(cipherString,128,Buffer.from(ivStr,'base64'))).toString().trim();
    };
})