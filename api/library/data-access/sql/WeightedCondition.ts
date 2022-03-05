import { iSQL } from "./interface/SQLInterface";
import { Query } from "./Query";

export class WeightedCondition {
    private query : Query
    private weight: number
    private nonMatchWeight: number
    private nonMatchSubCondition: WeightedCondition


    constructor(query:Query,weight:number,subCondition:WeightedCondition)
    constructor(query:Query,weight:number,nonMatchWeight:number)
    constructor(query:Query,weight:number,NonMatch:WeightedCondition|number) {
        this.query = query;
        this.weight = weight;
        if(typeof NonMatch == "number") {
            this.nonMatchWeight = NonMatch;
        } else {
            this.nonMatchSubCondition = NonMatch;
        }
    }

    public getParamNum() {
        return this.query.getParamNum();
    }

    public increaseParamNum(num:number) {
        this.query.increaseParamNum(num);
    }

    public applyCondition(sql:iSQL,params:any[],paramNames:any[]):string {        
        var elseStr = null;
        var whereStr = this.query.applyWheres(params,paramNames);
        if(typeof this.nonMatchWeight === 'number') {
            elseStr = this.nonMatchWeight;
        } else {
            this.nonMatchSubCondition.increaseParamNum(this.getParamNum() - 1);
            let startParamNum = this.nonMatchSubCondition.getParamNum();
            elseStr = this.nonMatchSubCondition.applyCondition(sql,params,paramNames);
            let diff = this.nonMatchSubCondition.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        }
        var conditionQuery = sql.generateConditional(whereStr, this.weight.toString(), elseStr);
        return conditionQuery;
    }
}