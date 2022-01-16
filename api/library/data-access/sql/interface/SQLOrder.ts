export type SQLOrder = {
    "field": string
    "direction": SQLOrder.Direction
}

export namespace SQLOrder {
    export type Direction = "desc" | "asc";
}