import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import CatalogPage from "./CatalogPage";

/**
 * KLAVIATURA BILAN KIRISH.
 *
 * ⚠️ NIMA BUZILGAN EDI. Katalog kartalari antd `Card` + `onClick` edi, ya'ni
 * oddiy `div`. U fokus OLMAYDI, Enter/Bo'shliq ishlamaydi va skrin-riderga
 * "bu bosiladigan narsa" deb aytilmaydi.
 *
 * Katalog — ustaga kirishning YAGONA yo'li. Ya'ni sichqonchasiz foydalanuvchi
 * uchun butun "yangi ulanish" oqimi BERK edi.
 *
 * ⚠️ `<button>` ga o'rash mumkin emas: karta ichida sarlavha, teglar va
 * ro'yxat bor; tugma ichida blok elementlar noto'g'ri semantika beradi. Shu
 * bois ARIA naqshi ishlatiladi.
 */

/**
 * Usta o'rniga sodda stub — navigatsiya HAQIQATAN bo'lganini va QAYSI tur
 * bilan ketganini tekshirish uchun. Busiz "Enter ishladi" degan test hech
 * narsani isbotlamasdi: `MemoryRouter` ichida yo'l o'zgarishi ko'rinmaydi.
 */
const WizardStub = () => {
  const { typeKey } = useParams();
  return <div data-testid="wizard">usta: {typeKey}</div>;
};

const renderCatalog = () =>
  render(
    <MemoryRouter initialEntries={["/integrations/new"]}>
      <Routes>
        <Route path="/integrations/new" element={<CatalogPage />} />
        <Route path="/integrations/new/:typeKey" element={<WizardStub />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Katalog kartalari — klaviatura", () => {
  it("kartalar TUGMA sifatida e'lon qilingan", () => {
    renderCatalog();
    const cards = screen.getAllByRole("button", { name: /ulanish yaratish/i });
    // Registrda bir nechta tur bor — test bo'shliqda ishlamasin.
    expect(cards.length).toBeGreaterThan(3);
  });

  it("⭐ har bir karta FOKUS olishi mumkin", () => {
    renderCatalog();
    for (const card of screen.getAllByRole("button", {
      name: /ulanish yaratish/i,
    })) {
      // `tabIndex` bo'lmasa Tab bilan yetib bo'lmaydi.
      expect(card).toHaveAttribute("tabindex", "0");
    }
  });

  it("⭐ ENTER bosilganda usta OCHILADI", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const card = screen.getAllByRole("button", {
      name: /ulanish yaratish/i,
    })[0];
    card.focus();
    expect(card).toHaveFocus();

    await user.keyboard("{Enter}");

    // Haqiqiy tekshiruv: marshrut o'zgardi va TUR ham uzatildi.
    expect(screen.getByTestId("wizard")).toBeTruthy();
    expect(screen.getByTestId("wizard").textContent).toMatch(/usta: \w+/);
  });

  it("⭐ BO'SHLIQ ham ochadi (tugma standarti)", async () => {
    /**
     * Enter va Bo'shliq — ikkisi ham tugma standarti. Faqat Enterni
     * qo'llab-quvvatlash klaviatura foydalanuvchisi uchun kutilmagan
     * xatti-harakat bo'lardi.
     */
    const user = userEvent.setup();
    renderCatalog();

    const card = screen.getAllByRole("button", {
      name: /ulanish yaratish/i,
    })[0];
    card.focus();
    await user.keyboard(" ");

    expect(screen.getByTestId("wizard")).toBeTruthy();
  });

  it("⭐ BOSHQA tugma HECH NARSA qilmaydi", async () => {
    /**
     * Har qanday tugmaga ochilsa, kartalar orasida Tab bilan yurish
     * mumkin bo'lmasdi: o'q tugmalari yoki harf bosilishi bilan sahifa
     * almashib ketardi.
     */
    const user = userEvent.setup();
    renderCatalog();

    const card = screen.getAllByRole("button", {
      name: /ulanish yaratish/i,
    })[0];
    card.focus();
    await user.keyboard("{ArrowDown}a");

    expect(screen.queryByTestId("wizard")).toBeNull();
  });

  it("⭐ har bir kartada o'qiladigan NOM bor", () => {
    /**
     * Skrin-rider uchun: `role="button"` yolg'iz "tugma" deb o'qiladi va
     * qaysi ulanish ekani ma'lum bo'lmaydi.
     */
    renderCatalog();
    for (const card of screen.getAllByRole("button", {
      name: /ulanish yaratish/i,
    })) {
      const label = card.getAttribute("aria-label") ?? "";
      expect(label.length).toBeGreaterThan("— ulanish yaratish".length);
    }
  });
});
