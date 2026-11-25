import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportOldMailsToExcel,
  toOldMailsPayload,
  type OldMailExportRow,
  type OldMailsExportInput,
  type OldMailsExportLabels,
} from "./exportOldMailsToExcel";
import { OLD_MAILS_EXPORT_MAX_ROWS } from "../../model/oldMailsModel";

const http = vi.hoisted(() => ({ post: vi.fn() }));
const save = vi.hoisted(() => vi.fn());

vi.mock("../../../../shared/api/api", () => ({ api: http, LONG_REQUEST_TIMEOUT_MS: 120_000 }));
vi.mock("../../../../shared/lib/exportFile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveBlob: save,
}));

const labels = new Proxy({} as OldMailsExportLabels, { get: (_target, key) => String(key) });
const row = (over: Partial<OldMailExportRow> = {}): OldMailExportRow => ({
  id: "2417",
  region: "Buxoro",
  courier: "Ali Valiyev",
  status: "Qabul qilingan",
  statusTone: "success",
  orders: 3,
  amount: 650_000,
  createdAt: "2026-10-15T12:33:00.000Z",
  ...over,
});
const input = (over: Partial<OldMailsExportInput> = {}): OldMailsExportInput => ({
  title: "Eski pochtalar hisoboti",
  capped: false,
  hideCourier: false,
  rows: [row()],
  labels,
  ...over,
});

describe("toOldMailsPayload", () => {
  it("server shartnomasi: snake_case qator va yorliqlar", () => {
    const payload = toOldMailsPayload(input({ subtitle: "Viloyat: Buxoro" }));
    expect(payload).toMatchObject({
      title: "Eski pochtalar hisoboti",
      subtitle: "Viloyat: Buxoro",
      capped: false,
      hide_courier: false,
    });
    expect(payload.rows).toEqual([
      {
        id: "2417",
        region: "Buxoro",
        courier: "Ali Valiyev",
        status: "Qabul qilingan",
        status_tone: "success",
        orders: 3,
        amount: 650_000,
        created_at: "2026-10-15T12:33:00.000Z",
      },
    ]);
    expect(payload.labels).toMatchObject({ mail_id: "mailId", total_amount: "totalAmount", capped_note: "cappedNote" });
  });

  it("chegaralar: uzun matn kesiladi, kuryer yo'q — null, buzuq son — 0, kasr 2 xona", () => {
    const [item] = toOldMailsPayload(
      input({ rows: [row({ region: "x".repeat(300), courier: "", statusTone: null, orders: Number.NaN, amount: 10.456 })] }),
    ).rows;
    expect(item.region).toHaveLength(120);
    expect(item).toMatchObject({ courier: null, orders: 0, amount: 10.46 });
    expect(item).not.toHaveProperty("status_tone");
  });

  it("10 000 dan ko'p qator — birinchi 10 000 tasi va `capped`", () => {
    const payload = toOldMailsPayload(input({ rows: Array.from({ length: OLD_MAILS_EXPORT_MAX_ROWS + 5 }, () => row()) }));
    expect(payload.rows).toHaveLength(OLD_MAILS_EXPORT_MAX_ROWS);
    expect(payload.capped).toBe(true);
  });
});

describe("exportOldMailsToExcel", () => {
  beforeEach(() => {
    http.post.mockResolvedValue({
      data: new Blob(["x"]),
      headers: { "content-disposition": 'attachment; filename="old-mails-2026-11-25.xlsx"' },
    });
  });
  afterEach(() => vi.clearAllMocks());

  it("POST export/old-mails.xlsx → fayl server nomi bilan; xato yuqoriga", async () => {
    await exportOldMailsToExcel(input());
    expect(http.post.mock.calls[0][0]).toBe("export/old-mails.xlsx");
    expect(http.post.mock.calls[0][2]).toEqual({ responseType: "blob", timeout: 120_000 });
    expect(save).toHaveBeenCalledWith(expect.any(Blob), "old-mails-2026-11-25.xlsx");
    save.mockClear();
    http.post.mockRejectedValueOnce(new Error("413"));
    await expect(exportOldMailsToExcel(input())).rejects.toThrow("413");
    expect(save).not.toHaveBeenCalled();
  });
});
