import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview, aiProducts, aiRegions } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { get: mocks.get, post: vi.fn() } }));

import { buildAiConfirmPayload, type AiPreviewOrder } from "../../../../../entities/ai-order";
import AiPreviewCard from "./AiPreviewCard";
import { toDraft } from "./aiDraft";
import type { AiDraftOrder } from "./evalPreview";

/**
 * MAVJUD MIJOZNI TANLASH (backend 2026-11-18, `orders[].customer_id`).
 *
 * Telefon bazada bo'lsa — taklif («Mijozni tanlash»), avtomatik EMAS. Tanlansa buyurtma o'sha kartaga yoziladi:
 * ism va telefon kartadagidek (faqat o'qish), AI o'qigan raqam boshqa bo'lsa — operator buni ko'radi;
 * «Bekor qilish» — avvalgi qiymatlar, yangi mijoz.
 */

const products = aiProducts.map((product) => ({ id: String(product.id), name: product.name }));

type Suggestion = Record<string, unknown>;
let suggestions: Suggestion[];

const renderCard = (preview: AiPreviewOrder, { customerSuggest = true }: { customerSuggest?: boolean } = {}) => {
  const changes: AiDraftOrder[] = [];
  const Harness = () => {
    const [draft, setDraft] = useState(() => toDraft(preview, "d1", "draft-1", 0));
    return (
      <AiPreviewCard
        draft={draft}
        index={0}
        products={products}
        productsLoading={false}
        regions={aiRegions}
        regionsLoading={false}
        customerSuggest={customerSuggest}
        customerMarketId="7"
        creating={false}
        onChange={(order) => {
          changes.push(order);
          setDraft((prev) => ({ ...prev, order }));
        }}
        onRemove={vi.fn()}
        onCreate={vi.fn()}
      />
    );
  };
  renderWithProviders(<Harness />);
  return { changes };
};

const suggestCalls = () => mocks.get.mock.calls.filter(([url]) => url === "customers/suggest");
const textbox = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  suggestions = [];
  mocks.get.mockReset();
  mocks.get.mockImplementation((url: string) =>
    url === "customers/suggest"
      ? Promise.resolve({ data: { statusCode: 200, message: "ok", data: suggestions } })
      : aiApiGet(url),
  );
});

describe("AiPreviewCard — mavjud mijoz", () => {
  it("telefon bazada bor: taklif (avtomatik emas); «Mijozni tanlash» — karta ismi, faqat o'qish, `customer_id`", async () => {
    suggestions = [
      { id: "55", name: "Aliyeva Vasila", phone_number: "+998901234567", orders_count: 3, matched_by: "phone" },
    ];
    const { changes } = renderCard(aiPreview({ customer_name: "vasila" }));

    const found = await screen.findByTestId("ai-customer-found");
    expect(found).toHaveTextContent("Bu raqam bazada bor: Aliyeva Vasila · 3 ta buyurtma");
    expect(suggestCalls()[0][1]).toEqual({ params: { phone: "901234567", market_id: "7" } });
    // Avtomatik bog'lanmaydi.
    expect(changes.every((order) => !order.customer_id)).toBe(true);

    fireEvent.click(within(found).getByRole("button", { name: "«Aliyeva Vasila» — mavjud mijozni tanlash" }));

    expect(changes.at(-1)).toMatchObject({
      customer_id: "55",
      customer_name: "Aliyeva Vasila",
      phone_number: "901234567",
      customer_before_link: { name: "vasila", phone: "901234567" },
    });
    expect(screen.getByTestId("ai-customer-linked")).toHaveTextContent("Mavjud mijoz tanlandi — buyurtma shu kartaga yoziladi");
    expect(screen.queryByTestId("ai-customer-found")).toBeNull();
    expect(textbox("Mijoz ismi")).toHaveAttribute("readonly");
    expect(textbox("Telefon")).toHaveAttribute("readonly");

    const [order] = buildAiConfirmPayload([changes.at(-1)!], { includeMarketId: false }).orders;
    expect(order.customer_id).toBe("55");
    expect(order.customer).toMatchObject({ name: "Aliyeva Vasila", phone_number: "+998901234567" });
    expect(order).not.toHaveProperty("customer_before_link");
  });

  it("qo'shimcha raqam bo'yicha topilgan: tanlansa kartadagi asosiy raqam, «AI o'qigan raqam» ogohlantirishi; «Bekor qilish» qaytaradi", async () => {
    suggestions = [
      {
        id: "56",
        name: "Karimov Jasur",
        phone_number: "+998935551122",
        extra_number: "+998901234567",
        orders_count: 1,
        matched_by: "extra_number",
      },
    ];
    const { changes } = renderCard(aiPreview({ customer_name: "Jasur" }));

    fireEvent.click(await screen.findByRole("button", { name: "«Karimov Jasur» — mavjud mijozni tanlash" }));

    expect(changes.at(-1)).toMatchObject({ customer_id: "56", phone_number: "935551122" });
    expect(screen.getByTestId("ai-customer-linked")).toHaveTextContent(
      "AI o'qigan raqam: +998 90 123 45 67 — buyurtmaga kartadagi raqam yoziladi",
    );

    fireEvent.click(screen.getByRole("button", { name: "Bekor qilish" }));

    expect(changes.at(-1)).toMatchObject({
      customer_id: null,
      customer_before_link: null,
      customer_name: "Jasur",
      phone_number: "901234567",
    });
    expect(textbox("Telefon")).not.toHaveAttribute("readonly");
    await waitFor(() => expect(screen.getByTestId("ai-customer-found")).toBeInTheDocument());
  });

  it("mijozda yangi buyurtma bor — takror ogohlantirishi", async () => {
    suggestions = [
      { id: "57", name: "Sobirova Umida", phone_number: "+998901234567", orders_count: 4, new_orders_count: 2 },
    ];
    renderCard(aiPreview());

    expect(await screen.findByText("Bu mijozda 2 ta yangi buyurtma bor — takror emasligini tekshiring")).toBeInTheDocument();
  });

  it("taklif raqami kartadagiga mos kelmasa (qisman moslik) yoki ro'yxat bo'sh — blok yo'q", async () => {
    suggestions = [{ id: "58", name: "Boshqa", phone_number: "+998901234500", matched_by: "phone" }];
    renderCard(aiPreview());

    await waitFor(() => expect(suggestCalls()).toHaveLength(1));
    expect(screen.queryByTestId("ai-customer-found")).toBeNull();
  });

  it("`customerSuggest` o'chiq yoki telefon to'liq emas — so'rov ketmaydi", async () => {
    renderCard(aiPreview(), { customerSuggest: false });
    renderCard(aiPreview({ phone_number: "90 12" }));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(suggestCalls()).toHaveLength(0);
  });
});
