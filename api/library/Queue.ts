//class for an item added to the queue;
export class Task {
    private id: string;
    private time: number;
    private timer: NodeJS.Timeout;
    private payload;
    private queueInstance = require('./QueueFactory');

    /**
     * create a new queue item
     * @param time the time in seconds since epoch that this is due to to triggered
     * @param callback the function to call when triggered
     * @param payload the data to pass to the function when triggered
     */    
    constructor(time:number,callback:(payload:object)=>void,payload:object) {
        var seconds = time - Math.round(Date.now()/1000);
        seconds = seconds < 0 ? 0 : seconds;
        this.time = time;
        this.payload = payload;
        this.timer = setTimeout(()=>{
            callback(payload);
            this.queueInstance.removeTask(this.id);
        },seconds*1000);
    }
    /**
     * cancels the queue item by clearing the timer
     */
    public cancel() {
        clearTimeout(this.timer);
    }
    /**
     * return time due to be triggered
     */
    public getTime() {
        return this.time;
    }

    public setID(id:string) {
        this.id = id;
    }

    public getPayload() {
        return this.payload;
    }
};
export class Queue {

    private queuedTasks: Map<string, Task> = new Map;
    private __id: number = 1;

    /**
     * get task from the queue
     * @param id the id assigned to the queue item
     */
    public getTask(id:string) {
        if(this.queuedTasks.has(id)) {
            return this.queuedTasks.get(id);
        }
        return null;
    }

    public getTasks() {
        return this.queuedTasks;
    }

    /**
     * add a new task to the queue
     * @param item Task instance
     * @param id optional id to give to the task, if ommitted then one will be generated
     */
    public addTask(task: Task,id: string = null) {
        if(id === null) {
            id = (++this.__id).toString();
        }
        if(this.queuedTasks.has(id)) {
            throw Error("Task already exists");
        }
        
        task.setID(id);
        this.queuedTasks.set(id,task);
        return id;
    }

    /**
     * remove an task from the queue
     * this will cancel the timer and remove it from the queue
     * @param id id assigned to the queue task
     */
    public removeTask(id:string) {
        if(this.queuedTasks.has(id)) {
            this.queuedTasks.get(id).cancel();
            this.queuedTasks.delete(id);
        }
    }
    
}

module.exports = new Queue();