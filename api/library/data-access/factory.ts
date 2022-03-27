import {MySQLData} from './sql/MySQLData';
import {MSSQLData} from './sql/MSSQLData';
import { iSQL } from './sql/interface/SQLInterface';
import { Config } from './../Config';
import { ConnectionConfig } from './sql/interface/SQLConnectionConfig';
import { PostgresData } from './sql/PostgresData';

export default class DataAccessFactory {
    private config = Config.get().databases.sql;
    private ready:boolean = true;
    private readyFuncs = [];
    private static instance:DataAccessFactory = null;
    private constructor() {
    }
    public static getInstance() {
        if(DataAccessFactory.instance == null) {
            DataAccessFactory.instance = new DataAccessFactory();
        }
        return DataAccessFactory.instance;
    }
    private getConnectionConfig(configKey: string): ConnectionConfig {
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
        return connectionConfig
    }
    public create(configKey : string):iSQL {
        const connectionConfig = this.getConnectionConfig(configKey);
        switch(connectionConfig.type) {
            case "MySQL":
                return new MySQLData(connectionConfig);
            case "MSSQL":
                return new MSSQLData(connectionConfig);
            case "Postgres":
                return new PostgresData(connectionConfig);
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