import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadReceiptFontData,
  resetReceiptFontCache,
} from "../../../features/print-receipts/lib/printReceiptFonts";
import i18n from "../../../i18n";
import { receiptDiskFontLoader } from "../../../test/receiptTestFonts";
import { renderWithProviders } from "../../../test/test-utils";
import { ReceiptsSection } from "./ReceiptsSection";

/**
 * `/ops/ui-kit?section=receipts` (HJ5sLHiz, TZ qabul 2 / FE-5): maket `tizim-receipts` namunalari chop etishdagi HTML
 * renderer bilan, maket masshtabida (termal 1 mm = 5 px, A5 — 3 px, A4 — kichik nusxa); kunduzgi va tungi panel.
 */

const PREVIEW_IDS = [
  "main",
  "partial",
  "paid",
  "returning",
  "elNumber",
  "continuation",
  "batchThermal",
  "batchA5",
  "post",
  "a4",
];

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterAll(() => {
  resetReceiptFontCache();
});

const lightPanel = () => document.querySelector<HTMLElement>('[data-kit-theme="light"]')!;
const frames = (id: string) =>
  Array.from(
    lightPanel().querySelectorAll<HTMLIFrameElement>(`[data-receipt-preview="${id}"] iframe`),
  );

describe("ReceiptsSection", () => {
  it("font download fails → error state with retry; retry renders every mockup sample", async () => {
    const user = userEvent.setup();
    resetReceiptFontCache();
    // jsdom'da shrift URL'ini `fetch` qilib bo'lmaydi — birinchi urinish «shrift yuklanmadi» bilan yiqiladi.
    renderWithProviders(<ReceiptsSection />, { route: "/ops/ui-kit?section=receipts" });
    expect(screen.getByRole("heading", { level: 2, name: "Cheklar va yorliqlar" })).toBeInTheDocument();
    const retry = await within(lightPanel()).findByRole("button", { name: "Qayta urinish" });

    await loadReceiptFontData(receiptDiskFontLoader);
    await user.click(retry);

    expect(await within(lightPanel()).findByText("Yangi", {}, { timeout: 10_000 })).toBeInTheDocument();
    const ids = Array.from(lightPanel().querySelectorAll("[data-receipt-preview]")).map((figure) =>
      figure.getAttribute("data-receipt-preview"),
    );
    expect(ids).toEqual(PREVIEW_IDS);
    // Tungi panelda ham o'sha namunalar (qog'oz doim oq-qora).
    expect(
      document.querySelectorAll('[data-kit-theme="dark"] [data-receipt-preview]'),
    ).toHaveLength(PREVIEW_IDS.length);

    // Termal 100×60 — 1 mm = 5 px → 500 × 300; matn chop etish HTML'idan.
    const [main] = frames("main");
    expect(main).toHaveAttribute("width", "500");
    expect(main).toHaveAttribute("height", "300");
    expect(main).toHaveAttribute("title", "Yangi, 1-sahifa");
    expect(main.getAttribute("srcdoc")).toContain("transform:scale(");
    expect(main.getAttribute("srcdoc")).toContain("№10241");
    expect(within(lightPanel()).getAllByText("100×60 mm · 1 mm = 5 px").length).toBeGreaterThan(0);

    const html = (id: string) => frames(id).map((frame) => frame.getAttribute("srcdoc") ?? "").join("");
    const text = (id: string) => new DOMParser().parseFromString(html(id), "text/html").body.textContent ?? "";
    expect(text("partial")).toContain("jami");
    expect(text("paid")).toContain("To'langan");
    expect(text("returning")).toContain("Qaytarish");
    expect(text("elNumber")).toContain("№EL-100081");
    // 1/2 + 2/2 — ikki sahifa.
    expect(frames("continuation")).toHaveLength(2);
    expect(text("continuation")).toContain("2/2");
    expect(text("batchThermal")).toContain("FILIAL PAKETI");
    expect(text("post")).toContain("POCHTA");
    // A5 — 1 mm = 3 px (148 × 210 mm), A4 varaq — kichik nusxa (1 mm = 1,5 px).
    expect(frames("batchA5")[0]).toHaveAttribute("width", "444");
    expect(frames("batchA5")[0]).toHaveAttribute("height", "630");
    expect(frames("a4")[0]).toHaveAttribute("width", "315");
    expect(within(lightPanel()).getByText("210×297 mm · 1 mm = 1,5 px")).toBeInTheDocument();
    expect(text("a4")).toContain("QR yo'q");
  }, 30_000);
});
