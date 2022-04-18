import MySQLData from './sql/MySQLData';
import MSSQLData from './sql/MSSQLData';
import iSQL from './sql/interface/SQLInterface';
import Config from './../Config';
import ConnectionConfig from './sql/interface/SQLConnectionConfig';
import PostgresData from './sql/PostgresData';

export default class DataAccessFactory {
    private config:{[key:string]: ConnectionConfig} = Config.get().databases.sql;
    private ready:boolean = true;
    private readyFuncs = [];
    private static instance:DataAccessFactory|null = null;
    private constructor() {
    }
    public static getInstance() {
        if(DataAccessFactory.instance == null) {
            DataAccessFactory.instance = new DataAccessFactory();
        }
        return DataAccessFactory.instance;
    }
    private getConnectionConfig(configKey: keyof typeof this.config): ConnectionConfig {
        let connectionConfig:ConnectionConfig = {
            host: "",
            name: ""
        };
        if(!(configKey in this.config)) {
            return connectionConfig
        }
        var config = this.config[configKey];
        connectionConfig = config;
        
        connectionConfig.name = configKey.toString();
        return connectionConfig
    }
    public create(configKey : string):iSQL | null {
        const connectionConfig = this.getConnectionConfig(configKey as keyof typeof this.config);
        switch(connectionConfig.type) {
            case "MySQL":
                return new MySQLData(connectionConfig);
            case "MSSQL":
                return new MSSQLData(connectionConfig);
            case "Postgres":
                return new PostgresData(connectionConfig);
        }
        return null;
    }
    public addConfig(name:string,config:ConnectionConfig) {
        this.config[name] = config;
    }
    public async removeConfig(name:string):Promise<boolean> {
        if(!(name in this.config)) {
            return true;
        }
        let da = this.create(name);
        if(!da) return true;
        await da.closePool(name);
        delete this.config[name];
        return true;
    }
    public hasConfig(name:string):boolean {
        return (name in this.config);
    }
}