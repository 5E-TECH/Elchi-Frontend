import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { FINANCE_SHIFT_EVENTS, readClosedAt, refreshShiftQueries } from "./realtimeFinance";

/** rWdLuoP3 — smena jonli hodisalari: nomlar, yopilish vaqti va yangilanadigan so'rovlar. */
describe("realtimeFinance", () => {
  it("tinglanadigan hodisalar — kartadagi uchta nom", () => {
    expect(FINANCE_SHIFT_EVENTS).toEqual(["finance.shift.closed", "finance.shift.auto_closed", "finance.shift.account_checked"]);
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
