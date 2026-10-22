import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { ExpenseCategory, UpdateExpenseCategoryRequest } from "../model/types";
import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategories,
  sortExpenseCategories,
  updateExpenseCategory,
} from "./expenseCategoryApi";

/** Faol kategoriyalar ro'yxati — «Kassadan xarajat» tanlovi va superadmin boshqaruv oynasi shuni o'qiydi. */
const ACTIVE_LIST_KEY = queryKeys.expenseCategories.list({ includeDeleted: false });

/** Kategoriyalar kam o'zgaradi: oyna har ochilganda qayta so'ralmaydi (o'zgarishdan keyin kesh o'zi yangilanadi). */
const STALE_TIME_MS = 60_000;

/**
 * `GET finance/cashbox/expense-categories` (superadmin, admin, menejer). Xatoni chaqiruvchi o'zi chizadi
 * (tanlovda izoh + «Qayta urinish», boshqaruv oynasida `ErrorState`), global xabar chiqmaydi (`silentError`).
 * `includeDeleted` — faqat superadmin uchun ma'noli (backend boshqa rollarda e'tiborsiz qoldiradi).
 */
export const useExpenseCategories = (
  { enabled = true, includeDeleted = false }: { enabled?: boolean; includeDeleted?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.expenseCategories.list({ includeDeleted }),
    queryFn: () => getExpenseCategories({ includeDeleted }),
    enabled,
    staleTime: STALE_TIME_MS,
    meta: { silentError: true },
  });

/** Ro'yxatni qayta so'rash (masalan «Kassadan xarajat» o'chirilgan kategoriya tufayli 400 olganda). */
export const useRefreshExpenseCategories = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.expenseCategories.all });
};

/** Faol ro'yxatda kategoriyani almashtiradi yoki qo'shadi (o'chirilgani — olib tashlanadi), tartib saqlanadi. */
export const upsertExpenseCategory = (
  list: readonly ExpenseCategory[],
  category: ExpenseCategory,
): ExpenseCategory[] => {
  const rest = list.filter((item) => item.id !== category.id);
  return sortExpenseCategories(category.isDeleted ? rest : [...rest, category]);
};

/**
 * Javobni faol ro'yxat keshiga yozadi. Avval ketayotgan so'rov to'xtatiladi: aks holda u (yoki uni bekor qilgan
 * keyingi `invalidate`) keshni so'rov boshlangan paytdagi holatga qaytarib, yozilgan o'zgarishni yo'qotardi.
 */
const writeActiveList = async (
  queryClient: QueryClient,
  update: (list: readonly ExpenseCategory[]) => ExpenseCategory[],
) => {
  await queryClient.cancelQueries({ queryKey: ACTIVE_LIST_KEY });
  queryClient.setQueryData<ExpenseCategory[]>(ACTIVE_LIST_KEY, (list) => (list ? update(list) : list));
};

/**
 * Har o'zgarishdan keyin: javobdagi kategoriya keshga darhol yoziladi (oyna kutmaydi), so'ng ro'yxat fonda qayta
 * so'raladi — xatoda ham (409 / 404: boshqa superadmin o'zgartirgan bo'lishi mumkin).
 */
const useCategoryMutationCallbacks = () => {
  const queryClient = useQueryClient();
  return {
    queryClient,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.expenseCategories.all });
    },
  };
};

/** `POST finance/cashbox/expense-categories` (faqat superadmin). Takror nom — 409. */
export const useCreateExpenseCategory = () => {
  const { queryClient, onSettled } = useCategoryMutationCallbacks();
  return useMutation({
    mutationFn: createExpenseCategory,
    onSuccess: async (category) => {
      if (category) await writeActiveList(queryClient, (list) => upsertExpenseCategory(list, category));
    },
    onSettled,
  });
};

/** `PATCH finance/cashbox/expense-categories/:id` (faqat superadmin). Topilmasa — 404, takror nom — 409. */
export const useUpdateExpenseCategory = () => {
  const { queryClient, onSettled } = useCategoryMutationCallbacks();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateExpenseCategoryRequest }) => updateExpenseCategory(id, body),
    onSuccess: async (category) => {
      if (category) await writeActiveList(queryClient, (list) => upsertExpenseCategory(list, category));
    },
    onSettled,
  });
};

/** `DELETE finance/cashbox/expense-categories/:id` (faqat superadmin, yumshoq). Tarix qatorlari nomni saqlaydi. */
export const useDeleteExpenseCategory = () => {
  const { queryClient, onSettled } = useCategoryMutationCallbacks();
  return useMutation({
    mutationFn: deleteExpenseCategory,
    onSuccess: (_category, id) => writeActiveList(queryClient, (list) => list.filter((item) => item.id !== id)),
    onSettled,
  });
};
