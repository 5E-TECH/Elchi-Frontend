import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import {
  useCancelTransferBatch,
  useReceiveTransferBatch,
  useReceiveTransferBatchOrders,
  useSendTransferBatch,
} from "../entities/batch";
import { useDispatchPostToBranch, useDispatchPostToCourier, useMails, useReceivePost } from "../entities/mails";
import { useOrders as useOrderActions } from "../entities/orders";
import { useOrders as useOrderApi } from "../entities/order/api/orderApi";
import { useAiConfirm } from "../entities/ai-order/api";
import { useReceiveByScan } from "../entities/incoming-orders";
import { useFinanceCoverage } from "../entities/payments/financeCoverage";
import { receiptKey, useReceipt } from "../entities/payments/receipt";
import { useUser } from "../entities/user/api/userApi";
import { useProducts } from "../entities/product";
import { useProcessQueue, useRedispatch, useRetryFailed } from "../entities/integrations/shipments";
import { useReconcileNow } from "../entities/integrations";
import {
  useCancelSmsCampaign,
  useGrantSmsConsent,
  useRevokeSmsConsent,
  useSendSmsCampaign,
} from "../entities/sms";
import { useChangeUserRole } from "../features/user/change-role/model/useChangeUserRole";
import { useAddEmployee } from "../features/branch-add-employee/api/useAddEmployee";
import { useRemoveEmployee } from "../features/branch-remove-employee/api/useRemoveEmployee";
import { createTestStore } from "./test-utils";

/**
 * «Sahifa yangilanmaydi» (Bahodir, 2026-11-05): amal muvaffaqiyatli bo'lgach, shu amal o'zgartirgan ma'lumotni
 * ko'rsatadigan BOSHQA ekranlarning keshi ham eskirgan deb belgilanadi (global `staleTime` 30 s, oyna fokusida
 * qayta so'ralmaydi). Har holatda — amal va u yangilashi SHART bo'lgan kalitlar (prefiks bo'yicha).
 */
const apiMock = vi.hoisted(() => {
  const ok = () => Promise.resolve({ data: { statusCode: 200, data: {} } });
  return { get: vi.fn(ok), post: vi.fn(ok), patch: vi.fn(ok), put: vi.fn(ok), delete: vi.fn(ok) };
});

vi.mock("../shared/api/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared/api/api")>()),
  api: apiMock,
}));

const setup = <T,>(useHook: () => T) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const store = createTestStore({
    role: { id: "1", role: "superadmin", region: null, name: "Admin" },
  } as never);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </Provider>
  );
  const hook = renderHook(useHook, { wrapper: Wrapper });
  const keys = () =>
    invalidate.mock.calls.map(([filters]) =>
      JSON.stringify((filters as { queryKey: unknown[] }).queryKey),
    );
  return { client, hook, keys };
};

const expectKeys = (keys: string[], expected: unknown[][]) => {
  for (const key of expected)
    expect(keys, `kalit ${JSON.stringify(key)}`).toContain(JSON.stringify(key));
};

const run = async <T,>(useHook: () => T, action: (value: T) => Promise<unknown>) => {
  const { hook, keys } = setup(useHook);
  await act(async () => {
    await action(hook.result.current);
  });
  return keys();
};

