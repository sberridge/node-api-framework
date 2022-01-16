import { iSQL } from './interface/SQLInterface';


export class MultiQuery {
    private queries:Map<string, iSQL>;
    private results = {};
    private completedQueries = 0;
    private type: MultiQuery.Type;
    
    constructor(queries:Map<string, iSQL>,type:MultiQuery.Type=MultiQuery.Type.Fetch) {
        this.queries = queries;
        for(let key of queries.keys()) {
            this.results[key] = null;
        }
        this.type = type;
        
    }

    private execute(key:string):Promise<void> {
        return new Promise((resolve,reject)=>{
            (():any=>{
                switch(this.type) {
                    case MultiQuery.Type.Fetch:
                        return (<iSQL>this.queries.get(key)).fetch();
                    case MultiQuery.Type.FetchModels:
                        return (<iSQL>this.queries.get(key)).fetchModels();
                    case MultiQuery.Type.Save:
                        return (<iSQL>this.queries.get(key)).save();
                    case MultiQuery.Type.Delete:
                        return (<iSQL>this.queries.get(key)).delete();
                }
            })().then((result)=>{
                this.results[key] = result;
                this.completedQueries++;
                resolve();
            }).catch(e=>{
                reject(e);
            });
        });
    }

    public run() {
        return new Promise((resolve,reject)=>{
            for(let key of this.queries.keys()) {
                this.execute(key).then(()=>{
                    if(this.completedQueries === this.queries.size) {
                        resolve(this.results);
                    }
                });
            }
        });        
    }
};

export namespace MultiQuery {
    export enum Type {
        Fetch,
        FetchModels,
        Save,
        Delete
    }
}