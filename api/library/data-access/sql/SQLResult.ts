export default class SQLResult {
    public success: boolean;
    public error;
    public insert_id: number;
    public rows_affected: number;
    public rows_changed: number;
    public rows: object[];
}