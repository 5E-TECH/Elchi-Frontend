import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: apiMock }));

import { fetchExternalBatchScan } from "./index";

/**
 * «Kiruvchi buyurtmalar» paket skaneri (sekin internet, 2026-11-07): `GET scan/:token` — skaner qidiruvi, tezkor
 * (`failFast`: 20 s, jim qayta urinish yo'q). Aks holda sekin liniyada «topilmadi» ~4 daqiqadan keyin kelib, shu
 * orada skanerlangan kodning xabarini bosib ketardi.
 */
beforeEach(() => {
  apiMock.get.mockReset();
});

describe("fetchExternalBatchScan", () => {
  it("skaner qidiruvi failFast bilan ketadi (kod URL'da kodlangan)", async () => {
    apiMock.get.mockResolvedValue({ data: { type: "batch", data: { tokens: ["A1"] } } });

    await fetchExternalBatchScan("BTB 7/1");

    expect(apiMock.get).toHaveBeenCalledTimes(1);
    expect(apiMock.get).toHaveBeenCalledWith("scan/BTB%207%2F1", { failFast: true });
  });
});
