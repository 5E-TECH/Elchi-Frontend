import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api: http }));

import {
  upsertExpenseCategory,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from "./useExpenseCategories";
import type { ExpenseCategory } from "../model/types";

const row = (id: string, name: string, sortOrder: number, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: null,
  sort_order: sortOrder,
  is_deleted: false,
  ...extra,
});

const category = (id: string, name: string, sortOrder: number): ExpenseCategory => ({
  id,
  name,
  description: null,
  sortOrder,
  isDeleted: false,
});

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

beforeEach(() => {
  Object.values(http).forEach((fn) => fn.mockReset());
  http.get.mockResolvedValue({
    data: { statusCode: 200, data: { items: [row("1", "Ovqatlanish", 1), row("2", "Yoqilg'i", 2)] } },
  });
});

describe("upsertExpenseCategory", () => {
  const list = [category("1", "Ovqatlanish", 1), category("2", "Yoqilg'i", 2)];

  it("yangisini tartib bo'yicha joylaydi, mavjudini almashtiradi, o'chirilganini olib tashlaydi", () => {
    expect(upsertExpenseCategory(list, category("3", "Ijara", 0)).map((item) => item.id)).toEqual(["3", "1", "2"]);
    expect(upsertExpenseCategory(list, category("1", "Ovqat", 5)).map((item) => `${item.id}:${item.name}`)).toEqual([
      "2:Yoqilg'i",
      "1:Ovqat",
    ]);
    expect(upsertExpenseCategory(list, { ...category("2", "Yoqilg'i", 2), isDeleted: true })).toEqual([list[0]]);
  });
});

describe("expense category hooks", () => {
  it("ro'yxat: `enabled: false` da so'ramaydi, yoqilganda faol kategoriyalar keladi", async () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ enabled }) => useExpenseCategories({ enabled }), {
      wrapper,
      initialProps: { enabled: false },
    });
    expect(http.get).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((item) => item.name)).toEqual(["Ovqatlanish", "Yoqilg'i"]);
    expect(http.get).toHaveBeenCalledWith("finance/cashbox/expense-categories", { params: undefined });
  });

  it("qo'shish / tahrirlash / o'chirish keshni darhol yangilaydi va ro'yxatni qayta so'raydi", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => ({
        list: useExpenseCategories(),
        create: useCreateExpenseCategory(),
        update: useUpdateExpenseCategory(),
        remove: useDeleteExpenseCategory(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const getsBefore = http.get.mock.calls.length;

    // Keyingi qayta so'rov kechiksin — kesh qo'lda yozilganini tekshirish uchun.
    http.get.mockImplementation(() => new Promise(() => undefined));
    http.post.mockResolvedValue({ data: { statusCode: 201, data: { category: row("18", "Ijara", 0) } } });
    await act(() => result.current.create.mutateAsync({ name: "Ijara", sort_order: 0 }));
    // Kesh `onSuccess` da yozilgan; hook natijasi esa React Query bildirishnomasidan (setTimeout 0) keyin yangilanadi.
    // Qayta so'rov hech qachon javob bermaydi — demak ko'rinadigan ro'yxat faqat qo'lda yozilgan keshdan.
    await waitFor(() => expect(result.current.list.data?.map((item) => item.id)).toEqual(["18", "1", "2"]));
    await waitFor(() => expect(http.get.mock.calls.length).toBeGreaterThan(getsBefore));

    http.patch.mockResolvedValue({ data: { statusCode: 200, data: { category: row("1", "Ovqat va choy", 1) } } });
    await act(() => result.current.update.mutateAsync({ id: "1", body: { name: "Ovqat va choy" } }));
    expect(http.patch).toHaveBeenCalledWith("finance/cashbox/expense-categories/1", { name: "Ovqat va choy" });
    await waitFor(() => expect(result.current.list.data?.find((item) => item.id === "1")?.name).toBe("Ovqat va choy"));

    http.delete.mockResolvedValue({ data: { statusCode: 200, data: { category: row("2", "Yoqilg'i", 2, { is_deleted: true }) } } });
    await act(() => result.current.remove.mutateAsync("2"));
    await waitFor(() => expect(result.current.list.data?.map((item) => item.id)).toEqual(["18", "1"]));
  });

  it("409 xato — kesh o'zgarmaydi, xato chaqiruvchiga qaytadi", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => ({ list: useExpenseCategories(), create: useCreateExpenseCategory() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const conflict = Object.assign(new Error("Request failed with status code 409"), {
      response: { status: 409, data: { statusCode: 409, message: "\"Yoqilg'i\" nomli kategoriya allaqachon bor" } },
    });
    http.post.mockRejectedValue(conflict);

    await act(async () => {
      await expect(result.current.create.mutateAsync({ name: "yoqilg'i" })).rejects.toBe(conflict);
    });
    expect(result.current.list.data?.map((item) => item.id)).toEqual(["1", "2"]);
  });
});
