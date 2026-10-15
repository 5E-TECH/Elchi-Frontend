import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import ConnectionControl from "./ConnectionControl";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * ISH REJIMI (fG48Xv5X): Master + Kiruvchi webhook + Solishtiruvchi kalitlari,
 * «Hoziroq tenglashtirish» va «Oxirgi solishtiruv».
 */

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({ api }));

const integration = (id: string, over: Record<string, unknown> = {}) =>
  ({
    uid: `integration:${id}`,
    kind: "integration",
    id,
    name: "Kargo",
    role: "carrier",
    category: "cargo",
    is_active: true,
    subtitle: "",
    raw: { slug: "kargo", type: "api" },
    ...over,
  }) as unknown as Connection;

const partner = {
  ...integration("p1"),
  uid: "partner:p1",
  kind: "partner",
} as unknown as Connection;

let detail: Record<string, unknown>;

const axiosError = (status: number, message: string) =>
  new AxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { statusCode: status, message },
  } as AxiosResponse);

const render = (connection: Connection = integration("7")) =>
  renderWithProviders(<ConnectionControl connection={connection} onChanged={vi.fn()} />, {
    preloadedState: { role: { id: "1", role: "superadmin", region: null, name: "Admin" } } as never,
  });

beforeEach(() => {
  api.get.mockReset();
  api.patch.mockReset();
  api.post.mockReset();
  detail = { id: "7", slug: "kargo", is_active: true, webhook_enabled: true, reconcile_enabled: false, last_reconcile_at: null };
  api.get.mockImplementation((url: string) =>
    url === "integrations/7"
      ? Promise.resolve({ data: { statusCode: 200, data: detail } })
      : Promise.resolve({ data: { statusCode: 200, data: [] } }),
  );
  api.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
});

