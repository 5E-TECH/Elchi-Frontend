import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { PageHeader } from "./PageHeader";

/**
 * PageHeader — dizayn v2 sahifa sarlavhasi (`.el-pagehead`): `<h1>`, izoh,
 * «← …» havolasi (route / funksiya / tarix), amallar, meta va children slotlari.
 */

const Location = () => <output data-testid="location">{useLocation().pathname}</output>;

const renderAt = (ui: ReactNode, entries: string[] = ["/orders/10305"]) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                {ui}
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("uz");
  });
});

describe("PageHeader — sarlavha va izoh", () => {
  it("title — yagona <h1>, maketdagi tipografiya (24/32 · 700, telefonda 20/28)", () => {
    renderAt(<PageHeader title="Buyurtmalar" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Buyurtmalar" });
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(heading).toHaveClass("text-2xl/8", "font-bold", "text-text", "max-md:text-xl/7");
    // Uzun sarlavha kesilmaydi — o'raladi.
    expect(heading).toHaveClass("wrap-break-word");
    expect(heading.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("description — sarlavha ostida, .el-sub: 14px, qator 1.5 (text-sm/normal), text-text-muted", () => {
    renderAt(<PageHeader title="Buyurtmalar" description="Jami 1 248 ta buyurtma" />);
    const description = screen.getByText("Jami 1 248 ta buyurtma");
    expect(description.tagName).toBe("P");
    expect(description).toHaveClass("text-sm/normal", "text-text-muted");
    expect(screen.getByRole("heading", { level: 1 }).compareDocumentPosition(description)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("ixtiyoriy qismlar berilmasa chizilmaydi", () => {
    const { container } = renderAt(<PageHeader title="Bosh sahifa" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const header = container.querySelector("header") as HTMLElement;
    expect(header.querySelector("p")).toBeNull();
    // Faqat sarlavha qatori: amallar bloki yo'q, children yo'q.
    expect(header.children).toHaveLength(1);
    expect(header.firstElementChild?.children).toHaveLength(1);
  });
});

describe("PageHeader — orqaga havolasi", () => {
  it("back=string — router havolasi (href), nomi — ota sahifa («← Buyurtmalar»), bosilganda o'tadi", () => {
    renderAt(<PageHeader title="№10305" back="/orders" backLabel="Buyurtmalar" />);
    const link = screen.getByRole("link", { name: "Buyurtmalar" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/orders");
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/orders$/);
  });

  it("back=string — query bilan route ham href'ga to'liq tushadi (filtr saqlanadi)", () => {
    renderAt(
      <PageHeader title="№10305" back="/orders?status=waiting&page=2" backLabel="Buyurtmalar" />,
    );
    expect(screen.getByRole("link", { name: "Buyurtmalar" })).toHaveAttribute(
      "href",
      "/orders?status=waiting&page=2",
    );
  });

  it("route yoki funksiya berilsa backLabel majburiy (taxta: «Orqaga» emas — bo'lim nomi)", () => {
    // @ts-expect-error — `back` route bo'lsa `backLabel` talab qilinadi.
    const routeWithoutLabel = <PageHeader title="№10305" back="/orders" />;
    // @ts-expect-error — `back` funksiya bo'lsa ham.
    const fnWithoutLabel = <PageHeader title="Qadam 2" back={() => undefined} />;
    // @ts-expect-error — `back` bo'lmasa `backLabel` ma'nosiz.
    const labelWithoutBack = <PageHeader title="Bosh sahifa" backLabel="Buyurtmalar" />;
    // `back={true}` (ota sahifa noma'lum) — yorliqsiz ham bo'ladi.
    const history = <PageHeader title="№10305" back />;
    expect([routeWithoutLabel, fnWithoutLabel, labelWithoutBack, history]).toHaveLength(4);
  });

  it("back=funksiya — tugma, bosilganda funksiya chaqiriladi, marshrut o'zgarmaydi", () => {
    const onBack = vi.fn();
    renderAt(<PageHeader title="Qadam 2" back={onBack} backLabel="1-qadam" />);
    const button = screen.getByRole("button", { name: "1-qadam" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/orders/10305");
  });

  it("back=true — tarixda bir qadam orqaga (navigate(-1)), sukut yorlig'i «Orqaga»", () => {
    renderAt(<PageHeader title="№10305" back />, ["/orders", "/orders/10305"]);
    expect(screen.getByTestId("location")).toHaveTextContent("/orders/10305");
    const button = screen.getByRole("button", { name: "Orqaga" });
    expect(button).toHaveAttribute("type", "button");
    fireEvent.click(button);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/orders$/);
  });

  it("back=true + backLabel — yorliq almashadi, xatti-harakat o'sha", () => {
    renderAt(<PageHeader title="№10305" back backLabel="Buyurtmalar" />, [
      "/orders",
      "/orders/10305",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Buyurtmalar" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/orders$/);
  });

  it("klaviatura: havola va tugma Tab bilan fokuslanadi (tabindex manfiy emas)", () => {
    renderAt(
      <>
        <PageHeader title="№10305" back="/orders" backLabel="Buyurtmalar" />
        <PageHeader title="Qadam 2" back={() => undefined} backLabel="1-qadam" />
      </>,
    );
    for (const el of [screen.getByRole("link"), screen.getByRole("button")]) {
      expect(el).not.toHaveAttribute("tabindex");
      el.focus();
      expect(el).toHaveFocus();
    }
  });

  it("havola sarlavhadan oldin turadi, ikonka (ArrowLeft) ekran o'quvchidan yashirin", () => {
    renderAt(<PageHeader title="№10305" back="/orders" backLabel="Buyurtmalar" />);
    const link = screen.getByRole("link");
    expect(link.compareDocumentPosition(screen.getByRole("heading", { level: 1 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const icon = link.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("lucide-arrow-left");
  });

  it("maketdagi .el-back: 13px · 600 · text-muted, hover action-hover (taxta), telefonda 44px", () => {
    renderAt(<PageHeader title="№10305" back="/orders" backLabel="Buyurtmalar" />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass(
      "inline-flex",
      "self-start",
      "text-[13px]",
      "font-semibold",
      "text-text-muted",
      "hover:text-action-hover",
      "motion-reduce:transition-none",
      // Telefonda 44px bosish maydoni, ko'rinadigan oraliq esa o'zgarmaydi (maket: margin -12px 0 -8px).
      "max-md:min-h-11",
      "max-md:-mt-3",
      "max-md:-mb-2",
    );
    // Tugma ko'rinishi emas — matnli havola (IconButton/Button klasslari yo'q).
    expect(link.className).not.toMatch(/\b(bg-|border|rounded-|h-10|size-)/);
    expect(link.querySelector("svg")).toHaveAttribute("width", "16");
  });

  it("global fokus halqasi bosib o'tilmaydi (outline-none yo'q)", () => {
    renderAt(<PageHeader title="№10305" back />);
    expect(screen.getByRole("button").className).not.toMatch(/outline-(none|hidden)/);
  });

  it.each([
    ["ru", "Назад"],
    ["en", "Back"],
  ])("sukut yorlig'i i18n'dan (ui:common.back) — %s", async (language, label) => {
    await act(async () => {
      await i18n.changeLanguage(language);
    });
    renderAt(<PageHeader title="№10305" back />);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});

describe("PageHeader — slotlar", () => {
  it("actions — o'ng tomonda; telefonda to'liq enli, har tugma teng bo'lak", () => {
    renderAt(
      <PageHeader
        title="Buyurtmalar"
        actions={
          <>
            <button type="button">Excelga yuklash</button>
            <button type="button">Buyurtma yaratish</button>
          </>
        }
      />,
    );
    const create = screen.getByRole("button", { name: "Buyurtma yaratish" });
    const group = create.parentElement as HTMLElement;
    expect(within(group).getByRole("button", { name: "Excelga yuklash" })).toBeInTheDocument();
    expect(group).toHaveClass("flex", "flex-wrap", "gap-2", "max-md:w-full", "max-md:[&>*]:flex-1");
    // Amallar matn blokidan keyin (o'ngda), sarlavha bilan bir qatorda.
    expect(group.parentElement).toHaveClass(
      "flex-wrap",
      "items-end",
      "justify-between",
      "max-md:items-stretch",
    );
  });

  it("meta — sarlavha bilan bir qatorda (badge, son, nusxalash)", () => {
    renderAt(<PageHeader title="№10305" meta={<span>Kutilmoqda</span>} />);
    const heading = screen.getByRole("heading", { level: 1 });
    const meta = screen.getByText("Kutilmoqda");
    expect(meta.parentElement).toBe(heading.parentElement);
    expect(heading.parentElement).toHaveClass("flex", "flex-wrap", "items-center");
    // meta sarlavha nomiga qo'shilmaydi.
    expect(heading).toHaveAccessibleName("№10305");
  });

  it("titleAction — sarlavhaga yopishgan (4px), meta esa ulardan keyin (12px)", () => {
    renderAt(
      <PageHeader
        title="№10241"
        titleAction={<button type="button" aria-label="Buyurtma raqamini nusxalash" />}
        meta={<span>Qabul qilindi</span>}
      />,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    const copy = screen.getByRole("button", { name: "Buyurtma raqamini nusxalash" });
    expect(copy.parentElement).toBe(heading.parentElement);
    expect(heading.parentElement).toHaveClass("flex", "items-center", "gap-1");
    const row = heading.parentElement?.parentElement as HTMLElement;
    expect(row).toHaveClass("flex-wrap", "gap-x-3", "gap-y-2");
    expect(screen.getByText("Qabul qilindi").parentElement).toBe(row);
    expect(heading).toHaveAccessibleName("№10241");
  });

  it("children — sarlavha qatoridan keyin (masalan Tabs)", () => {
    renderAt(
      <PageHeader title="Pochtalar" actions={<button type="button">Yangilash</button>}>
        <div role="tablist" aria-label="Holat" />
      </PageHeader>,
    );
    const tablist = screen.getByRole("tablist");
    const row = screen.getByRole("heading", { level: 1 }).closest("header > div");
    expect(row?.nextElementSibling).toBe(tablist);
  });

  it("className qo'shiladi, qolgan propslar va ref <header> ga o'tadi", () => {
    let node: HTMLElement | null = null;
    renderAt(
      <PageHeader
        title="Bosh sahifa"
        className="mb-2"
        data-testid="page-head"
        ref={(el) => {
          node = el;
        }}
      />,
    );
    const header = screen.getByTestId("page-head");
    expect(header.tagName).toBe("HEADER");
    expect(header).toHaveClass("flex", "flex-col", "mb-2");
    expect(node).toBe(header);
  });
});