describe("amaldan keyin boshqa ekranlar ham yangilanadi", () => {
  it("paket jo'natish — buyurtmalar va HQ «Filial paketlari»", async () => {
    const keys = await run(useSendTransferBatch, (m) =>
      m.mutateAsync({ batchId: "5", orderIds: ["1"] }),
    );
    expectKeys(keys, [["batches"], ["mails"], ["orders"], ["branches", "with-sent-batches"]]);
  });

  it("paketni qabul qilish (butun / tanlanganlar) — HQ «Filial paketlari» va tab soni", async () => {
    const whole = await run(useReceiveTransferBatch, (m) => m.mutateAsync("5"));
    expectKeys(whole, [["batches"], ["orders"], ["branches", "with-sent-batches"]]);
    const part = await run(useReceiveTransferBatchOrders, (m) =>
      m.mutateAsync({ batchId: "5", orderIds: ["1"] }),
    );
    expectKeys(part, [["batches"], ["orders"], ["branches", "with-sent-batches"]]);
  });

  it("paketni bekor qilish (paket sahifasi, oP02jE2P) — paketlar, buyurtmalar, «Yangi buyurtmali filiallar» va HQ «Filial paketlari»", async () => {
    apiMock.post.mockClear();
    const keys = await run(useCancelTransferBatch, (m) =>
      m.mutateAsync({ batchId: "5", reason: "Noto'g'ri filialga yig'ilgan" }),
    );
    expect(apiMock.post).toHaveBeenCalledWith("transfer-batches/5/cancel", { reason: "Noto'g'ri filialga yig'ilgan" });
    expectKeys(keys, [["batches"], ["orders"], ["branch-cov"], ["branches", "with-sent-batches"]]);
  });

  it("paketni bekor qilish rad etilsa (409 batch_in_transit) — faqat paketlar qayta o'qiladi", async () => {
    apiMock.post.mockImplementationOnce(() =>
      Promise.reject({ response: { status: 409, data: { statusCode: 409, data: { reason: "batch_in_transit" } } } }),
    );
    const { hook, keys } = setup(useCancelTransferBatch);
    await act(async () => {
      await hook.result.current.mutateAsync({ batchId: "5", reason: "Noto'g'ri filialga yig'ilgan" }).catch(() => undefined);
    });
    expect(keys()).toEqual([JSON.stringify(["batches"])]);
  });

  it("pochtani filialga jo'natish — «Bugungi», «Eski» va buyurtmalar", async () => {
    const keys = await run(useDispatchPostToBranch, (m) =>
      m.mutateAsync({ postId: "7", payload: { destinationBranchId: "9", orderIds: ["1"] } }),
    );
    expectKeys(keys, [["mails", "detail", "7"], ["mails", "new"], ["mails", "old"], ["orders"]]);
  });

  it("pochtani HQ kuryeriga berish — filialga jo'natish bilan bir xil kalitlar; tana { courier_id, order_ids }; 125 s", async () => {
    apiMock.post.mockClear();
    const keys = await run(useDispatchPostToCourier, (m) =>
      m.mutateAsync({ postId: "7", payload: { courierId: "77", orderIds: ["1", "2"] } }),
    );
    // Brauzer gateway'dan (`BATCH_RPC_TIMEOUT_MS` = 120 s) uzoqroq kutadi — 20 s sukutida katta pochta
    // «So'rov vaqti tugadi» bo'lib, buyurtmalar baribir kuryerga o'tardi.
    expect(apiMock.post).toHaveBeenCalledWith(
      "branches/posts/7/dispatch-to-courier",
      { courier_id: "77", order_ids: ["1", "2"] },
      { timeout: 125_000 },
    );
    expectKeys(keys, [["mails", "detail", "7"], ["mails", "new"], ["mails", "old"], ["orders"]]);
  });

  it("HQ kuryeriga berish rad etilsa: tanlov eskirgan (409 order_not_in_post / 400 post_not_sendable) — faqat tafsilot", async () => {
    const rejectWith = (status: number, reason: string) =>
      apiMock.post.mockRejectedValueOnce({ response: { status, data: { message: "x", data: { reason } } } });
    for (const [status, reason] of [
      [409, "order_not_in_post"],
      [400, "post_not_sendable"],
    ] as const) {
      rejectWith(status, reason);
      const stale = await run(useDispatchPostToCourier, (m) =>
        m.mutateAsync({ postId: "7", payload: { courierId: "77", orderIds: ["1"] } }).catch(() => undefined),
      );
      expect(stale).toEqual([JSON.stringify(["mails", "detail", "7"])]);
    }
    rejectWith(403, "courier_region_not_served");
    const other = await run(useDispatchPostToCourier, (m) =>
      m.mutateAsync({ postId: "7", payload: { courierId: "77", orderIds: ["1"] } }).catch(() => undefined),
    );
    expect(other).toEqual([]);
  });

  it("pochtani qabul qilish — buyurtmalar ham", async () => {
    const keys = await run(useReceivePost, (m) =>
      m.mutateAsync({ postId: "7", payload: { order_ids: ["1"] } }),
    );
    expectKeys(keys, [["mails", "new"], ["mails", "old"], ["orders"]]);
  });

  it("qaytarish so'rovini tasdiqlash — qaytarish, eski / yangi pochtalar va buyurtmalar", async () => {
    const keys = await run(useMails, (m) =>
      m.approveReturnRequests.mutateAsync({ order_ids: ["1"] }),
    );
    expectKeys(keys, [["mails", "return"], ["mails", "old"], ["mails", "new"], ["orders"]]);
  });

  it("qaytarish so'rovini rad etish — o'sha ro'yxatlar (u5HTJtqK: Ops nusxasidagi takror hook olib tashlandi)", async () => {
    const keys = await run(useMails, (m) =>
      m.rejectReturnRequests.mutateAsync({ order_ids: ["1"] }),
    );
    expectKeys(keys, [["mails", "return"], ["mails", "old"], ["mails", "new"], ["orders"]]);
  });

  it("bekor buyurtmalarni pochtaga jo'natish — «Rad etilgan» pochtalar", async () => {
    const keys = await run(useOrderActions, (m) => m.SendToPost.mutateAsync(["1"]));
    expectKeys(keys, [["orders"], ["mails"]]);
  });

  it("filial menejeri qabuli (o'tkazma paketi) — `/batches`", async () => {
    const keys = await run(useOrderActions, (m) =>
      m.createTransferBatch.mutateAsync({ orderIds: ["1"] }),
    );
    expectKeys(keys, [["orders"], ["batches"]]);
  });

  it("HQ qabuli — «Bugungi» pochtalar va bosh sahifa", async () => {
    const keys = await run(useOrderActions, (m) =>
      m.createReceiveOrder.mutateAsync({ order_ids: ["1"] }),
    );
    expectKeys(keys, [["orders"], ["mails", "new"], ["dashboard"]]);
  });

  it("pul amali (qaytarish) — KPI, «Moliyaviy tahlil», kuryer / market / menejer / filial summalari", async () => {
    const keys = await run(useOrderActions, (m) =>
      m.RollbackOrder.mutateAsync({ orderId: "1", targetStatus: "waiting" as never }),
    );
    expectKeys(keys, [
      ["orders"],
      ["cashbox"],
      ["dashboard"],
      ["kpi"],
      ["revenue"],
      ["couriers"],
      ["markets"],
      ["managers"],
      ["branches"],
    ]);
  });

  it("buyurtma yaratish (qo'lda va AI) — mijoz ogohlantirishi va ombor qoldig'i", async () => {
    const manual = await run(useOrderApi, (m) =>
      m.createOrder.mutateAsync({ data: {} as never, idempotencyKey: "k" }),
    );
    expectKeys(manual, [["orders"], ["dashboard"], ["customer-suggest"], ["warehouses"]]);
    const ai = await run(useAiConfirm, (m) => m.mutateAsync({} as never));
    expectKeys(ai, [["orders"], ["dashboard"], ["customer-suggest"], ["warehouses"]]);
  });

  it("kuryerga biriktirish — bosh sahifa va skan natijasi", async () => {
    const keys = await run(useOrderApi, (m) =>
      m.assignCourier.mutateAsync({ courier_id: "2", order_ids: ["1"] }),
    );
    expectKeys(keys, [["orders"], ["dashboard"], ["scan-detail"]]);
  });

  it("kiruvchi posilkalarni skan bilan qabul — buyurtmalar (menyu soni) va bosh sahifa", async () => {
    const keys = await run(useReceiveByScan, (m) => m.mutateAsync(["t1"]));
    expectKeys(keys, [["orders"], ["dashboard"]]);
  });

  it("maosh to'lash — kassa, bosh sahifa «Kassa balansi», KPI", async () => {
    const keys = await run(useFinanceCoverage, (m) => m.createSalary.mutateAsync({}));
    expectKeys(keys, [
      ["cashbox"],
      ["finance-cov"],
      ["dashboard"],
      ["revenue"],
      ["kpi"],
      ["finance-history"],
    ]);
  });

  it("chek AI natijasi chiqdi (pending → boshqa) — kassa tarixi qatori", async () => {
    const { client, hook, keys } = setup(() => useReceipt("r1", { enabled: false }));
    act(() => {
      client.setQueryData(receiptKey("r1"), { id: "r1", ai_status: "pending" });
    });
    await waitFor(() => expect(hook.result.current.data?.ai_status).toBe("pending"));
    expect(keys()).toEqual([]);
    act(() => {
      client.setQueryData(receiptKey("r1"), { id: "r1", ai_status: "match" });
    });
    await waitFor(() => expectKeys(keys(), [["cashbox"], ["finance-history"]]));
  });

  it("foydalanuvchi holati / o'chirish — marketlar, buyurtma aloqasi, filiallar, logist, investor", async () => {
    const keys = await run(useUser, (m) =>
      m.updateUserStatus.mutateAsync({ id: "3", status: "inactive" as never }),
    );
    expectKeys(keys, [
      ["user"],
      ["couriers"],
      ["managers"],
      ["markets"],
      ["order-meta", "user"],
      ["branches"],
      ["logists"],
      ["region-logists"],
      ["investors"],
    ]);
  });

  it("rol o'zgartirish — menejerlar, identity va (logistga o'tsa) logistlar", async () => {
    const keys = await run(useChangeUserRole, (m) =>
      m.mutateAsync({ id: "3", role: "logist" as never, from: "courier" }),
    );
    expectKeys(keys, [["user"], ["managers"], ["identity-cov"], ["logists"], ["region-logists"]]);
  });

  it("filialga xodim qo'shish / olib tashlash — foydalanuvchi tafsiloti", async () => {
    const added = await run(
      () => useAddEmployee("4"),
      (m) => m.mutateAsync({} as never),
    );
    expectKeys(added, [["branches"], ["user"]]);
    const removed = await run(
      () => useRemoveEmployee("4"),
      (m) => m.mutateAsync("3"),
    );
    expectKeys(removed, [["branches"], ["user"]]);
  });

  it("mahsulotni o'chirish — buyurtma katalogi", async () => {
    const keys = await run(useProducts, (m) => m.deleteProduct.mutateAsync(1));
    expectKeys(keys, [["products"], ["market"]]);
  });

  it("integratsiya «Ish rejimi» — ko'rsatkichlar va sinxron tarixi", async () => {
    for (const keys of [
      await run(useProcessQueue, (m) => m.mutateAsync("1")),
      await run(useRetryFailed, (m) => m.mutateAsync("1")),
      await run(useRedispatch, (m) => m.mutateAsync({ slug: "x", orderId: "1" })),
      await run(useReconcileNow, (m) => m.mutateAsync("1")),
    ]) {
      expectKeys(keys, [
        ["integration-shipments"],
        ["integration-metrics"],
        ["integration-sync-history"],
      ]);
    }
  });

  it("SMS: yuborish / bekor qilish — hisobot va bugungi limit; rozilik — auditoriya", async () => {
    const sent = await run(useSendSmsCampaign, (m) =>
      m.mutateAsync({ input: {} as never, idempotencyKey: "k" }),
    );
    expectKeys(sent, [
      ["sms", "campaigns"],
      ["sms", "status"],
      ["sms", "report"],
    ]);
    const cancelled = await run(useCancelSmsCampaign, (m) => m.mutateAsync("1"));
    expectKeys(cancelled, [
      ["sms", "campaigns"],
      ["sms", "status"],
      ["sms", "report"],
    ]);
    const granted = await run(useGrantSmsConsent, (m) =>
      m.mutateAsync({ phone: "+998901234567", source: "operator" }),
    );
    expectKeys(granted, [["sms", "campaign-audience"]]);
    const revoked = await run(useRevokeSmsConsent, (m) => m.mutateAsync("+998901234567"));
    expectKeys(revoked, [["sms", "campaign-audience"]]);
  });
});
