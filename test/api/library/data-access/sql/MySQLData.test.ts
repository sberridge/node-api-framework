import SQLResult from "./../../../../../api/library/data-access/sql/SQLResult";
import DataAccessFactory from "./../../../../../api/library/data-access/factory";
import MySQLData from "./../../../../../api/library/data-access/sql/MySQLData";
import iSQL from "./../../../../../api/library/data-access/sql/interface/SQLInterface";


let db:iSQL | null;

beforeAll(()=>{
    jest.spyOn(MySQLData.prototype, "fetch").mockImplementation(()=>{
        return new Promise((resolve,reject)=>{
            let result = new SQLResult();
            result.success = true;
            result.rows = [
                {
                    "id": 1,
                    "name": "Steve"
                }
            ];
            resolve(result);
        });        
    });
    db = DataAccessFactory.getInstance().create('test');
});

describe("MySQLData Tests", ()=>{
    
    it('should set tableName',()=>{
        if(!db) return;
        db.table("users");
        expect((db as any)["tableName"]).toEqual("users");
    });

    it('should set and escape columns',()=>{
        if(!db) return;
        const expected = [
            "id",
            "name",
            "`table`"
        ];
        db.cols(["id","name","table"]);
        ((db as any)["selectColumns"] as string[]).forEach((col:string, i)=>{
            expect(col).toEqual(expected[i]);
        });
    });

    it('should add and escape additional column',()=>{
        if(!db) return;
        db.cols(["id","name","table"]);
        db.addCol("table.join additional_field");
        db.addCol("table.field2");

        const expectedCols = [
            "id",
            "name",
            "`table`",
            "`table`.`join` additional_field",
            "`table`.field2"
        ];
        const expectedAdditional = [
            "additional_field",
            "field2"
        ];
        ((db as any)["selectColumns"] as string[]).forEach((col,i)=>{
            expect(col).toEqual(expectedCols[i]);
        });
        ((db as any)["additionalColumns"] as string[]).forEach((col,i)=>{
            expect(col).toEqual(expectedAdditional[i]);
        });
    });



    it('should generate a basic select',()=>{
        if(!db) return;
        db.table("users");
        db.cols(["*"]);
        const query = db.generateSelect();
        expect(query).toMatch(/SELECT \* FROM  users/);
    });

    it('should generate a query to check if a table exists',()=>{
        const query:MySQLData = (db as any)["generateDoesTableExistQuery"]("table");
        expect(query.generateSelect()).toMatch(/SELECT +COUNT\(\*\) +num FROM +information_schema.TABLES +WHERE +TABLE_SCHEMA += +\? +AND +TABLE_NAME += +\? +/);
    });

    it('should generate a query to check if a column exists', ()=>{
        const query:MySQLData = (db as any)["generateDoesColumnExistQuery"]("table", "column");
        expect(query.generateSelect()).toMatch(/SELECT +COUNT\(\*\) +num FROM +information_schema.COLUMNS +WHERE +TABLE_SCHEMA += +\? +AND +TABLE_NAME += +\? +AND +COLUMN_NAME += +\? +/);
    });
    
    it('should generate a query to check if a trigger exists', ()=>{
        const query:MySQLData = (db as any)["generateDoesTriggerExistQuery"]("trigger_name");
        expect(query.generateSelect()).toMatch(/SELECT +COUNT\(\*\) +num FROM +information_schema.TRIGGERS +WHERE +TRIGGER_SCHEMA += +\? +AND +TRIGGER_NAME += +\? +/);
    });
})

