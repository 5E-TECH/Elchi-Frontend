/** «Mahsulot qo'shish» (`AddOrderItemPicker`) — katalog javobini `{ id, name }` ro'yxatiga keltirish. */
export type CatalogItem = { id: string; name: string };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** `{ data: [...] }`, `{ data: { items } }` yoki to'g'ridan-to'g'ri massiv — `{ id, name }` ro'yxati. */
export const toCatalogItems = (payload: unknown): CatalogItem[] => {
  const envelope = asRecord(payload);
  const data = "data" in envelope ? envelope.data : payload;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(asRecord(data).items)
      ? (asRecord(data).items as unknown[])
      : Array.isArray(asRecord(data).data)
        ? (asRecord(data).data as unknown[])
        : [];
  return list.flatMap((row) => {
    const record = asRecord(row);
    const id = typeof record.id === "string" || typeof record.id === "number" ? String(record.id) : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    return id && name && record.isDeleted !== true ? [{ id, name }] : [];
  });
};
