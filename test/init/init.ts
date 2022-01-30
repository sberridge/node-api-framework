import { init as init_mysql } from './init_scripts/init_mysql';
import { init as init_mssql } from './init_scripts/init_mssql';
import { init as init_postgres } from './init_scripts/init_postgres';

(async ()=>{
    await init_mysql();
    await init_mssql();
    await init_postgres();
})();
