type successFailMessageResponse = {
    "success": boolean,
    "message": string
}
type rowsResponse = {
    "success": boolean,
    "rows": any[],
    "total_rows": number
}
type rowResponse = {
    "success": boolean,
    "row": any
}
type validationResponse = {
    "success": boolean,
    "validation": any
}
export class ResponseGenerator {
    public static failure(message: string) {
        return {
            "success": false,
            "message": message
        };
    }
    public static success(row: object) : rowResponse
    public static success(rows: object[], totalRows: number) : rowsResponse
    public static success(message: string) : successFailMessageResponse
    public static success(response: any,totalRows: any = null): object {
        if(typeof response == "string") {
            return {
                "success": true,
                "message": response
            };
        } else if(Array.isArray(response)) {
            return {
                "success": true,
                "rows": response,
                "total_rows": totalRows
            };
        } else {
            return {
                "success": true,
                "row": response
            };
        }
    }

    public static validation(validation:any):validationResponse {
        return {
            "success": false,
            "validation": validation
        };
    }

    public static authentication(): successFailMessageResponse {
        return {
            "success": false,
            "message": "Authentication failure"
        };
    }
}