import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportMainCashboxReport } from "./exportMainCashboxReport";

const http = vi.hoisted(() => ({ get: vi.fn() }));
const save = vi.hoisted(() => vi.fn());

vi.mock("../../../../shared/api/api", () => ({ api: http, LONG_REQUEST_TIMEOUT_MS: 120_000 }));
vi.mock("../../../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveBlob: save,
}));

const call = () => http.get.mock.calls[0] as [string, { params: unknown; responseType: string; timeout: number }];

describe("exportMainCashboxReport", () => {
  beforeEach(() => {
    http.get.mockResolvedValue({
      data: new Blob(["x"]),
      headers: { "content-disposition": 'attachment; filename="kassa-hisobot-2026-11-25.xlsx"' },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("smena yopilganda — faqat shu smena (sana filtri e'tiborsiz); nom serverdan", async () => {
    await exportMainCashboxReport({ shiftId: "16", fromDate: "2026-11-01", toDate: "2026-11-25" });
    expect(call()[0]).toBe("export/cashbox-report.xlsx");
    expect(call()[1]).toMatchObject({ params: { shift_id: "16" }, responseType: "blob", timeout: 120_000 });
    expect(save).toHaveBeenCalledWith(expect.any(Blob), "kassa-hisobot-2026-11-25.xlsx");
  });

  it("tugma: sana filtri; filtrsiz — parametrsiz (server: bugun), butun tarix emas", async () => {
    await exportMainCashboxReport({ fromDate: "2026-11-01", toDate: "2026-11-25" });
    expect(call()[1].params).toEqual({ from_date: "2026-11-01", to_date: "2026-11-25" });
    http.get.mockClear();
    await exportMainCashboxReport({});
    expect(call()[1].params).toEqual({});
  });

  it("sarlavha o'qilmasa — zaxira nom; xato yuqoriga (fayl saqlanmaydi)", async () => {
    http.get.mockResolvedValueOnce({ data: new Blob(["x"]), headers: {} });
    await exportMainCashboxReport({ shiftId: "16" });
    expect(save).toHaveBeenCalledWith(expect.any(Blob), "kassa-hisobot-smena-16.xlsx");
    save.mockClear();
    http.get.mockRejectedValueOnce(new Error("403"));
    await expect(exportMainCashboxReport({})).rejects.toThrow("403");
    expect(save).not.toHaveBeenCalled();
  });
});
