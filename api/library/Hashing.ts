'use strict';

import * as bcrypt from 'bcrypt';

export class Hashing {
    static async hash(str:string):Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(str,salt);
    }

    static async compare(str:string, hash:string):Promise<boolean> {
        return await bcrypt.compare(str, hash);
    }
}