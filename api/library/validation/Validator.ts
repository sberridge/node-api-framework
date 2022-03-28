import BaseModel from '../modelling/BaseModel';
import iSQL from '../data-access/sql/interface/SQLInterface';
import ModelCollection from '../modelling/ModelCollection';

const util = require('util');
export class ValidationResult {
    public success:boolean;
    public message:string;
    constructor(success:boolean = true,message: string = "") {
        this.success = success;
        this.message = message;
    }
}
export class Validator {
    private fields:object;
    private validationResult:object;
    public success:boolean;
    private validateFunctions = [];
    public modelResults = {};

    constructor(fields:object) {
        this.fields = fields;
        this.validationResult = {};
        this.success = true;
    }

    private get(fields,parentObject,validationObject,validationFunc: (value: any) => Promise<ValidationResult>) {
        var field:string = fields.shift();
        if(field.substr(field.length-2) == "[]") {
            var field = field.substr(0,field.length-2);
            var val = (typeof parentObject[field]) == "undefined" ? null : parentObject[field];
            if(fields.length == 0) {
                if(!Array.isArray(val)) {
                    validationObject[field] = "Expected Array";
                    this.success = false;
                } else {
                    validationObject[field] = (field in validationObject) ? validationObject[field] : {};
                    val.forEach((value,index)=>{
                        this.validateFunctions.push({
                            value: value,
                            func: validationFunc,
                            field: index.toString(),
                            object: validationObject[field]
                        })
                    });
                }
            } else {
                validationObject[field] = (field in validationObject) ? validationObject[field] : [];
                if(val != null) {
                    if(!Array.isArray(val)) {
                        validationObject[field] = "Expected Array";
                        this.success = false;
                    } else {
                        val.forEach((item,index)=>{
                            var validObj = {};
                            if(validationObject[field].length > index) {
                                validObj = validationObject[field][index];
                            } else {
                                validationObject[field].push(validObj);
                            }                            
                            this.get(fields.slice(0),item,validObj,validationFunc);
                        });
                    }                    
                }                
            }            
        } else {
            var val = (typeof parentObject[field]) == "undefined" ? null : parentObject[field];         
            if(fields.length == 0) {   
                this.validateFunctions.push({
                    value: val,
                    func: validationFunc,
                    field: field,
                    object: validationObject
                });            
            } else {
                if(!(field in validationObject)) {
                    var nextValidationObject = {};
                    validationObject[field] = nextValidationObject;
                } else {
                    nextValidationObject = validationObject[field];
                }                
                if(val == null) {
                    val = {};
                    parentObject[field] = {};
                }
                this.get(fields,val,nextValidationObject,validationFunc);
            }            
        }
    }

    

    public validateRequired(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value === null) {
                    resolve(new ValidationResult(false,"required"));
                }
                resolve(new ValidationResult());
            });
            
        });
    }
    
    public validateMinLength(field:string,length:number) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null && value.length < length) {
                    resolve(new ValidationResult(false,"minimum length: " + length.toString()));
                }
                resolve(new ValidationResult());
            });
            
        });
    }

    public validateUnique(field:string,fieldToCheck:string,model:BaseModel) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null) {
                    model.all().where(fieldToCheck,"=",value,true).count().then((num)=>{
                        if(num > 0) {
                            resolve(new ValidationResult(false,"already exists"));
                        } else {
                            resolve(new ValidationResult());
                        }
                    });
                } else {
                    resolve(new ValidationResult());
                }                
            });            
        });
    }

    public validateExists(field:string,model:BaseModel,func: (query:iSQL)=>void)
    public validateExists(field:string,model:BaseModel)
    public validateExists(field:string,model:BaseModel,func: (query:iSQL)=>void = null) {
        var fieldParts = field.split(".");
        var self = this;
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null) {
                    if(typeof func != "undefined" && func !== null) {
                        var query = model.all();
                        func(query);
                        query.fetchModels().then((results:ModelCollection)=>{
                            if(results.first() !== null) {
                                self.modelResults[field] = results.first();
                                resolve(new ValidationResult());
                            } else {
                                resolve(new ValidationResult(false,"not found"));    
                            }
                        })
                    } else {
                        model.find(value).then(model=>{
                            self.modelResults[field] = model;
                            resolve(new ValidationResult());
                        }).catch(()=>{
                            resolve(new ValidationResult(false,"not found"));
                        });
                    }
                    
                } else {
                    resolve(new ValidationResult());
                }
            });
        });
    }

    public validateDate(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value:string): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null) {
                    if(!/^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/.test(value) || isNaN((new Date(value)).getTime())) {
                        resolve(new ValidationResult(false,"Invalid date"));
                    }                    
                }
                resolve(new ValidationResult());
            });
            
        });
    }
    
    public validateTime(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value:string): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null) {
                    if(!/^[0-9]{2}\:[0-9]{2}(\:[0-9]{2})?$/.test(value) || isNaN((new Date("1990-01-01 " + value)).getTime())) {
                        resolve(new ValidationResult(false,"Invalid date"));
                    }                    
                }
                resolve(new ValidationResult());
            });
            
        });
    }

    public validateNumeric(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(isNaN(value)) {
                    resolve(new ValidationResult(false,"Invalid number"));
                }
                resolve(new ValidationResult());
            });
            
        });
    }

    public validateCustom(field:string,func: (value)=>Promise<ValidationResult>) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null) {
                    resolve(func(value));
                } else {
                    resolve(new ValidationResult());
                }
            });
        });
    }

    public validateBoolean(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null && typeof value !== "boolean") {
                    resolve(new ValidationResult(false,"boolean required"));
                }
                resolve(new ValidationResult());
            });

        });
    }

    public validateInteger(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null && isNaN(parseInt(value))) {
                    resolve(new ValidationResult(false,"integer required"));
                }
                resolve(new ValidationResult());
            });

        });
    }

    public validateArray(field:string) {
        var fieldParts = field.split(".");
        this.get(fieldParts,this.fields,this.validationResult,function(value): Promise<ValidationResult> {
            return new Promise((resolve,reject)=>{
                if(value !== null && !Array.isArray(value)) {
                    resolve(new ValidationResult(false,"expected array"));
                }
                resolve(new ValidationResult());
            });
            
        });
    }

    public getValidationResult() {
        return this.validationResult;
    }

    public validate() {
        return new Promise((resolve,reject)=>{
            var totalFuncs = this.validateFunctions.length;
            var completeFuncs = 0;
            this.validateFunctions.forEach((func)=>{
                func.func(func.value).then((result)=>{
                    if(!result.success) {
                        this.success = false;
                        func.object[func.field] = result.message;
                    }
                    completeFuncs++;
                    if(completeFuncs == totalFuncs) {
                        resolve(this.getValidationResult());
                    }
                });
                
            })
        });
    }

}