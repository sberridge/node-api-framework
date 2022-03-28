import iSQL from '../data-access/sql/interface/SQLInterface';
import BaseModel from './BaseModel'
import iRelation from './relations/interface/RelationInterface';
export default class ModelCollection {
    private models: BaseModel[] = [];
    private index = 0;
    private modelIdHash = {};

    public add(model) {
        this.models.push(model);
        if(!(model.getColumn(model.getPrimaryKey()) in this.modelIdHash)) {
            this.modelIdHash[model.getColumn(model.getPrimaryKey())] = model;
        }
    }

    public getModels(): BaseModel[] {
        return this.models;
    }

    public find(id) {
        if(id in this.modelIdHash) {
            return this.modelIdHash[id];
        }
        return null;
    }

    public first(): BaseModel {
        if(this.models.length > 0) {
            return this.models[0];
        }
        return null;
    }

    public toList(): object[] {
        var returnArr = [];
        this.models.forEach(element => {
            returnArr.push(element.getColumns())
        });
        return returnArr;
    }

    public toJSON() : object[] {
        var returnArr = [];
        this.models.forEach(element => {
            returnArr.push(element.toJSON())
        });
        return returnArr;
    }

    public getIDs(): any[] {
        
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

    private eagerLoadLevel(relationKey,func: (q:iSQL)=>iSQL):Promise<void> {
        var model = this.first();
        return new Promise((resolve,reject)=>{
            var relationNames = relationKey.split(".");
            var relationName = relationNames.shift();
            if(!(relationName in model)) reject();
            var relation:iRelation = model[relationName]();
            if(relationNames.length == 0 && func !== null) {
                func(relation.getQuery(false));
            }
            var idsToLoad = [];
            
            var nextLoadModelCollection = new ModelCollection();
            this.models.forEach(model=>{
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
                    
                    for(var modelID in results) {
                        var relatedModels = results[modelID];
                        if(relation.returnsMany) {
                            this.modelIdHash[modelID].setRelation(relationName,relatedModels);
                        } else {
                            if(relatedModels.getModels().length > 0) {
                                this.modelIdHash[modelID].setRelation(relationName,relatedModels.first());
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
            let relationKeys = [];
            for(let key of relations.keys()) {
                relationKeys.push(key);
            }
            function load() {
                if(relationKeys.length == 0) {
                    resolve();
                    return;
                }
                var key = relationKeys.shift();
                self.eagerLoadLevel(key,relations.get(key)).then(load);
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