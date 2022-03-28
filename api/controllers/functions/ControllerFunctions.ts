import { pagination as paginationResult } from "./../../library/data-access/sql/interface/SQLTypes";
import { paginationURLQuery } from "../types/ControllerTypes";
import iSQL from "./../../library/data-access/sql/interface/SQLInterface";

export const applyQueryPagination = async (query: iSQL, paginationParams: paginationURLQuery):Promise<{success: boolean, result: paginationResult}> => {
    const pageNumber = ("page_number" in paginationParams) && !isNaN(parseInt(paginationParams.page_number)) ? parseInt(paginationParams.page_number) : 1;
    const perPage = ("per_page" in paginationParams) && !isNaN(parseInt(paginationParams.per_page)) ? parseInt(paginationParams.per_page) : 10;
    const paginationResult = await query.paginate(perPage, pageNumber)
        .catch(err=>{
            return false;
        });
    const success = typeof paginationResult !== "boolean";
    return {
        success: success,
        result: success ? paginationResult : null
    };
}