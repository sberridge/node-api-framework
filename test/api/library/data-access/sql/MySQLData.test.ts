import SQLResult from "./../../../../../api/library/data-access/sql/SQLResult";
import DataAccessFactory from "./../../../../../api/library/data-access/factory";
import MySQLData from "./../../../../../api/library/data-access/sql/MySQLData";
import iSQL from "./../../../../../api/library/data-access/sql/interface/SQLInterface";


let db:iSQL;

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
        db.table("users");
        expect(db["tableName"]).toEqual("users");
    });

    it('should set and escape columns',()=>{
        const expected = [
            "id",
            "name",
            "`table`"
        ];
        db.cols(["id","name","table"]);
        (db["selectColumns"] as string[]).forEach((col:string, i)=>{
            expect(col).toEqual(expected[i]);
        });
    });

    it('should add and escape additional column',()=>{
        db.cols(["id","name","table"]);
        db.addCol("table.join additional_field");
        db.addCol("table.field2");
        console.log(db["additionalColumns"], db["selectColumns"]);
    })



    it('should generate a basic select',()=>{
        db.table("users");
        db.cols(["*"]);
        const query = db.generateSelect();
        expect(query).toMatch(/SELECT \* FROM  users/);
    });
})

