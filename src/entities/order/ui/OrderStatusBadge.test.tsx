import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import en from "../../../locales/en/status.json";
import ru from "../../../locales/ru/status.json";
import uz from "../../../locales/uz/status.json";
import { TONE_SOFT } from "../../../shared/ui/primitives/tone";
import { ORDER_STATUSES, ORDER_STATUS_REGISTRY } from "../model/statusRegistry";
import { OrderReturnPlace, OrderStatusBadge } from "./OrderStatusBadge";

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
  it.each(ORDER_STATUSES.filter((status) => status !== "returned_to_market"))("%s", (status) => {
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
    // SllBYhnt: alohida yorliq — «Yangi» ham, boshqa holat ham emas.
    ["waiting_customer", "Mijoz kutilmoqda"],
    ["returned_to_market", "Marketga topshirildi"],
    ["RETURNED_TO_MARKET", "Marketga topshirildi"],
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

const renderStage = (status: unknown, order: Record<string, unknown>, withPlace = false) =>
  render(
    <I18nextProvider i18n={i18n}>
      <OrderStatusBadge status={status} order={order} withPlace={withPlace} data-testid="badge" />
    </I18nextProvider>,
  );

describe("OrderStatusBadge — bekor bosqichi (tizim-states-data §09)", () => {
  it("«Marketga topshirildi» — `order` siz ham: neytral, PackageCheck ikonkasi, nuqtasiz (ega qarori 2026-10-19)", () => {
    renderBadge("returned_to_market");
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent("Marketga topshirildi");
    expect(el).toHaveAttribute("data-order-status", "returned_to_market");
    expect(el).toHaveAttribute("data-cancel-stage", "market");
    expect(el).toHaveClass("bg-sunken", "text-text-muted");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelector("[data-badge-dot]")).toBeNull();
  });

  it.each([
    ["courier", "cancelled", { holder_type: "COURIER" }, "Bekor · kuryerda"],
    ["in_transit", "cancelled (sent)", {}, "Bekor · yo'lda"],
    ["branch", "cancelled", { holder_type: "BRANCH", post_id: "41" }, "Bekor · filialda"],
    ["hq", "cancelled", { holder_type: "HQ", post_id: "41" }, "Bekor · HQ'da"],
  ] as const)("%s — danger, ikonka bilan: «%s»", (stage, status, order, label) => {
    renderStage(status, order);
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent(label);
    expect(el).toHaveAttribute("data-cancel-stage", stage);
    expect(el).toHaveClass("text-danger-fg");
    expect(el.querySelector("svg")).not.toBeNull();
    expect(el.querySelector("[data-badge-dot]")).toBeNull();
    if (stage === "in_transit") expect(el).toHaveClass("ring-current", "bg-transparent");
  });

  it("bosqich aniqlanmasa — oddiy «Bekor qilingan» (nuqtali)", () => {
    renderStage("cancelled", {});
    const el = screen.getByTestId("badge");
    expect(el).toHaveTextContent("Bekor qilingan");
    expect(el).not.toHaveAttribute("data-cancel-stage");
    expect(el.querySelector("[data-badge-dot]")).not.toBeNull();
  });

  it("bekor bo'lmagan buyurtma — `order` bilan ham oddiy belgi", () => {
    renderStage("waiting", { holder_type: "COURIER" });
    expect(screen.getByTestId("badge")).toHaveTextContent("Kutilmoqda");
    expect(screen.getByTestId("badge")).not.toHaveAttribute("data-cancel-stage");
  });

  it("joy qatori: «Toshkent HQ · 2 kun»", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 3_600_000).toISOString();
    renderStage("cancelled", { holder_type: "HQ", post_id: "41", branch: { id: "1", name: "Toshkent HQ" }, last_handover_at: twoDaysAgo }, true);
    expect(screen.getByTestId("badge")).toHaveTextContent("Bekor · HQ'da");
    expect(screen.getByTestId("cancel-return-place")).toHaveTextContent("Toshkent HQ · 2 kun");
  });

  it("joy qatori: yo'ldagisi «→ Toshkent HQ»", () => {
    renderStage("cancelled", { transport_status: "cancelled (sent)", branch: { name: "Toshkent HQ" } }, true);
    expect(screen.getByTestId("badge")).toHaveTextContent("Bekor · yo'lda");
    expect(screen.getByTestId("cancel-return-place")).toHaveTextContent("→ Toshkent HQ");
  });

  it("ma'lumot yo'q bo'lsa joy qatori chizilmaydi", () => {
    renderStage("cancelled", { holder_type: "HQ", post_id: "41" }, true);
    expect(screen.queryByTestId("cancel-return-place")).toBeNull();
  });

  it.each([
    ["ru", "Отменён · в HQ", "Toshkent HQ · 3 дня"],
    ["en", "Cancelled · at HQ", "Toshkent HQ · 3 days"],
  ] as const)("%s: bosqich va kun ko'plik shakli", async (lang, label, place) => {
    await i18n.changeLanguage(lang);
    try {
      const at = new Date(Date.now() - 3 * 86_400_000 - 60_000).toISOString();
      renderStage("cancelled", { holder_type: "HQ", post_id: "41", branch: { name: "Toshkent HQ" }, last_handover_at: at }, true);
      expect(screen.getByTestId("badge")).toHaveTextContent(label);
      expect(screen.getByTestId("cancel-return-place")).toHaveTextContent(place);
    } finally {
      await i18n.changeLanguage("uz");
    }
  });

  it("OrderReturnPlace — alohida (telefon kartasi qatori)", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <OrderReturnPlace order={{ status: "cancelled", holder_type: "COURIER", courier: { name: "Jasur Tursunov" } }} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId("cancel-return-place")).toHaveTextContent("Jasur Tursunov");
  });
});
