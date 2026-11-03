import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { notify } from "../../shared/lib/notify";
import { FINANCE_EVENTS, handleFinanceEvent, readClosedAt, refreshShiftQueries } from "./realtimeFinance";

/** rWdLuoP3 — smena jonli hodisalari: nomlar, yopilish vaqti va yangilanadigan so'rovlar. */
describe("realtimeFinance", () => {
  it("tinglanadigan hodisalar — kartadagi uchta smena nomi, kassa kartasi (backend 2026-10-25), chek va to'lov tuzatish", () => {
    expect(FINANCE_EVENTS).toEqual([
      "finance.shift.closed",
      "finance.shift.auto_closed",
      "finance.shift.account_checked",
      "finance.cashbox.card_changed",
      "finance.receipt.checked",
      "finance.payment.corrected",
    ]);
  });

  it("kassa kartasi o'zgardi — kassa qoldiqlari yangilanadi, smena holati qayta so'ralmaydi", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    handleFinanceEvent(client, i18n.t, "finance.cashbox.card_changed", { cashbox_id: "c-1" });
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(["cashbox"]));
    expect(keys).not.toContain(JSON.stringify(["shift"]));
  });

  it("T6 (2wgTzcG0): to'lov tuzatildi — kassa va tarix (ochiq tafsilot ham) yangilanadi, smena so'ralmaydi, xabar yo'q", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const info = vi.spyOn(notify, "info");
    handleFinanceEvent(client, i18n.t, "finance.payment.corrected", {
      correction_id: "12",
      action: "reverse",
      payment_kind: "courier_payment",
      cashbox_type: "main",
      cashbox_ids: ["1", "7"],
      at: "2026-11-03T07:00:00.000Z",
    });
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(["cashbox"]));
    expect(keys).toContain(JSON.stringify(["finance-history"]));
    expect(keys).not.toContain(JSON.stringify(["shift"]));
    // Muddat sozlamasi kassa hodisasida qayta so'ralmaydi (kalit `cashbox` prefiksida emas).
    expect(keys).not.toContain(JSON.stringify(["finance", "payment-correction-settings"]));
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("yopilish vaqti: `closed_at` / `closedAt`; yo'q yoki buzuq bo'lsa — hozir", () => {
    expect(readClosedAt({ closed_at: "2026-10-23T13:00:00.000Z" }).toISOString()).toBe("2026-10-23T13:00:00.000Z");
    expect(readClosedAt({ closedAt: "2026-10-23T14:30:00.000Z" }).toISOString()).toBe("2026-10-23T14:30:00.000Z");
    vi.useFakeTimers({ now: new Date("2026-10-23T15:00:00.000Z") });
    expect(readClosedAt({ closed_at: "buzuq" }).toISOString()).toBe("2026-10-23T15:00:00.000Z");
    expect(readClosedAt(null).toISOString()).toBe("2026-10-23T15:00:00.000Z");
    vi.useRealTimers();
  });

  it("smena holati (`shift`) va kassa so'rovlari yangilanadi", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await refreshShiftQueries(client);
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(["shift"]));
    expect(keys).toContain(JSON.stringify(["cashbox"]));
  });
});
