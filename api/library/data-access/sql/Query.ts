import iSQL from './interface/SQLInterface';
import { comparison } from './interface/SQLTypes';
type whereDetails = {
    type: "where" | "logic" | "bracket"
    func?: (...args:any[])=>whereDetails
    args?: any[]
    field?: string
    comparator?: string
    params?: any[]
    value?: any
    escape?: boolean
    namedParam?: string
    paramNames?: string[]
}

export default class Query {

    private wheres : whereDetails[] = [];
    private namedParams: boolean;
    private namedParamNum: number = 0;
    private namedParamPrefix: string = "param";
    private namedParamSymbol: string = '@';

    constructor(namedParams: boolean) {
        this.namedParams = namedParams;
    }

    public getParamNum() {
        return this.namedParamNum;
    }
    
    public increaseParamNum(num:number) {
        this.namedParamNum += num;
    }

    public setPrefix(prefix:string) {
        this.namedParamPrefix = prefix;
    }

    public setParamSymbol(symbol:string) {
        this.namedParamSymbol = symbol;
    }

    public getWheres() {
        return this.wheres;
    }
    
    public where(field : string, comparator : comparison, value : any, escape : boolean = true) : Query {
        
        this.wheres.push({
            type: "where",
            func: (field : string, comparator : comparison, value : any, escape : boolean = true)=>{
                var details:whereDetails = {
                    type: "where",
                    field: field,
                    comparator: comparator,
                    value: value,
                    escape: escape
                };
                if(escape) {
                    details['namedParam'] = this.namedParamPrefix + (this.namedParamNum++).toString();
                }
                return details;
            },
            args: [
                field,
                comparator,
                value,
                escape
            ]
        });
        return this;
    }
    
    public on(field : string, comparator : comparison, value : any, escape : boolean = false) : Query {
        return this.where(field, comparator, value, escape);
    }
    
    public whereNull(field : string) : Query {
        this.wheres.push({
            type: "where",
            func: (field:string)=>{
                return {
                    type: "where",
                    field: field,
                    comparator: "",
                    value: "IS NULL",
                    escape: false
                };
            },
            args:[field]
        });
        return this;
    }

    public onNull = this.whereNull;
    
    public whereNotNull(field : string) : Query {
        this.wheres.push({
            type: "where",
            func: (field:string)=>{
                return {
                    type: "where",
                    field: field,
                    comparator: "",
                    value: "IS NOT NULL",
                    escape: false
                };
            },
            args:[field]
        });
        return this;
    }

    public onNotNull = this.whereNotNull;

    public whereIn(field : string, subQuery : iSQL) : Query
    public whereIn(field : string, values : any[], escape : boolean) : Query
    public whereIn(field : string, values : iSQL | any[], escape : boolean = true) : Query {
        this.wheres.push({
            type: "where",
            func: (field:string, values: iSQL | any[], escape:boolean=true)=>{
                var valueString : string;
                var params = [];
                var paramPrefixes = [];
                if(Array.isArray(values)) {
                    if(!escape) {
                        valueString = " (" + values.join(",") + ") ";
                    } else {
                        valueString = " (" + values.map((value,index)=>{
                            if(this.namedParams) {
                                var namedParam = this.namedParamPrefix + (this.namedParamNum++).toString();
                                paramPrefixes.push(namedParam);
                                return this.namedParamSymbol + namedParam;
                            } else {
                                return "?";
                            }                    
                        }).join(",") + ") ";
                        params = values;
                    }
                } else {
                    values.increaseParamNum(this.getParamNum()-1);
                    let startParamNum = values.getParamNum();
                    valueString = " (" + values.generateSelect() + ") ";
                    let paramDif = values.getParamNum() - startParamNum;
                    this.increaseParamNum(paramDif);
                    params = values.getParams();
                    paramPrefixes = values.getParamNames();
                }
                return {
                    type: "where",
                    field: field,
                    comparator: "IN",
                    value: valueString,
                    escape: false,
                    params: params,
                    paramNames: paramPrefixes
                };
            },
            args: [
                field,
                values,
                escape
            ]
        });
        return this;
    }

    public onIn = this.whereIn;
    
    public or() : Query {
        this.wheres.push({
            type: "logic",
            value: "or"
        });
        return this;
    }
    
    public and() : Query {
        this.wheres.push({
            type: "logic",
            value: "and"
        });
        return this;
    }
    
    public openBracket() : Query {
        this.wheres.push({
            type: "bracket",
            value: "("
        });
        return this;
    }
    
    public closeBracket() : Query {
        this.wheres.push({
            type: "bracket",
            value: ")"
        });
        return this;
    }

    public applyWheres(params : any[], paramNames: any[]) : string {
        var whereString = " ";
        if(this.wheres.length == 0) {
            return whereString;
        }
        var first = true;
        var logic = "and";
        this.wheres.forEach((where,i)=> {
            switch(where.type) {
                case "where":
                    if(!where.func || !where.args) return;
                    let whereDetails = where.func(...where.args);
                    if(!first && this.wheres[i-1]['type'] !== 'bracket') {
                        whereString += " " + logic.toUpperCase() + " ";
                    }
                    first = false;
                    whereString += " " + whereDetails.field + " " + whereDetails.comparator + " ";
                    if(whereDetails.escape) {
                        if(this.namedParams) {
                            whereString += " " + this.namedParamSymbol + whereDetails.namedParam + " ";
                            paramNames.push(whereDetails.namedParam);
                        } else {
                            whereString += " ? ";
                        }                        
                        params.push(whereDetails.value);
                    } else {
                        whereString += " " + whereDetails.value + " ";
                    }
                    if("params" in whereDetails && whereDetails.params) {
                        whereDetails.params.forEach((whereParam:any)=>{
                            params.push(whereParam);
                        });
                        if(this.namedParams && whereDetails.paramNames) {
                            whereDetails.paramNames.forEach((paramName:any)=>{
                                paramNames.push(paramName);
                            });
                        }
                    }
                    break;
                case "logic":
                    logic = where.value;
                    break;
                case "bracket":
                    if(where.value == '(' && !first) {
                        whereString += " " + logic.toUpperCase() + " ";
                    }
                    whereString += " " + where.value + " ";
                    break;
            }
        });
        return whereString;
    }
}