export default class SQLResult {
    public success: boolean = false;
    public error:any;
    public insert_id: number = 0;
    public rows_affected: number = 0;
    public rows_changed: number = 0;
    public rows: any[] = [];
}