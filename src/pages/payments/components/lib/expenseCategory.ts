/**
 * Kassa tarixi qatoridagi xarajat kategoriyasi nomi (Elchi Pochta №1): `expense_category_name` — chiqim yozilgan
 * paytdagi nom nusxasi (kategoriya keyin o'zgartirilsa yoki o'chirilsa ham tarix o'zgarmaydi). Bo'sh / yo'q — `null`.
 * Jadval, telefon kartalari, ro'yxatlar va tafsilot oynasi shu bitta qoidani ishlatadi.
 */
export const getExpenseCategoryName = (row?: { expense_category_name?: string | null } | null): string | null => {
  const name = row?.expense_category_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
};
