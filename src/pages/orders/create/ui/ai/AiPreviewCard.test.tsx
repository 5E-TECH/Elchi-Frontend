import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../../test/test-utils";
import { aiApiGet, aiPreview, aiProducts, aiRegions } from "../../../../../test/aiOrderFixtures";

const mocks = vi.hoisted(() => ({ get: vi.fn(), keepCaret: vi.fn() }));

vi.mock("../../../../../shared/api/api", () => ({ api: { get: mocks.get, post: vi.fn() } }));
vi.mock("../../../../../shared/lib/phone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../shared/lib/phone")>()),
  keepPhoneCaretAfterChange: mocks.keepCaret,
}));

import type { AiPreviewOrder } from "../../../../../entities/ai-order";
import AiPreviewCard from "./AiPreviewCard";
import { toDraft } from "./aiDraft";
import type { AiDraftOrder } from "./evalPreview";

/**
 * AI PREVIEW KARTASI (s92KyWm0).
 *
 * Karta boshqariladigan (controlled): holat ota komponentda. Test shu
 * sababli kichik holatli o'rovchi bilan render qiladi va har o'zgarishni yozib boradi.
 */

const products = aiProducts.map((product) => ({ id: String(product.id), name: product.name }));

const renderCard = (preview: AiPreviewOrder) => {
  const changes: AiDraftOrder[] = [];
  const Harness = () => {
    const [draft, setDraft] = useState(() => toDraft(preview, "d1"));
    return (
      <AiPreviewCard
        draft={draft}
        index={0}
        products={products}
        productsLoading={false}
        regions={aiRegions}
        regionsLoading={false}
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

const openSelect = async (id: string) => {
  // Ma'lumot yuklanayotganda select `disabled` — faollashguncha kutiladi.
  await waitFor(() => expect(document.getElementById(id)).toBeEnabled());
  fireEvent.click(document.getElementById(id) as HTMLElement);
};

/** Ochiq dropdown'dagi variantlar (disabled sarlavhalar ham). */
const openOptions = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>(".max-h-60 button")).map((button) => ({
    label: button.textContent,
    disabled: button.disabled,
  }));

beforeEach(() => {
  // jsdom'da yo'q — SearchableSelect belgilangan variantga scroll qiladi.
  Element.prototype.scrollIntoView = vi.fn();
  mocks.get.mockReset();
  mocks.get.mockImplementation(aiApiGet);
  mocks.keepCaret.mockReset();
});

describe("AiPreviewCard", () => {
  it("AI to'liq to'g'ri topgan buyurtma yashil ✓ bilan `ready`", () => {
    const { card } = renderCard(aiPreview());

    expect(card()).toHaveAttribute("data-ready", "true");
    expect(within(card()).getByText("Tayyor")).toBeInTheDocument();
    expect(card().className).toContain("border-l-[var(--color-success)]");
  });

  it("AI tumanni topmagan kartada tuman bo'sh, sariq belgi va \"Tuman tanlang\" izohi bor", () => {
    const { card } = renderCard(aiPreview({ district_id: null, district_name: null }));

    expect(card()).toHaveAttribute("data-ready", "false");
    expect(within(screen.getByTestId("ai-issues")).getByText("Tuman tanlang")).toBeInTheDocument();
    expect(card().className).toContain("border-l-amber-400");
  });

  it("viloyat+tuman AI tomonidan birga to'ldirilganda tuman JIMGINA tozalanmaydi", async () => {
    const { changes, card } = renderCard(aiPreview());

    // Tumanlar yuklanib, label `nom • sato_code` bo'lib chiqadi — lekin qiymat o'zgarmaydi.
    expect(await within(card()).findByText("Chilonzor • 1726269")).toBeInTheDocument();
    expect(changes).toHaveLength(0);
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("operator viloyatni QO'LDA o'zgartirsa tuman tozalanadi va yangi viloyat tumanlari yuklanadi", async () => {
    const { changes, card } = renderCard(aiPreview());
    await within(card()).findByText("Chilonzor • 1726269");

    await openSelect("ai-d1-region");
    fireEvent.click(screen.getByRole("button", { name: "Samarqand viloyati • 1718" }));

    expect(changes.at(-1)).toMatchObject({ region_id: "12", district_id: null, district_name: null });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("region/12"));
    await openSelect("ai-d1-district");
    expect(await screen.findByRole("button", { name: "Urgut • 1718236" })).toBeInTheDocument();
  });

  it("`district_candidates` select ichida ENG TEPADA \"AI takliflari\" guruhida", async () => {
    const { card } = renderCard(
      aiPreview({
        district_id: null,
        district_name: null,
        district_candidates: [{ id: "102", label: "Yunusobod", region_name: "Toshkent shahri" }],
      }),
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("region/11"));

    await openSelect("ai-d1-district");

    await waitFor(() => expect(openOptions(card()).length).toBeGreaterThan(2));
    expect(openOptions(card())).toEqual([
      { label: "AI takliflari", disabled: true },
      { label: "Yunusobod • 1726266", disabled: false },
      { label: "Barcha tumanlar", disabled: true },
      { label: "Chilonzor • 1726269", disabled: false },
    ]);
  });

  it("boshqa viloyatdagi taklif tanlansa viloyat ham unga moslanadi", async () => {
    const { changes } = renderCard(
      aiPreview({
        region_id: null,
        region_name: null,
        region_given: false,
        district_id: null,
        district_name: null,
        district_candidates: [{ id: "201", label: "Urgut", region_name: "Samarqand viloyati" }],
      }),
    );

    await openSelect("ai-d1-district");
    fireEvent.click(screen.getByRole("button", { name: "Urgut • Samarqand viloyati" }));

    expect(changes.at(-1)).toMatchObject({ district_id: "201", region_id: "12", region_given: true });
  });

  it("`region_given=false` bo'lsa viloyat maydoni alohida belgilanadi", () => {
    renderCard(aiPreview({ region_given: false }));
    expect(screen.getByText("Viloyat matnda yo'q — AI taxmin qildi, tekshiring")).toBeInTheDocument();
  });

  it("total_price=0: tasdiq checkboxi chiqadi, belgilanmaguncha `ready` emas", () => {
    const { card, changes } = renderCard(aiPreview({ total_price: 0 }));

    expect(card()).toHaveAttribute("data-ready", "false");
    fireEvent.click(screen.getByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" }));

    expect(changes.at(-1)?.price_confirmed).toBe(true);
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("total_price=5000 ham tasdiq talab qiladi", () => {
    renderCard(aiPreview({ total_price: 5000 }));
    expect(screen.getByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" })).toBeInTheDocument();
  });

  it("150000 narxda tasdiq checkboxi yo'q", () => {
    renderCard(aiPreview({ total_price: 150000 }));
    expect(screen.queryByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" })).not.toBeInTheDocument();
  });

  it("narx o'zgartirilsa oldingi tasdiq bekor bo'ladi", () => {
    const { changes } = renderCard(aiPreview({ total_price: 0 }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Narx to'g'ri, tasdiqlayman" }));

    fireEvent.change(screen.getByLabelText("Umumiy summa"), { target: { value: "5 000" } });

    expect(changes.at(-1)).toMatchObject({ total_price: 5000, price_confirmed: false });
  });

  it("katalogda topilmagan mahsulot: sariq belgi + ikki variant; hech biri tanlanmasa `ready` emas", async () => {
    const { card, changes } = renderCard(
      aiPreview({
        items: [
          {
            name: "Avto changyutgich mini",
            quantity: 1,
            product_id: null,
            candidates: [{ id: "502", name: "Avto changyutgich" }],
          },
        ],
      }),
    );

    expect(card()).toHaveAttribute("data-ready", "false");
    expect(screen.getByText(/Katalogda topilmadi — katalogdan tanlang/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Katalogda yo'q, shundayligicha yuborish" })).not.toBeChecked();

    // 1-variant: katalogdan tanlash — AI takliflari tepada.
    await openSelect("ai-d1-item-0");
    expect(openOptions(card())[0]).toEqual({ label: "AI takliflari", disabled: true });
    fireEvent.click(screen.getByRole("button", { name: "Avto changyutgich" }));

    expect(changes.at(-1)?.items[0]).toMatchObject({ product_id: "502", allow_free_text: false });
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("\"Katalogda yo'q, shundayligicha yuborish\" belgilangandagina `allow_free_text` qo'yiladi", () => {
    const { card, changes } = renderCard(
      aiPreview({ items: [{ name: "Qizil ko'ylak", quantity: 1, product_id: null, candidates: [] }] }),
    );

    expect(changes.every((order) => order.items[0].allow_free_text !== true)).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Katalogda yo'q, shundayligicha yuborish" }));

    expect(changes.at(-1)?.items[0].allow_free_text).toBe(true);
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("telefonni qo'lda tuzatganda karetka saqlanadi (keepPhoneCaretAfterChange)", () => {
    const { changes } = renderCard(aiPreview({ phone_number: "90 123 45 678" }));
    const input = screen.getByLabelText("Telefon") as HTMLInputElement;

    expect(input.value).toBe("");
    expect(screen.getByText("AI o'qigan raqam: 90 123 45 678")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "90 123 45 67" } });

    expect(changes.at(-1)?.phone_number).toBe("901234567");
    expect(mocks.keepCaret).toHaveBeenCalledWith(input, "90 123 45 67");
  });
  describe("telefon 390px (JzQIec06)", () => {
    it("TAYYOR karta telefonda YIG'ILGAN: bitta qator \"Ism · tuman · narx\", bosilganda ochiladi", () => {
      renderCard(aiPreview({ customer_name: "Aliyev Vali", district_name: "Chilonzor", total_price: 150000 }));

      const toggle = screen.getByTestId("ai-card-toggle");
      expect(toggle).toHaveTextContent(/^Aliyev Vali\s*·\s*Chilonzor\s*·\s*150 000 so'm$/);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      // `hidden` faqat telefonda: `sm:flex` ish stolida har doim ko'rsatadi.
      expect(screen.getByTestId("ai-card-body")).toHaveClass("hidden", "sm:flex");
      expect(toggle).toHaveClass("sm:hidden");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("hidden");
    });

    it("TAYYOR BO'LMAGAN karta avtomatik ochiq va yig'ib bo'lmaydi", () => {
      renderCard(aiPreview({ district_id: null, district_name: null }));

      const toggle = screen.getByTestId("ai-card-toggle");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toBeDisabled();
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("hidden");
    });

    it("tahrirda karta tayyor bo'lsa O'ZI YOPILMAYDI; tayyor karta tayyor emasga o'tsa o'zi ochiladi", () => {
      const { card } = renderCard(aiPreview({ total_price: null }));
      const price = within(card()).getByLabelText("Umumiy summa") as HTMLInputElement;

      fireEvent.change(price, { target: { value: "150000" } });
      expect(card()).toHaveAttribute("data-ready", "true");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("hidden");

      fireEvent.click(screen.getByTestId("ai-card-toggle"));
      expect(screen.getByTestId("ai-card-body")).toHaveClass("hidden");

      fireEvent.change(price, { target: { value: "" } });
      expect(card()).toHaveAttribute("data-ready", "false");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("hidden");
    });

    it("telefonda bosiladigan elementlar 44px (h-11/min-h-11), ish stolida zich", () => {
      const { card } = renderCard(aiPreview());
      for (const name of ["+", "-", "Mahsulotni olib tashlash", "Bu buyurtmani tashlab yuborish"]) {
        const button = within(card()).getAllByRole("button", { name })[0];
        expect(button.className, name).toMatch(/(^|\s)(h-11|min-h-11)(\s|$)/);
      }
      expect(within(card()).getByRole("button", { name: "Bu kartani yaratish" }).className).toMatch(/min-h-11/);
    });

    it("maydonlar 1 / 2 / 3 ustun (telefon / sm / xl)", () => {
      const { card } = renderCard(aiPreview());
      const grid = within(card()).getByLabelText("Ism").closest(".grid") as HTMLElement;
      expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "xl:grid-cols-3");
    });
  });
});
