/**
 * Buyurtma qatoridagi mahsulot nomi.
 *
 * Katalog mahsulotida nom `product.name` da. Tashqi (hamkor/marketplace)
 * buyurtmalarda mahsulot katalogda YO'Q: `product` va `product_id` — `null`,
 * nom `product_name` da matn bo'lib keladi. Katalog nomi ustun — hamkor
 * yuborgan matn eskirgan bo'lishi mumkin. Ikkalasi ham bo'lmasa `#<product_id>`,
 * u ham bo'lmasa `fallback`.
 */
export type OrderItemNameSource = {
  product?: { name?: string | null } | null;
  product_name?: string | null;
  product_id?: string | number | null;
};

export const getOrderItemName = (item: OrderItemNameSource, fallback: string): string =>
  item.product?.name ?? item.product_name ?? (item.product_id ? `#${item.product_id}` : fallback);
