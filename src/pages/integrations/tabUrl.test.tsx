import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import ConnectionsPage from "./ConnectionsPage";
import { renderWithProviders } from "../../test/test-utils";

/**
 * OCHIQ TAB URL'DA.
 *
 * ⚠️ NIMA BUZILGAN EDI. Tanlangan ulanish (`?c=`) URL'da edi, tab esa
 * `useState` da. Uch oqibati bor edi:
 *
 *  1. Sahifani yangilash tabni yo'qotardi — operator "Hodisalar" da xatoni
 *     ko'rib turib F5 bossa, "Umumiy holat" ga qaytardi.
 *  2. Havola yuborib bo'lmasdi: "Xavfsizlik tabiga qara" deb aytish uchun
 *     URL yetarli emasdi.
 *  3. Brauzer "orqaga" tugmasi tab almashinuvini bilmasdi.
 */

const apiGetMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiGetMock(...args),
    patch: (...args: unknown[]) => apiGetMock(...args),
  },
}));

/** Bitta hamkor — chiplar va panel chizilishi uchun yetarli. */
const PARTNER = {
  id: "7",
  name: "BeePost",
  webhook_url: "https://beepost.uz/hook",
  is_active: true,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("Ulanish paneli — tab URL'da", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockImplementation((url: string) => {
      if (String(url).includes("partners")) {
        return Promise.resolve({ data: { data: [PARTNER] } });
      }
      // Metrika va qolgan so'rovlar — bo'sh javob yetarli.
      return Promise.resolve({ data: { data: [] } });
    });
  });

  /**
   * ⚠️ `window.location` ISHLATILMAYDI. `renderWithProviders`
   * `MemoryRouter` ishlatadi — u brauzer manzilini o'zgartirmaydi, ya'ni
   * `window.location.search` HAR DOIM bo'sh bo'ladi va test jimgina
   * noto'g'ri natija berardi. Marshrut holati router'ning O'ZIDAN o'qiladi.
   */
  const LocationProbe = () => {
    const { search } = useLocation();
    return <span data-testid="search">{search}</span>;
  };

  const open = (route: string) =>
    renderWithProviders(
      <>
        <ConnectionsPage />
        <LocationProbe />
      </>,
      { route },
    );

  const currentSearch = () => screen.getByTestId("search").textContent ?? "";

  /**
   * ⚠️ `getByRole` ISHLATILMAYDI. antd v6 CSS-in-JS jsdom'da yaroqsiz
   * selektor chiqaradi (`span.mt-0,,, >.ant-switch:only-child`) va
   * `getByRole` ning a11y hisoblashi uslublarni o'qiyotganda `SyntaxError`
   * beradi. Matn bo'yicha topib, eng yaqin tugmani olamiz — natija ayni,
   * lekin uslublar o'qilmaydi.
   */
  const tabButton = (label: RegExp) => {
    /**
     * Matn bir nechta joyda uchraydi (sub-nav yorlig'i, panel ichidagi
     * sarlavha), shu bois TUGMALAR bo'ylab izlanadi — ya'ni faqat
     * bosiladigan element.
     */
    const buttons = Array.from(document.querySelectorAll("button"));
    const match = buttons.find((b) => label.test(b.textContent ?? ""));
    if (!match) throw new Error(`"${label}" uchun tugma topilmadi`);
    return match;
  };

  it("⭐ URL'dagi tab OCHILADI (havola ishlaydi)", async () => {
    /**
     * Eng muhim tekshiruv: `?t=security` bilan kelgan havola to'g'ridan-
     * to'g'ri Xavfsizlik tabini ochishi kerak. Ilgari har doim "Umumiy
     * holat" ochilardi va havola ma'nosiz edi.
     */
    open("/integrations/connections?c=partner:7&t=security");

    await waitFor(() => expect(tabButton(/Xavfsizlik/i)).toHaveAttribute("aria-current", "true"));
  });

  it("sukut bo'yicha 'Umumiy holat' ochiladi", async () => {
    open("/integrations/connections?c=partner:7");

    await waitFor(() => expect(tabButton(/Umumiy holat/i)).toHaveAttribute("aria-current", "true"));
  });

  it("⭐ tab bosilganda URL O'ZGARADI", async () => {
    const user = userEvent.setup();
    open("/integrations/connections?c=partner:7");

    await waitFor(() => expect(tabButton(/Xavfsizlik/i)).toBeTruthy());
    await user.click(tabButton(/Xavfsizlik/i));

    // URL — yagona haqiqat manbai; holat undan o'qiladi.
    await waitFor(() => expect(currentSearch()).toContain("t=security"));
  });

  it("⭐ NOMA'LUM tab birinchi tabga tushadi (havola eskirsa)", async () => {
    /**
     * Eski havolada bo'lmagan yoki bu rol uchun YASHIRILGAN tab bo'lishi
     * mumkin (masalan to'lov tizimida "Hisob-kitob" yo'q). Shunda sahifa
     * bo'sh qolmasligi kerak.
     */
    open("/integrations/connections?c=partner:7&t=allaqanday-yoq-tab");

    await waitFor(() => expect(tabButton(/Umumiy holat/i)).toHaveAttribute("aria-current", "true"));
  });

  it("⭐ boshqa ulanishga o'tganda tab BIRINCHISIGA qaytadi", async () => {
    /**
     * "Hodisalar" tabida turib boshqa ulanishga o'tish chalkash bo'lardi:
     * ekranda boshqa ulanishning hodisalari chiqib, operator qaysi
     * ulanishga qarayotganini yo'qotardi.
     *
     * ⚠️ Ikki parametr BITTA yangilanishda yoziladi — aks holda ketma-ket
     * ikki `setSearchParams` bir-birini bosib o'tishi mumkin edi.
     */
    open("/integrations/connections?c=partner:7&t=security");

    await waitFor(() => expect(tabButton(/Xavfsizlik/i)).toHaveAttribute("aria-current", "true"));

    // Chipni bosish — ro'yxatda bitta ulanish bor, shu bois o'zini bosamiz.
    const user = userEvent.setup();
    await user.click(tabButton(/BeePost/i));

    await waitFor(() => {
      expect(currentSearch()).toContain("t=overview");
    });
  });

  /**
   * UMUMIY HOLAT — RAQAM VA BANNER HAVOLALARI ham URL orqali ishlaydi.
   *
   * ⚠️ Plitkalar `fireEvent` bilan bosiladi: `userEvent` pointer-events
   * uchun uslublarni o'qiydi va `@container` sinfi ostida jsdom selektor
   * xatosiga uriladi (yuqoridagi `getByRole` izohiga qarang).
   */
  const overviewTile = (label: string) =>
    document.querySelector<HTMLButtonElement>(`button[aria-label^="${label}:"]`);

  it("⭐ Umumiy holatdagi RAQAM bosilganda tegishli tab ochiladi va URL o'zgaradi", async () => {
    open("/integrations/connections?c=partner:7");

    await waitFor(() => expect(overviewTile("Jami")).toBeTruthy());
    fireEvent.click(overviewTile("Jami")!);

    await waitFor(() => expect(currentSearch()).toContain("t=shipments"));
    await waitFor(() => expect(tabButton(/Posilkalar/i)).toHaveAttribute("aria-current", "true"));
  });

  it("⭐ mavjud fixTab havolalari ishlaydi: banner \"Tuzatish\" va checklist qatori", async () => {
    apiGetMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes("partners")
          ? { data: { data: [{ ...PARTNER, webhook_url: null }] } }
          : { data: { data: [] } },
      ),
    );
    open("/integrations/connections?c=partner:7");

    const actions = await screen.findByTestId("ovw-actions");
    fireEvent.click(within(actions).getByText("Tuzatish").closest("button")!);
    await waitFor(() => expect(currentSearch()).toContain("t=settings"));

    // Checklist qatori (yetishmagan webhook manzili) — u ham Sozlamalarga olib boradi.
    fireEvent.click(tabButton(/Umumiy holat/i));
    await waitFor(() => expect(currentSearch()).toContain("t=overview"));
    fireEvent.click(tabButton(/Webhook manzili/i));
    await waitFor(() => expect(currentSearch()).toContain("t=settings"));
  });

  it("⭐ \"Yangilash\" TanStack Query keshini invalidatsiya qiladi, sahifa qayta yuklanmaydi", async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    open("/integrations/connections?c=partner:7");

    const actions = await screen.findByTestId("ovw-actions");
    const searchBefore = currentSearch();
    const metricsCallsBefore = apiGetMock.mock.calls.filter(([url]) => String(url).includes("metrics")).length;

    fireEvent.click(within(actions).getByText("Yangilash").closest("button")!);

    await waitFor(() => {
      const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toEqual(
        expect.arrayContaining([
          JSON.stringify(["integration-metrics"]),
          JSON.stringify(["admin-partners"]),
          JSON.stringify(["integrations"]),
          JSON.stringify(["integration-settlement", "balance"]),
        ]),
      );
    });
    // Invalidatsiya ochiq so'rovni fonda qayta yuboradi — sahifa esa o'sha joyida.
    await waitFor(() =>
      expect(apiGetMock.mock.calls.filter(([url]) => String(url).includes("metrics")).length).toBeGreaterThan(
        metricsCallsBefore,
      ),
    );
    expect(currentSearch()).toBe(searchBefore);
    expect(screen.getByTestId("ovw-actions")).toBeInTheDocument();
    invalidate.mockRestore();
  });
});
