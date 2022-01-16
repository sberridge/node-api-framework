var fs = require('fs');
import {MySQLData} from './sql/MySQLData';
import {MSSQLData} from './sql/MSSQLData';
import { iSQL } from './sql/interface/SQLInterface';
import { Config } from './../Config';
import { ConnectionConfig } from './sql/interface/SQLConnectionConfig';

export class DataAccessFactory {
    private config;
    private ready:boolean = false;
    private readyFuncs = [];
    constructor() {
        this.ready = true;
        let sqlConfig = Config.get().databases.sql;
        this.config = sqlConfig;
        this.readyFuncs.forEach((func)=>{
            func();
        });
    }
    public create(configKey : string):iSQL {
        let connectionConfig:ConnectionConfig = {};
        
        var config = this.config[configKey];
        [
            "type",
            "host",
            "port",
            "database",
            "user",
            "password",
            "name"
        ].forEach(f=>{
            if(f in config) {
                connectionConfig[f] = config[f];
            }
        });
        connectionConfig.name = configKey;
        switch(config.type) {
            case "MySQL":
                return new MySQLData(connectionConfig);
            case "MSSQL":
                return new MSSQLData(connectionConfig);
        }
    }
    public onReady(func) {
        this.readyFuncs.push(func);
        if(this.ready) {
            func();
        }
    }
    public addConfig(name:string,config:ConnectionConfig) {
        this.config[name] = config;
    }
    public async removeConfig(name:string):Promise<boolean> {
        if(!(name in this.config)) {
            return true;
        }
        let da = this.create(name);
        await da.closePool(name);
        delete this.config[name];
        return true;
    }
    public hasConfig(name):boolean {
        return (name in this.config);
    }
}
module.exports = new DataAccessFactory();