import iSQL from '../data-access/sql/interface/SQLInterface';
import BaseModel from './BaseModel'
import iRelation from './relations/interface/RelationInterface';
export default class ModelCollection {
    private models: BaseModel[] = [];
    private index = 0;
    private modelIdHash:{[key:string|number]:BaseModel} = {};

    public add(model:BaseModel) {
        this.models.push(model);
        if(!(model.getColumn(model.getPrimaryKey()) in this.modelIdHash)) {
            this.modelIdHash[model.getColumn(model.getPrimaryKey())] = model;
        }
    }

    public getModels(): BaseModel[] {
        return this.models;
    }

    public find(id:string|number) {
        if(id in this.modelIdHash) {
            return this.modelIdHash[id];
        }
        return null;
    }

    public first(): BaseModel | null {
        if(this.models.length > 0) {
            return this.models[0];
        }
        return null;
    }

    public toList(): {[key:string]:any}[] {
        var returnArr: {[key:string]:any}[] = [];
        this.models.forEach(element => {
            returnArr.push(element.getColumns())
        });
        return returnArr;
    }

    public toJSON() : {[key:string]:any}[] {
        var returnArr: {[key:string]:any}[] = [];
        this.models.forEach(element => {
            returnArr.push(element.toJSON())
        });
        return returnArr;
    }

    public getIDs(): (string|number)[] {
        
        return Object.keys(this.modelIdHash);
    }

    public save():Promise<void> {
        return new Promise((resolve,reject)=>{
            var saved = 0;
            this.models.forEach((model)=>{
                model.save().then((res)=>{
                    saved++;
                    if(saved == this.models.length) {
                        resolve();
                    }
                });
            })
        });
            
    }

    public setVisibleColumns(columns: string[]) {
        this.models.forEach((model)=>{
            model.setVisibleColumns(columns);
        });
    }

    private eagerLoadLevel(relationKey:string,func: (q:iSQL)=>iSQL):Promise<void> {
        var model = this.first();
        return new Promise((resolve,reject)=>{
            if(!model) return resolve();
            var relationNames = relationKey.split(".");
            var relationName = relationNames.shift();
            if(!relationName) return reject();
            if(!(relationName in model)) return reject();
            var relationFunc = model[(relationName as keyof typeof model)] as ()=>iRelation;
            var relation:iRelation = relationFunc.call(model);
            if(relationNames.length == 0 && func !== null) {
                func(relation.getQuery(false));
            }
            var idsToLoad: (string | number)[] = [];
            
            var nextLoadModelCollection = new ModelCollection();
            this.models.forEach(model=>{
                if(!relationName) return;
                if(!model.hasRelation(relationName)) {
                    idsToLoad.push(model.getColumn(model.getPrimaryKey())); 
                } else {
                    var existingRelation = model.getRelation(relationName);
                    if(existingRelation instanceof ModelCollection) {
                        existingRelation.getModels().forEach((model)=>{
                            nextLoadModelCollection.add(model);
                        });
                    } else if(existingRelation !== null) {
                        nextLoadModelCollection.add(existingRelation);
                    }
                }
            });
            if(idsToLoad.length > 0) {
                relation.getResults(idsToLoad).then(results=>{
                    if(!relationName) return resolve();
                    for(var modelID in results) {
                        var relatedModels = results[modelID as keyof typeof results];
                        if(relation.returnsMany) {
                            this.modelIdHash[modelID].setRelation(relationName,relatedModels);
                        } else {
                            const relatedModel = relatedModels.first();

                            if(relatedModel) {
                                this.modelIdHash[modelID].setRelation(relationName,relatedModel);
                            } else {
                                this.modelIdHash[modelID].setRelation(relationName,null);
                            }                            
                        }
                        relatedModels.getModels().forEach(model=>{
                            nextLoadModelCollection.add(model);
                        });
                    }
                    if(relationNames.length > 0) {
                        var nextLoad = new Map([
                            [relationNames.join("."), func]
                        ]);
                        nextLoadModelCollection.eagerLoad(nextLoad).then(()=>{
                            resolve()
                        });
                    } else {
                        resolve();
                    }
                });
            } else {
                if(relationNames.length > 0) {
                    var nextLoad = new Map([
                        [relationNames.join("."), func]
                    ]);
                    nextLoadModelCollection.eagerLoad(nextLoad).then(()=>{
                        resolve()
                    });
                } else {
                    resolve();
                }
            }
            
        });
        
    }

    public eagerLoad(relations:Map<string, (q: iSQL)=>iSQL>):Promise<void> {
        return new Promise((resolve,reject)=>{
            if(this.models.length == 0) {
                resolve();
                return;
            } 
            var self = this;
            let relationKeys:string[] = [];
            for(let key of relations.keys()) {
                relationKeys.push(key);
            }
            function load() {
                if(relationKeys.length == 0) {
                    resolve();
                    return;
                }
                var key = relationKeys.shift();
                if(key) {
                    const relation = relations.get(key);
                    if(relation) {
                        self.eagerLoadLevel(key,relation).then(load);
                    }
                    
                }                
            }
            load();
        });
        
    }
    

    [Symbol.iterator]() {
        return {
            next: ():IteratorResult<BaseModel> => {
                if(this.index < this.models.length) {
                    return {
                        value: this.models[this.index++],
                        done: false
                    };
                } else {
                    this.index = 0;
                    return {
                        done: true,
                        value: null
                    };
                }
            }
        };
    }

}