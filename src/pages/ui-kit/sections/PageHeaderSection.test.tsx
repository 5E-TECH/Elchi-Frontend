import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import en from "../../../locales/en/ui.json";
import ru from "../../../locales/ru/ui.json";
import uz from "../../../locales/uz/ui.json";
import { PageHeaderSection } from "./PageHeaderSection";

/**
 * «Sahifa sarlavhasi» bo'limi: ikkala panelda 5 namuna, matnlar maketdan
 * (`superadmin-orders-list`, `superadmin-orders-detail`, `manager-orders-detail`),
 * orqaga havolasi — ota bo'lim nomi (taxta `tizim-states-navigation`), har sarlavhada
 * bitta asosiy amal; `grow` namunasi — `superadmin-orders-list-refreshing`.
 */

const ROUTE = "/ops/ui-kit?section=page-header";

const keysOf = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) =>
        keysOf(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PageHeaderSection", () => {
  it("kunduzgi va tungi panelda bir xil 6 sarlavha (maket matnlari)", () => {
    renderWithProviders(<PageHeaderSection />, { route: ROUTE });
    expect(panels()).toHaveLength(2);
    for (const panel of panels()) {
      const titles = within(panel)
        .getAllByRole("heading", { level: 1 })
        .map((h) => h.textContent);
      expect(titles).toEqual([
        "Bosh sahifa",
        "Buyurtmalar",
        "№10241",
        "№10305",
        "Buyurtmalar",
        "Chilonzor qabul punkti bo'yicha bekor qilingan va qaytarilgan buyurtmalarning haftalik hisoboti",
      ]);
      // Maket matnlari (uz) aynan.
      expect(within(panel).getAllByText("Jami 1 248 ta buyurtma")).toHaveLength(2);
      expect(within(panel).getByText("Yaratilgan: Bugun, 14:15 · Baraka Shop")).toBeInTheDocument();
      expect(
        within(panel).getByText("Yaratilgan: Kecha, 11:40 · Nur Elektronika"),
      ).toBeInTheDocument();
      expect(within(panel).getByText("Kutilmoqda")).toBeInTheDocument();
    }
  });

  it("orqaga havolalari — router havolasi, matni ota bo'lim nomi («Orqaga» emas)", () => {
    renderWithProviders(<PageHeaderSection />, { route: ROUTE });
    for (const panel of panels()) {
      const links = within(panel).getAllByRole("link");
      expect(links.map((a) => a.textContent)).toEqual([
        "Buyurtmalar",
        "Buyurtmalar",
        "Bekor qilinganlar",
      ]);
      for (const link of links) {
        // Namuna sahifadan chiqarmaydi — shu bo'limning o'ziga qaytadi.
        expect(link).toHaveAttribute("href", ROUTE);
        expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      }
    }
  });

  it("har sarlavhada ko'pi bilan bitta asosiy tugma; telefonda amallar to'liq enli", () => {
    renderWithProviders(<PageHeaderSection />, { route: ROUTE });
    for (const panel of panels()) {
      const headers = Array.from(panel.querySelectorAll("header"));
      expect(headers).toHaveLength(6);
      for (const header of headers) {
        expect(
          header.querySelectorAll('button[data-variant="primary"]').length,
        ).toBeLessThanOrEqual(1);
      }
      const cancel = within(panel).getByRole("button", { name: "Bekor qilish" });
      expect(cancel).toHaveAttribute("data-variant", "danger-soft");
      expect(cancel.parentElement).toHaveClass("max-md:w-full", "max-md:[&>*]:flex-1");
      expect(within(panel).getByRole("button", { name: "Sotish" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
    }
  });

  it("grow namunasi (OR-1): «Yangilanmoqda…» sarlavha yonida, telefon ikonka tugmasi o'ng chetda, desktopda ghost «Yangilash»", () => {
    renderWithProviders(<PageHeaderSection />, { route: `${ROUTE}&theme-pair=0` });
    expect(screen.getByText("Yangilanmoqda…").closest('[role="status"]')).not.toBeNull();
    const iconButton = screen.getByRole("button", { name: "Ro'yxatni yangilash" });
    expect(iconButton).toHaveClass("ml-auto", "md:hidden");
    const metaRow = iconButton.parentElement as HTMLElement;
    expect(within(metaRow).getByRole("heading", { level: 1 })).toHaveTextContent("Buyurtmalar");
    expect(metaRow.parentElement).toHaveClass("flex-auto");
    expect(screen.getByRole("button", { name: "Yangilash" })).toHaveClass("max-md:hidden");
    // Haqiqiy sahifadagidek: «Yangilanmoqda…» holatida ikkala «Yangilash» tugmasi ham band.
    expect(iconButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Yangilash" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Oxirgi yangilanish: 14:42")).toBeInTheDocument();
  });

  it("nusxalash tugmasi — nomli, bosilganda buyurtma raqami nusxalanadi", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<PageHeaderSection />, { route: `${ROUTE}&theme-pair=0` });
    fireEvent.click(screen.getByRole("button", { name: "Buyurtma raqamini nusxalash" }));
    expect(writeText).toHaveBeenCalledWith("10305");
  });

  it("uz/ru/en: pageHeader kalitlari bir xil", () => {
    const uzKeys = keysOf(uz.pageHeader).sort();
    expect(keysOf(ru.pageHeader).sort()).toEqual(uzKeys);
    expect(keysOf(en.pageHeader).sort()).toEqual(uzKeys);
    expect(keysOf(uz.kit.sections.pageHeader).sort()).toEqual(
      keysOf(en.kit.sections.pageHeader).sort(),
    );
  });
});
