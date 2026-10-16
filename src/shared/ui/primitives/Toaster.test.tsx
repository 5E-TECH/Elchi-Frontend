import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { notify, TOAST_EXIT_MS, toastStore } from "../../lib/notify";
import { getPortalRoot } from "./overlay";
import { Toast, Toaster } from "./Toaster";

/**
 * Toaster — `.el-toast` (CODE-MAP 2.7, `tizim-feedback` 01–02, `tizim-motion`): ton ikonkasi + matn,
 * doimiy e'lon hududlari (status / alert), yopish, amal, Esc, kursor/fokusda vaqt to'xtashi,
 * telefonda bittadan, v1 oyna ustida qatlam.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  toastStore.reset();
});

afterEach(() => {
  act(() => toastStore.reset());
  vi.useRealTimers();
  document.querySelectorAll("[data-test-modal]").forEach((node) => node.remove());
});

const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const region = () => screen.getByRole("region", { name: "Bildirishnomalar" });
const rows = () => within(region()).getAllByRole("listitem");
const flushExit = () => act(() => vi.advanceTimersByTime(TOAST_EXIT_MS));

describe("Toaster", () => {
  it("React'dan tashqarida chaqirilgan xabarni chizadi: ikonka, sarlavha, izoh, yopish", () => {
    render(<Toaster />);
    expect(screen.queryByRole("region", { name: "Bildirishnomalar" })).not.toBeInTheDocument();

    act(() => {
      notify.success("To'lov o'tkazildi", { description: "Asosiy kassaga o'tkazildi." });
    });

    const [row] = rows();
    expect(row).toHaveAttribute("data-tone", "success");
    expect(within(row).getByText("To'lov o'tkazildi")).toBeInTheDocument();
    expect(within(row).getByText("Asosiy kassaga o'tkazildi.")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Xabarni yopish" })).toBeInTheDocument();
    const icon = row.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.getAttribute("class")).toContain("text-success-fg");
  });

  it("e'lon: muvaffaqiyat — role=status, xato — role=alert (doimiy hududlar)", () => {
    render(<Toaster />);
    const status = document.querySelector('[data-toast-announcer="status"]');
    const alert = document.querySelector('[data-toast-announcer="alert"]');
    expect(status).toHaveAttribute("role", "status");
    expect(alert).toHaveAttribute("role", "alert");
    expect(status).toBeEmptyDOMElement();

    act(() => {
      notify.success("Saqlandi", { description: "248 ta buyurtma" });
      notify.error("Hisobot yuklanmadi");
    });
    expect(status).toHaveTextContent("Saqlandi. 248 ta buyurtma");
    expect(alert).toHaveTextContent("Hisobot yuklanmadi");
    // Xabar fokusni olmaydi.
    expect(document.body).toHaveFocus();
  });

  it("× bosilsa yopiladi (200 ms harakatdan keyin ro'yxatdan chiqadi)", async () => {
    const user = setup();
    render(<Toaster />);
    act(() => {
      notify.error("Ruxsat yo'q");
    });
    await user.click(within(rows()[0]).getByRole("button", { name: "Xabarni yopish" }));
    expect(rows()[0]).toHaveAttribute("data-closing");
    flushExit();
    expect(screen.queryByRole("region", { name: "Bildirishnomalar" })).not.toBeInTheDocument();
  });

  it("amal tugmasi: chaqiradi va xabarni yopadi", async () => {
    const user = setup();
    const undo = vi.fn();
    render(<Toaster />);
    act(() => {
      notify.success("Buyurtma ro'yxatdan olib tashlandi", { action: { label: "Bekor qilish", onClick: undo } });
    });
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toHaveAttribute("data-closing");
  });

  it("klaviatura: Esc fokusdagi xabarni yopadi, fokus keyingisiga, oxirida — avvalgi joyga qaytadi", async () => {
    const user = setup();
    render(
      <>
        <button type="button">Saqlash</button>
        <Toaster />
      </>,
    );
    act(() => {
      notify.error("Birinchi");
      notify.error("Ikkinchi");
    });
    // Ilovadagidek: `#ui-portal` sahifa ildizidan KEYIN (Tab sahifadan xabarlarga o'tadi).
    document.body.appendChild(getPortalRoot());
    const opener = screen.getByRole("button", { name: "Saqlash" });
    opener.focus();
    await user.tab();
    const firstClose = within(rows()[0]).getByRole("button", { name: "Xabarni yopish" });
    expect(firstClose).toHaveFocus();
    expect(toastStore.isPaused()).toBe(true);

    await user.keyboard("{Escape}");
    expect(rows()[0]).toHaveAttribute("data-closing");
    expect(within(rows()[1]).getByRole("button", { name: "Xabarni yopish" })).toHaveFocus();
    flushExit();

    await user.keyboard("{Escape}");
    flushExit();
    expect(opener).toHaveFocus();
    expect(toastStore.isPaused()).toBe(false);
  });

  it("kursor ustida — vaqt to'xtaydi, chiqsa — davom etadi", async () => {
    const user = setup();
    render(<Toaster />);
    act(() => {
      notify.success("Saqlandi");
    });
    await user.hover(rows()[0]);
    act(() => vi.advanceTimersByTime(10_000));
    expect(rows()[0]).not.toHaveAttribute("data-closing");
    await user.unhover(rows()[0]);
    act(() => vi.advanceTimersByTime(4000));
    expect(rows()[0]).toHaveAttribute("data-closing");
  });

  it("kursor ostidagi xabar yopilsa — kursor boshqa joyga o'tgach qolganlarining vaqti davom etadi", async () => {
    const user = setup();
    render(
      <>
        <p>Sahifa</p>
        <Toaster />
      </>,
    );
    let first = "";
    act(() => {
      first = notify.success("Birinchi");
      notify.info("Ikkinchi");
    });
    await user.hover(within(rows()[0]).getByText("Birinchi"));
    expect(toastStore.isPaused()).toBe(true);
    // Kursor ostidagi xabar DOM'dan chiqdi — undan `pointerleave` kelmaydi.
    act(() => notify.dismiss(first));
    flushExit();
    await user.hover(screen.getByText("Sahifa"));
    expect(toastStore.isPaused()).toBe(false);
    act(() => vi.advanceTimersByTime(4000));
    expect(rows()[0]).toHaveAttribute("data-closing");
  });

  it("e'lon: bir lahzada kelgan xabarlar alohida qator bo'lib qo'shiladi (aria-atomic=false)", () => {
    render(<Toaster />);
    const status = document.querySelector('[data-toast-announcer="status"]');
    expect(status).toHaveAttribute("aria-atomic", "false");
    act(() => {
      notify.success("Excelga saqlandi");
      notify.warning("To'lov allaqachon yozilgan");
    });
    expect(Array.from(status?.children ?? []).map((node) => node.textContent)).toEqual([
      "Excelga saqlandi",
      "To'lov allaqachon yozilgan",
    ]);
  });

  it("3 tadan ortiq ko'rinmaydi; telefonda faqat oxirgisi (`max-md:not-last:hidden`)", () => {
    render(<Toaster />);
    act(() => {
      notify.success("1");
      notify.success("2");
      notify.success("3");
      notify.success("4");
    });
    flushExit();
    expect(rows().map((row) => row.textContent)).toEqual(["2", "3", "4"]);
    for (const row of rows()) expect(row.className).toContain("max-md:not-last:hidden");
    // Harakat kamaytirilganda o'tish yo'q.
    expect(rows()[0].className).toContain("motion-reduce:transition-none");
  });

  it("qatlam: sukut — toast (1300); v1 oyna ochiq bo'lsa — uning ustida", () => {
    render(<Toaster />);
    const container = document.querySelector<HTMLElement>('[data-ui-layer="toast"]');
    act(() => {
      notify.info("Birinchi");
    });
    expect(container?.style.zIndex).toBe("1300");

    const modal = document.createElement("div");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("data-test-modal", "");
    modal.style.position = "fixed";
    modal.style.zIndex = "9998";
    document.body.appendChild(modal);
    act(() => {
      notify.error("Sotib bo'lmadi");
    });
    expect(container?.style.zIndex).toBe("9999");
  });
});

describe("Toast (ko'rinish)", () => {
  it("tonlar: ikonka rangi tondan, matn neytral; amal havola ko'rinishida", () => {
    const onClick = vi.fn();
    render(
      <Toast tone="warning" title="To'lov allaqachon yozilgan" description="Kassa yangilandi" action={{ label: "Qayta urinish", onClick }} />,
    );
    const card = screen.getByText("To'lov allaqachon yozilgan").closest("[data-tone]");
    expect(card).toHaveClass("bg-raised", "border-border", "rounded-xl", "shadow-xl");
    expect(card?.querySelector("svg")?.getAttribute("class")).toContain("text-warning-fg");
    expect(screen.getByText("Kassa yangilandi")).toHaveClass("text-text-muted");
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toHaveAttribute("data-variant", "link");
    expect(screen.queryByRole("button", { name: "Xabarni yopish" })).not.toBeInTheDocument();
  });

  it("xato — CircleX `danger-fg`", () => {
    render(<Toast tone="error" title="Ruxsat yo'q" onClose={() => {}} />);
    const card = screen.getByText("Ruxsat yo'q").closest("[data-tone]");
    expect(card?.querySelector("svg")?.getAttribute("class")).toContain("text-danger-fg");
    expect(screen.getByRole("button", { name: "Xabarni yopish" })).toBeInTheDocument();
  });
});
