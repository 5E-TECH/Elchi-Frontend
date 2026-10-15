import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import en from "../../../locales/en/status.json";
import ru from "../../../locales/ru/status.json";
import uz from "../../../locales/uz/status.json";
import { TONE_SOFT } from "../../../shared/ui/primitives/tone";
import { ORDER_STATUSES, ORDER_STATUS_REGISTRY } from "../model/statusRegistry";
import { OrderStatusBadge } from "./OrderStatusBadge";

/**
 * BUYURTMA HOLATI BELGISI — registrdagi ton/yorliq, maketdagidek nuqtali
 * (ikonkasiz), «Bekor — jo'natilgan» chegarali; noma'lum holat yiqitmaydi.
 */

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);
const LOCALES = { uz, ru, en } as const;

const renderBadge = (status: unknown) =>
  render(
    <I18nextProvider i18n={i18n}>
      <OrderStatusBadge status={status} data-testid="badge" />
    </I18nextProvider>,
  );

beforeAll(async () => {
  await i18nReady;
  await i18n.changeLanguage("uz");
});

afterAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("OrderStatusBadge — 11 holat (uz)", () => {
  it.each(ORDER_STATUSES)("%s", (status) => {
    const meta = ORDER_STATUS_REGISTRY[status];
    renderBadge(status);
    const el = screen.getByTestId("badge");
    const [, key] = meta.labelKey.split(".");
    expect(el).toHaveTextContent((uz.order as Record<string, string>)[key]);
    expect(el).toHaveAttribute("data-order-status", meta.key);
    // Maket: el-badge el-badge-dot — nuqta bor, ikonka yo'q.
    expect(el.querySelector("[data-badge-dot]")).not.toBeNull();
    expect(el.querySelector("svg")).toBeNull();
    if (meta.variant === "outline") {
      expect(el).toHaveClass("text-danger-fg", "bg-transparent", "ring-current");
    } else {
      expect(el).toHaveClass(...classesOf(TONE_SOFT[meta.tone]));
    }
  });

  it("«Bekor — jo'natilgan» — danger + chegarali", () => {
    renderBadge("cancelled (sent)");
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent("Bekor — jo'natilgan");
    expect(el).toHaveClass("text-danger-fg", "bg-transparent", "ring-1", "ring-inset", "ring-current");
  });

  it("«Yopilgan» — neytral (rangsiz)", () => {
    renderBadge("closed");
    expect(screen.getByTestId("badge")).toHaveClass("bg-sunken", "text-text-muted", "ring-border");
  });
});

describe("OrderStatusBadge — API yozilishlari", () => {
  it.each([
    ["ON_THE_ROAD", "Yo'lda"],
    ["on_the_road", "Yo'lda"],
    ["cancelled_sent", "Bekor — jo'natilgan"],
    ["canceled", "Bekor qilingan"],
    ["partly paid", "Qisman to'langan"],
    ["waiting_customer", "Kutilmoqda"],
    ["returned_to_market", "Bekor qilingan"],
  ])("%s → «%s»", (raw, label) => {
    renderBadge(raw);
    expect(screen.getByTestId("badge")).toHaveTextContent(label);
  });
});

describe("OrderStatusBadge — noma'lum holat", () => {
  it("noma'lum qiymat — neytral, o'qiladigan xom qiymat bilan", () => {
    renderBadge("lost_in_transit");
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent("Lost in transit");
    expect(el).toHaveAttribute("data-order-status", "unknown");
    expect(el).toHaveClass("bg-sunken", "text-text-muted");
    expect(el.querySelector("[data-badge-dot]")).not.toBeNull();
  });

  it.each([null, undefined, "", "   ", {}, []])("%j — «Noma'lum», hech qachon bo'sh emas", (raw) => {
    renderBadge(raw);
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent("Noma'lum");
    expect(el).toHaveClass("bg-sunken", "text-text-muted");
  });
});

describe("OrderStatusBadge — ru/en", () => {
  it.each(["ru", "en"] as const)("%s: har holat o'z tilidagi yorliq bilan", async (lang) => {
    await i18n.changeLanguage(lang);
    try {
      for (const status of ORDER_STATUSES) {
        const { unmount } = renderBadge(status);
        const [, key] = ORDER_STATUS_REGISTRY[status].labelKey.split(".");
        expect(screen.getByTestId("badge")).toHaveTextContent(
          (LOCALES[lang].order as Record<string, string>)[key],
        );
        unmount();
      }
      const { unmount } = renderBadge(null);
      expect(screen.getByTestId("badge")).toHaveTextContent(LOCALES[lang].order.unknown);
      unmount();
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});