describe("ConnectionControl — kalitlar (fG48Xv5X)", () => {
  it("Master, Kiruvchi webhook va Solishtiruvchi qatorlari: holat tegi va oqibat izohi bilan", async () => {
    render();
    const webhook = await screen.findByTestId("ctl-row-webhook");
    const reconcile = screen.getByTestId("ctl-row-reconcile");
    const master = screen.getByTestId("ctl-row-master");

    expect(within(master).getByRole("switch", { name: "Master kalit" })).toHaveAttribute("aria-checked", "true");
    expect(within(webhook).getByRole("switch", { name: "Kiruvchi webhook" })).toHaveAttribute("aria-checked", "true");
    expect(within(reconcile).getByRole("switch", { name: "Solishtiruvchi (CRON)" })).toHaveAttribute("aria-checked", "false");
    expect(within(reconcile).getAllByText("O'chiq").length).toBeGreaterThan(0);
    expect(within(webhook).getByText(/status hodisalari qabul qilinmaydi/)).toBeInTheDocument();
    expect(
      screen.getByText("Master o'chiq bo'lsa quyi kalitlar ta'sir qilmaydi — hech qanday jarayon ishlamaydi."),
    ).toBeInTheDocument();
  });

  it("quyi kalit → PATCH /integrations/:id faqat o'sha bayroq bilan", async () => {
    const user = userEvent.setup();
    render();
    await user.click(await screen.findByRole("switch", { name: "Solishtiruvchi (CRON)" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    expect(api.patch).toHaveBeenCalledWith("integrations/7", { slug: "kargo", type: "api", reconcile_enabled: true });

    await user.click(screen.getByRole("switch", { name: "Kiruvchi webhook" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch).toHaveBeenLastCalledWith("integrations/7", { slug: "kargo", type: "api", webhook_enabled: false });
  });

  it("eski backend (bayroqlar yo'q) — faqat Master qatori", async () => {
    detail = { id: "7", slug: "kargo", is_active: true };
    render();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("integrations/7"));
    expect(screen.getByTestId("ctl-row-master")).toBeInTheDocument();
    expect(screen.queryByTestId("ctl-row-webhook")).toBeNull();
    expect(screen.queryByTestId("ctl-row-reconcile")).toBeNull();
  });

  it("hamkorda faqat Master; jarayon yo'qligi izohi, «Hoziroq tenglashtirish» yo'q", () => {
    render(partner);
    expect(screen.getByTestId("ctl-row-master")).toBeInTheDocument();
    expect(screen.queryByTestId("ctl-row-webhook")).toBeNull();
    expect(screen.getByText("Bu ulanishda qo'lda yurgiziladigan jarayon yo'q")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hoziroq tenglashtirish/ })).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("integrations/p1");
  });
});

describe("ConnectionControl — «Hoziroq tenglashtirish» (fG48Xv5X)", () => {
  it("POST reconcile-now → natija xabari (checked/applied/failed), «Oxirgi solishtiruv» yangilanadi", async () => {
    const user = userEvent.setup();
    api.post.mockImplementation(async () => {
      detail = { ...detail, last_reconcile_at: "2026-10-15T09:20:00.000Z" };
      return { data: { statusCode: 200, data: { checked: 1200, applied: 3, failed: 1 } } };
    });
    render();
    const tile = await screen.findByTestId("ctl-last-reconcile");
    expect(tile).toHaveTextContent("Hali bo'lmagan");

    await user.click(screen.getByRole("button", { name: /Hoziroq tenglashtirish/ }));
    expect(api.post).toHaveBeenCalledWith("integrations/7/reconcile-now", {});
    expect(
      await screen.findByText("Solishtiruv tugadi: tekshirildi 1 200, yangilandi 3, yiqildi 1"),
    ).toBeInTheDocument();
    await waitFor(() => expect(tile).not.toHaveTextContent("Hali bo'lmagan"));
    expect(tile).toHaveTextContent(/15\.10\.2026 \d{2}:20/);
  });

  it("409 — master o'chiq yoki boshqa solishtiruv ishlayapti", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(axiosError(409, "Reconcile already running"));
    render();
    await user.click(await screen.findByRole("button", { name: /Hoziroq tenglashtirish/ }));
    expect(
      await screen.findByText("Solishtiruv boshlanmadi: master kalit o'chiq yoki boshqa solishtiruv hozir ishlayapti."),
    ).toBeInTheDocument();
  });

  it("400 — status so'rovi sozlanmagan", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValue(axiosError(400, "status_query is not configured"));
    render();
    await user.click(await screen.findByRole("button", { name: /Hoziroq tenglashtirish/ }));
    expect(
      await screen.findByText("Solishtiruv uchun status so'rovi sozlanmagan — «Sozlamalar» bo'limida to'ldiring."),
    ).toBeInTheDocument();
  });
});

describe("ConnectionControl — Master'ni o'chirish faqat tasdiq bilan", () => {
  it("kalit o'chirilsa avval tasdiqlash oynasi; «Bekor qilish» — PATCH yo'q", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("switch", { name: "Master kalit" }));
    const dialog = screen.getByRole("alertdialog", { name: "Ulanishni o'chirish" });
    expect(within(dialog).getByText("Ulanish to'xtaydi.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("«Ha, o'chirish» → PATCH is_active=false, oyna yopiladi", async () => {
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole("button", { name: "To'xtatish" }));
    await user.click(screen.getByRole("button", { name: "Ha, o'chirish" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("integrations/7", { slug: "kargo", type: "api", is_active: false }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("server rad etsa oyna ochiq qoladi", async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValue(axiosError(500, "Ichki xato"));
    render();
    await user.click(screen.getByRole("switch", { name: "Master kalit" }));
    await user.click(screen.getByRole("button", { name: "Ha, o'chirish" }));
    expect(await screen.findByText("Ichki xato")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("o'chiq ulanishni YOQISH tasdiqsiz, darhol", async () => {
    const user = userEvent.setup();
    render(integration("7", { is_active: false }));
    await user.click(screen.getByRole("switch", { name: "Master kalit" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("integrations/7", { slug: "kargo", type: "api", is_active: true }));
  });
});
