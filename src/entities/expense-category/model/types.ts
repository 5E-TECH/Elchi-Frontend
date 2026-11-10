/**
 * Kassa xarajati kategoriyasi (Elchi Pochta №1, `GET finance/cashbox/expense-categories`). «Kassadan xarajat»
 * oynasidagi tanlov ro'yxati; superadmin qo'shadi, tahrirlaydi va (yumshoq) o'chiradi. Tarix qatorlari nomni
 * yozilgan paytdagidek saqlaydi (`expense_category_name`), shuning uchun nom o'zgarsa eski yozuv o'zgarmaydi.
 */
export type ExpenseCategory = {
  id: string;
  name: string;
  /** «Nimalar kiradi» — bo'lmasa `null`. */
  description: string | null;
  /** Ro'yxatdagi o'rni (kichigi tepada). */
  sortOrder: number;
  isDeleted: boolean;
  /**
   * Standart kategoriya (`is_default`, backend migratsiya 214 — boshlang'ich 17 ta). Ega 2026-11-11: tahrirlab ham,
   * o'chirib ham bo'lmaydi (backend `PATCH` / `DELETE` — 403). Superadmin qo'shganlari — `false`. Eski backend
   * (maydon yo'q) — `false`.
   */
  isDefault: boolean;
};

/** `POST finance/cashbox/expense-categories` — `name` 1–100, `description` ≤ 500, `sort_order` 0…1 000 000. */
export type CreateExpenseCategoryRequest = {
  name: string;
  description?: string;
  /** Berilmasa — ro'yxat oxiriga (backend MAX + 1). */
  sort_order?: number;
};

/** `PATCH finance/cashbox/expense-categories/:id` — kamida bitta maydon; `description: null` — tozalash. */
export type UpdateExpenseCategoryRequest = {
  name?: string;
  description?: string | null;
  sort_order?: number;
};
