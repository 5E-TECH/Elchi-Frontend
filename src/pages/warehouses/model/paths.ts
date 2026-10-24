export const WAREHOUSES_PATH = "/warehouses";

export const warehousePath = (id: string) => `${WAREHOUSES_PATH}/${encodeURIComponent(id)}`;
