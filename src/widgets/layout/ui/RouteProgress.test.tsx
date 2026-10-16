import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import RouteProgress, { ROUTE_PROGRESS_DELAY_MS, RouteProgressBar, RouteSuspenseFallback } from "./RouteProgress";
import { __resetNavigationPendingForTests } from "../../../shared/lib/navigationPending";

/**
 * Yuqori chiziq (maket `tizim-loading`): 150 ms gacha ko'rinmaydi, keyin
 * `role="progressbar"`, tugagach so'nib yo'qoladi. `absolute` — joy egallamaydi.
 */
const renderBar = (active: boolean) =>
  render(
    <I18nextProvider i18n={i18n}>
      <RouteProgressBar active={active} />
    </I18nextProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  __resetNavigationPendingForTests();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("RouteProgressBar", () => {
  it("⭐ 150 ms gacha hech narsa chizilmaydi (tez javobda miltillash yo'q)", () => {
    renderBar(true);
    advance(ROUTE_PROGRESS_DELAY_MS - 10);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("⭐ 150 ms dan keyin: progressbar, nomi bor, joy egallamaydi, rangi action tokenlari", () => {
    renderBar(true);
    advance(ROUTE_PROGRESS_DELAY_MS + 20);
    const bar = screen.getByRole("progressbar", { name: "Sahifa yuklanmoqda" });
    expect(bar.className).toMatch(/\babsolute\b/);
    expect(bar.className).toMatch(/\binset-x-0\b/);
    expect(bar.className).toMatch(/\bh-\[3px\]/);
    expect(bar.className).toMatch(/\bbg-action-soft\b/);
    expect(bar.className).toMatch(/\bpointer-events-none\b/);
    expect(bar.className).toMatch(/motion-reduce:transition-none/);
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.className).toMatch(/\bbg-action\b/);
    expect(fill.className).toMatch(/motion-reduce:transition-none/);
    // Faqat transform (kenglik animatsiya qilinmaydi — maket `tizim-motion`).
    expect(fill.style.transform).toMatch(/^scaleX\(/);
  });

  it("tugagach: progressbar roli olinadi, chiziq so'nadi va DOM dan chiqadi", () => {
    const view = renderBar(true);
    advance(ROUTE_PROGRESS_DELAY_MS + 20);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    view.rerender(
      <I18nextProvider i18n={i18n}>
        <RouteProgressBar active={false} />
      </I18nextProvider>,
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
    const fading = view.container.querySelector("[data-route-progress]") as HTMLElement;
    expect(fading).toHaveAttribute("aria-hidden", "true");
    expect(fading.className).toMatch(/\bopacity-0\b/);
    expect((fading.firstElementChild as HTMLElement).style.transform).toBe("scaleX(1)");

    advance(500);
    expect(view.container.querySelector("[data-route-progress]")).toBeNull();
  });

  it("⭐ taymer `active` o'chgandan keyin otilsa ham chiziq qotib qolmaydi (tez yo'naltirish poygasi)", () => {
    // Taymer/kadr effekt tozalanishidan oldin otilgan holat: `active=false` paytida faza «start»/«grow» bo'lib qolsa
    // ham chiziq so'nishi kerak. Haqiqiy brauzerda: menejer `/` → `/branch-dashboard` da chiziq 90% da qotardi.
    const spy = vi.spyOn(window, "clearTimeout").mockImplementation(() => undefined);
    const view = renderBar(true);
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <RouteProgressBar active={false} />
      </I18nextProvider>,
    );
    // Tozalanmagan (tozalash «kechikkan») 150 ms taymeri endi otiladi.
    advance(ROUTE_PROGRESS_DELAY_MS + 20);
    advance(1000);
    expect(view.container.querySelector("[data-route-progress]")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    spy.mockRestore();
  });

  it("150 ms ichida tugagan yuklanish umuman ko'rinmaydi", () => {
    const view = renderBar(true);
    advance(80);
    view.rerender(
      <I18nextProvider i18n={i18n}>
        <RouteProgressBar active={false} />
      </I18nextProvider>,
    );
    advance(1000);
    expect(view.container.querySelector("[data-route-progress]")).toBeNull();
  });
});

describe("RouteProgress (shell)", () => {
  it("shell Suspense fallback'i turganida chiziq yonadi", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <RouteProgress />
          <RouteSuspenseFallback />
        </MemoryRouter>
      </I18nextProvider>,
    );
    advance(ROUTE_PROGRESS_DELAY_MS + 20);
    expect(screen.getByRole("progressbar", { name: "Sahifa yuklanmoqda" })).toBeInTheDocument();
  });

  it("hech narsa yuklanmayotganda chiziq yo'q", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <RouteProgress />
        </MemoryRouter>
      </I18nextProvider>,
    );
    advance(1000);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
