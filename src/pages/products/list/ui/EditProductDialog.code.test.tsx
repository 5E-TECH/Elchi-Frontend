import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isScannerOverlayOpen, resetScannerHost } from "../../../../shared/lib/scanner/scannerHost";
import { getActiveScanTarget, resetScanTargets } from "../../../../shared/lib/scanner/scanTargets";
import { renderWithProviders } from "../../../../test/test-utils";
import { EditProductDialog } from "./EditProductDialog";

/**
 * yXC91RRx — «Mahsulot kodi» (maket `superadmin-products-edit-dialog-barcode`): zavod shtrix kodi `PATCH product/:id`
 * FormData `barcode` (faqat o'zgarsa), Elchi kodi faqat o'qish, 40×30 stiker ko'rinishi va chop etish menyusi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));

vi.mock("../../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: mocks.patch, put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const KURTKA = {
  id: 123,
  name: "Bolalar kurtkasi, 110 sm",
  price: 320000,
  weight_kg: 0.9,
  length_cm: 40,
  width_cm: 30,
  height_cm: 15,
  volumetric_enabled: false,
  barcode: null,
  sku_code: "ELC-P-000123",
  market: { id: 121, name: "Baraka Shop" },
};

beforeEach(() => {
  mocks.get.mockReset().mockImplementation((url: string) => {
    if (url === "product/123") return Promise.resolve({ data: { data: KURTKA } });
    if (url === "delivery/pricing-settings") return Promise.resolve({ data: { data: { first_kg_included: 1, round_to: 500 } } });
    return Promise.reject(new Error(`kutilmagan: ${url}`));
  });
  mocks.post.mockReset().mockRejectedValue(new Error("quote"));
  mocks.patch.mockReset().mockResolvedValue({ data: { data: KURTKA } });
});

const renderDialog = (product = KURTKA, onClose = vi.fn()) =>
  renderWithProviders(<EditProductDialog product={product} onClose={onClose} />, {
    preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "superadmin" } } as never,
  });

const sentForm = () => mocks.patch.mock.calls.at(-1)?.[1] as FormData;

describe("EditProductDialog — «Mahsulot kodi» (yXC91RRx)", () => {
  it("bo'lim: shtrix kod maydoni, Elchi kodi (faqat o'qish), stiker ko'rinishi va «QR stiker chop etish»", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByRole("heading", { name: "Mahsulot kodi" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Shtrix kod (EAN-13)" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Elchi kodi" })).toHaveAttribute("readonly");
    expect(screen.getByRole("img", { name: /Stiker ko'rinishi: Bolalar kurtkasi, 110 sm, ELC-P-000123/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "QR stiker chop etish" }));
    expect(screen.getByRole("menuitem", { name: "Termal 40×30 mm" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Termal 58×40 mm" })).toBeInTheDocument();
  });

  it("shtrix kod kiritilsa — FormData `barcode`; USB skaner Enter'i oynani saqlamaydi", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(KURTKA, onClose);
    const field = await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" });
    await user.type(field, "4780123450017{Enter}");
    expect(mocks.patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0][0]).toBe("product/123");
    expect(sentForm().get("barcode")).toBe("4780123450017");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("kod o'zgarmasa — `barcode` yuborilmaydi", async () => {
    const user = userEvent.setup();
    renderDialog({ ...KURTKA, barcode: "4780123450017" } as never);
    expect(await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" })).toHaveValue("4780123450017");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalled());
    expect(sentForm().has("barcode")).toBe(false);
  });

  it("noto'g'ri nazorat raqami — maydon ostida xato, so'rov ketmaydi", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" }), "4780123450018");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Shtrix kod noto'g'ri — nazorat raqami mos emas")).toBeInTheDocument();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("409 kod dublikati — «Mahsulot nomi» emas, shtrix kod ostida", async () => {
    mocks.patch.mockRejectedValueOnce(
      Object.assign(new Error("Conflict"), {
        response: { status: 409, data: { message: 'Bu marketda shu shtrix kod "Pepsi 0.5" mahsulotiga biriktirilgan' } },
      }),
    );
    const user = userEvent.setup();
    renderDialog();
    await user.type(await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" }), "4780123450017");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(await screen.findByText("Bu shtrix kod shu marketning boshqa mahsulotiga biriktirilgan")).toBeInTheDocument();
    expect(screen.queryByText(/nomli mahsulot/i)).not.toBeInTheDocument();
  });
});

describe("EditProductDialog — «Shtrix kod» kamera bilan (CO66kcoB)", () => {
  afterEach(() => {
    resetScannerHost();
    resetScanTargets();
  });

  it("«Kamera» → oyna maqsadi (shtrix kod rejimi, bitta qiymat); o'qilgan kod maydonga yoziladi va saqlanadi", async () => {
    const user = userEvent.setup();
    renderDialog();
    const field = await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" });
    await user.click(screen.getByRole("button", { name: "Shtrix kodni kamera bilan skanerlash" }));
    expect(isScannerOverlayOpen()).toBe(true);
    const target = getActiveScanTarget();
    expect(target).toMatchObject({
      id: "product-barcode",
      layer: "dialog",
      formats: "barcodes",
      closeOnSuccess: true,
      title: "Shtrix kodni skanerlash",
      context: "Bolalar kurtkasi, 110 sm",
    });
    await act(async () => target?.onScan(" 4780123450017\n", "camera"));
    expect(field).toHaveValue("4780123450017");
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(sentForm().get("barcode")).toBe("4780123450017");
  });

  it("Elchi stikeri (`ELC-P-…`) shtrix kod sifatida yozilmaydi", async () => {
    renderDialog({ ...KURTKA, barcode: "8806095467894" } as never);
    const field = await screen.findByRole("textbox", { name: "Shtrix kod (EAN-13)" });
    await act(async () => getActiveScanTarget()?.onScan("ELC-P-000123", "camera"));
    expect(field).toHaveValue("8806095467894");
  });

  it("oyna yopilsa — kamera ham yopiladi, maqsad olinadi", async () => {
    const Harness = () => {
      const [product, setProduct] = useState<typeof KURTKA | null>(KURTKA);
      return <EditProductDialog product={product as never} onClose={() => setProduct(null)} />;
    };
    const user = userEvent.setup();
    renderWithProviders(<Harness />, {
      preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "superadmin" } } as never,
    });
    await user.click(await screen.findByRole("button", { name: "Shtrix kodni kamera bilan skanerlash" }));
    expect(isScannerOverlayOpen()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(isScannerOverlayOpen()).toBe(false));
    expect(getActiveScanTarget()).toBeNull();
  });
});
