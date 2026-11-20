import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview, aiProducts, aiRegions } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { get: mocks.get, post: vi.fn() } }));

import type { AiPreviewOrder } from "../../../../../entities/ai-order";
import AiPreviewCard from "./AiPreviewCard";
import { toDraft } from "./aiDraft";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI TEKSHIRUVLARI KARTADA (P1-7 + AI ack; maket `superadmin-neworders-create-ai-preview-checks`).
 *
 * Bloklovchi (`district_low_confidence`, `price_check`) — «… to'g'ri, tasdiqlayman» belgilanmaguncha karta
 * «Tasdiq kutmoqda»; operator tegishli maydonni o'zgartirsa tasdiq shart emas (backend `edited_fields` istisnosi).
 * Yumshoq — faqat eslatma («N ta eslatma»), qiymat o'zgarsa yo'qoladi.
 */

const products = aiProducts.map((product) => ({ id: String(product.id), name: product.name }));

const renderCard = (preview: AiPreviewOrder, samePhoneCard: number | null = null) => {
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
        samePhoneCard={samePhoneCard}
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
  return { changes, card: () => screen.getByTestId("ai-preview-card") };
};

const checkbox = (name: string) => screen.getByRole("checkbox", { name });
const textbox = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
});

describe("AiPreviewCard — AI tekshiruvlari", () => {
  it("tuman aniq emas: «AI o'qigan» qatori, «Aniq emas», «Tasdiq kutmoqda»; belgilansa — «Tayyor»", () => {
    const { card, changes } = renderCard(
      aiPreview({
        district_match: { method: "fuzzy", ai_text: "Chilanzar", score: 0.82 },
        checks: [{ code: "district_low_confidence" }],
      }),
    );

    expect(card()).toHaveAttribute("data-ready", "false");
    expect(card()).toHaveAttribute("data-awaiting", "ack");
    expect(within(card()).getByText("Tasdiq kutmoqda")).toHaveClass("text-warning-fg");
    expect(within(screen.getByTestId("ai-issues")).getByText("Tuman aniq emas — tasdiqlang")).toBeInTheDocument();
    expect(screen.getByTestId("ai-district-match")).toHaveTextContent("AI o'qigan: «Chilanzar» → Chilonzor");
    expect(screen.getByText("Aniq emas")).toBeInTheDocument();

    fireEvent.click(checkbox("Tuman to'g'ri, tasdiqlayman"));

    expect(changes.at(-1)?.acked_checks).toEqual(["district_low_confidence"]);
    expect(card()).toHaveAttribute("data-ready", "true");
    expect(card()).not.toHaveAttribute("data-awaiting");
  });

  it("operator tumanni O'ZI almashtirsa tasdiq so'ralmaydi (backend istisnosi) va «AI o'qigan» qatori yo'qoladi", async () => {
    const { card } = renderCard(
      aiPreview({
        district_match: { method: "fuzzy", ai_text: "Chilanzar", score: 0.82 },
        district_candidates: [{ id: "102", label: "Yunusobod", region_name: "Toshkent shahri" }],
        checks: [{ code: "district_low_confidence" }],
      }),
    );
    expect(checkbox("Tuman to'g'ri, tasdiqlayman")).toBeInTheDocument();

    const district = screen.getAllByRole("combobox", { name: "Tuman" })[0];
    await waitFor(() => expect(district).toBeEnabled());
    fireEvent.click(district);
    fireEvent.click(await screen.findByRole("option", { name: /Yunusobod/ }));

    expect(screen.queryByRole("checkbox", { name: "Tuman to'g'ri, tasdiqlayman" })).toBeNull();
    expect(screen.queryByTestId("ai-district-match")).toBeNull();
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("narx matnga mos emas: «Matnda: 150 000 · 20 000», «Mos emas», tasdiq; narx o'zgartirilsa tasdiq shart emas", () => {
    const { card } = renderCard(
      aiPreview({ total_price: 1_500_000, checks: [{ code: "price_check", kind: "mismatch", mentions: [150000, 20000] }] }),
    );

    expect(within(screen.getByTestId("ai-issues")).getByText("Narx matnga mos emas — tasdiqlang")).toBeInTheDocument();
    expect(screen.getByTestId("ai-price-mentions")).toHaveTextContent("Matnda: 150 000 · 20 000");
    expect(screen.getByText("Mos emas")).toBeInTheDocument();
    expect(card()).toHaveAttribute("data-ready", "false");

    fireEvent.change(textbox("Umumiy summa"), { target: { value: "170000" } });

    expect(screen.queryByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" })).toBeNull();
    expect(screen.queryByTestId("ai-price-mentions")).toBeNull();
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("narx juda katta: chip «Narx juda katta — tasdiq kerak», belgi «Juda katta»; belgilansa tayyor", () => {
    const { card, changes } = renderCard(
      aiPreview({ total_price: 250_000_000, checks: [{ code: "price_check", kind: "too_high", mentions: [] }] }),
    );

    expect(within(screen.getByTestId("ai-issues")).getByText("Narx juda katta — tasdiq kerak")).toBeInTheDocument();
    expect(screen.getByText("Juda katta")).toBeInTheDocument();
    // Matnda summa yo'q — «Matnda:» qatori chiqmaydi.
    expect(screen.queryByTestId("ai-price-mentions")).toBeNull();

    fireEvent.click(checkbox("Narx to'g'ri, tasdiqlayman"));
    expect(changes.at(-1)?.acked_checks).toEqual(["price_check"]);
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("`price_check` + 10 000 dan kichik narx: BITTA belgi ikkala tasdiqni yopadi", () => {
    const { card, changes } = renderCard(
      aiPreview({ total_price: 5000, checks: [{ code: "price_check", kind: "mismatch", mentions: [50000] }] }),
    );

    expect(screen.getAllByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" })).toHaveLength(1);
    fireEvent.click(checkbox("Narx to'g'ri, tasdiqlayman"));

    expect(changes.at(-1)).toMatchObject({ price_confirmed: true, acked_checks: ["price_check"] });
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("yumshoq eslatmalar tayyorlikka ta'sir qilmaydi: son katta, bir xil mahsulot, market raqami — «3 ta eslatma»", () => {
    const { card } = renderCard(
      aiPreview({
        items: [
          { name: "ushlagich", quantity: 20, product_id: "501", resolved_name: "Telefon ushlagich", candidates: [] },
          { name: "changyutgich", quantity: 1, product_id: "502", resolved_name: "Avto changyutgich", candidates: [] },
          { name: "changyutgich", quantity: 1, product_id: "502", resolved_name: "Avto changyutgich", candidates: [] },
        ],
        checks: [
          { code: "qty_check", item_index: 0 },
          { code: "duplicate_items", item_indexes: [1, 2] },
          { code: "phone_is_market" },
        ],
      }),
    );

    expect(card()).toHaveAttribute("data-ready", "true");
    expect(screen.getByTestId("ai-notes-count")).toHaveTextContent("3 ta eslatma");
    const rows = screen.getAllByTestId("ai-item-row");
    expect(within(rows[0]).getByText("Son katta: 20 ta — tekshiring")).toBeInTheDocument();
    expect(screen.getByText("2 va 3-mahsulot bir xil — birlashtiring yoki bittasini olib tashlang")).toBeInTheDocument();
    expect(screen.getByText("Bu marketning o'z raqami — mijoz raqamini tekshiring")).toBeInTheDocument();

    // Operator sonni o'zgartirdi, takror qatorni olib tashladi — eslatmalar yo'qoladi.
    fireEvent.click(within(rows[0]).getByRole("button", { name: /Kamaytirish|kamaytirish/ }));
    fireEvent.click(within(screen.getAllByTestId("ai-item-row")[2]).getByRole("button", { name: /olib tashlash/ }));

    expect(screen.queryByText(/Son katta/)).toBeNull();
    expect(screen.queryByText(/mahsulot bir xil/)).toBeNull();
    expect(screen.getByTestId("ai-notes-count")).toHaveTextContent("1 ta eslatma");
  });

  it("shu telefon boshqa kartada ham bo'lsa — panel bergan karta raqami bilan", () => {
    renderCard(aiPreview({ checks: [{ code: "same_phone_multi", other_index: 3 }] }), 2);

    expect(screen.getByText("Shu raqam #2 kartada ham bor")).toBeInTheDocument();
    expect(screen.getByTestId("ai-notes-count")).toHaveTextContent("1 ta eslatma");
  });

  it("`region_inferred` — viloyat matnda bo'lmasa (region_given ham true bo'lsa) ishora; viloyat qo'lda tanlansa yo'qoladi", async () => {
    renderCard(aiPreview({ region_given: true, region_inferred: true }));
    expect(screen.getByText("Viloyat matnda yo'q — AI taxmin qildi, tekshiring")).toBeInTheDocument();

    const region = screen.getAllByRole("combobox", { name: "Viloyat" })[0];
    await waitFor(() => expect(region).toBeEnabled());
    fireEvent.click(region);
    fireEvent.click(screen.getByRole("option", { name: "Samarqand viloyati • 1718" }));

    expect(screen.queryByText("Viloyat matnda yo'q — AI taxmin qildi, tekshiring")).toBeNull();
  });

  it("tekshiruvsiz (eski backend) karta avvalgidek: eslatma ham, tasdiq ham yo'q", () => {
    const { card } = renderCard(aiPreview());

    expect(card()).toHaveAttribute("data-ready", "true");
    expect(screen.queryByTestId("ai-notes-count")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
