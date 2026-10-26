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

/**
 * Kartadagi tanlov maydonlari — v2 `Field` + `Select searchable` (yorliq bilan nomlangan combobox; majburiy
 * belgisi `*` ekran o'quvchidan yashirin): «Viloyat», «Tuman», «Katalogdagi mahsulot».
 */
const FIELD = { region: "Viloyat", district: "Tuman", item: "Katalogdagi mahsulot" } as const;
const selectField = (name: (typeof FIELD)[keyof typeof FIELD]) => screen.getAllByRole("combobox", { name })[0];

const openSelect = async (name: (typeof FIELD)[keyof typeof FIELD]) => {
  // Ma'lumot yuklanayotganda select `disabled` — faollashguncha kutiladi.
  await waitFor(() => expect(selectField(name)).toBeEnabled());
  fireEvent.click(selectField(name));
};

/** Matn maydoni yorlig'i bo'yicha (`Field` — `label htmlFor`). */
const textbox = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

/** Ochiq ro'yxat guruhidagi variantlar («AI takliflari», «Barcha tumanlar» …). */
const groupOptions = (name: string) =>
  within(screen.getByRole("group", { name }))
    .getAllByRole("option")
    .map((option) => option.textContent);

/** Ochiq ro'yxatdagi variantlar (ko'rinish tartibida). */
const openOptions = () =>
  screen.queryAllByRole("option").map((option) => ({
    label: option.textContent,
    disabled: option.getAttribute("aria-disabled") === "true",
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
    // Holat badge'i — yashil ton + matn (faqat rang bilan emas).
    expect(within(card()).getByText("Tayyor")).toHaveClass("text-success-fg");
    expect(within(card()).getByRole("heading", { name: "Aliyev Vali" })).toBeInTheDocument();
  });

  it("AI tumanni topmagan kartada tuman bo'sh, sariq belgi va \"Tuman tanlang\" izohi bor", () => {
    const { card } = renderCard(aiPreview({ district_id: null, district_name: null }));

    expect(card()).toHaveAttribute("data-ready", "false");
    expect(within(screen.getByTestId("ai-issues")).getByText("Tuman tanlang")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Kamchiliklar" })).toBe(screen.getByTestId("ai-issues"));
    expect(within(card()).getByText("To'ldirilmagan: 1 ta")).toHaveClass("text-warning-fg");
  });

  it("viloyat+tuman AI tomonidan birga to'ldirilganda tuman JIMGINA tozalanmaydi", async () => {
    const { changes, card } = renderCard(aiPreview());

    // Tumanlar yuklanib, label `nom • sato_code` bo'lib chiqadi — lekin qiymat o'zgarmaydi.
    await waitFor(() => expect(selectField(FIELD.district)).toHaveValue("Chilonzor • 1726269"));
    expect(changes).toHaveLength(0);
    expect(card()).toHaveAttribute("data-ready", "true");
  });

  it("operator viloyatni QO'LDA o'zgartirsa tuman tozalanadi va yangi viloyat tumanlari yuklanadi", async () => {
    const { changes } = renderCard(aiPreview());
    await waitFor(() => expect(selectField(FIELD.district)).toHaveValue("Chilonzor • 1726269"));

    await openSelect(FIELD.region);
    fireEvent.click(screen.getByRole("option", { name: "Samarqand viloyati • 1718" }));

    expect(changes.at(-1)).toMatchObject({ region_id: "12", district_id: null, district_name: null });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("region/12"));
    await openSelect(FIELD.district);
    expect(await screen.findByRole("option", { name: "Urgut • 1718236" })).toBeInTheDocument();
  });

  it("`district_candidates` select ichida ENG TEPADA \"AI takliflari\" guruhida", async () => {
    renderCard(
      aiPreview({
        district_id: null,
        district_name: null,
        district_candidates: [{ id: "102", label: "Yunusobod", region_name: "Toshkent shahri" }],
      }),
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("region/11"));

    await openSelect(FIELD.district);

    await waitFor(() => expect(openOptions().length).toBe(2));
    // Taklif ENG TEPADA, alohida «AI takliflari» guruhida; qolgani «Barcha tumanlar» guruhida.
    expect(openOptions()).toEqual([
      { label: "Yunusobod • 1726266", disabled: false },
      { label: "Chilonzor • 1726269", disabled: false },
    ]);
    expect(groupOptions("AI takliflari")).toEqual(["Yunusobod • 1726266"]);
    expect(groupOptions("Barcha tumanlar")).toEqual(["Chilonzor • 1726269"]);
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

    await openSelect(FIELD.district);
    fireEvent.click(screen.getByRole("option", { name: "Urgut • Samarqand viloyati" }));

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

    fireEvent.change(textbox("Umumiy summa"), { target: { value: "5 000" } });

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
    await openSelect(FIELD.item);
    expect(openOptions()[0]).toEqual({ label: "Avto changyutgich", disabled: false });
    expect(groupOptions("AI takliflari")).toEqual(["Avto changyutgich"]);
    expect(groupOptions("Barcha mahsulotlar")).toEqual(["Telefon ushlagich"]);
    fireEvent.click(screen.getByRole("option", { name: "Avto changyutgich" }));

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
    const input = textbox("Telefon");

    expect(input.value).toBe("");
    expect(screen.getByText("AI o'qigan raqam: 90 123 45 678")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "90 123 45 67" } });

    expect(changes.at(-1)?.phone_number).toBe("901234567");
    expect(mocks.keepCaret).toHaveBeenCalledWith(input, "90 123 45 67");
  });
  describe("telefon 390px (JzQIec06)", () => {
    it("TAYYOR karta telefonda YIG'ILGAN: ism sarlavhada, bitta qator \"tuman · summa\", bosilganda ochiladi", () => {
      const { card } = renderCard(aiPreview({ customer_name: "Aliyev Vali", district_name: "Chilonzor", total_price: 150000 }));

      expect(within(card()).getByRole("heading", { name: "Aliyev Vali" })).toBeInTheDocument();
      const toggle = screen.getByTestId("ai-card-toggle");
      expect(toggle).toHaveTextContent(/^Kartani ochish:\s*Chilonzor\s*·\s*150 000 so'm$/);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAttribute("aria-controls", screen.getByTestId("ai-card-body").id);
      // Yig'ish faqat telefonda (< 768): tugma `hidden max-md:flex`, tana `max-md:hidden` — ish stolida doim ochiq.
      expect(toggle).toHaveClass("hidden", "max-md:flex");
      expect(screen.getByTestId("ai-card-body")).toHaveClass("max-md:hidden");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("hidden");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(toggle).toHaveTextContent(/^Kartani yig'ish:/);
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("max-md:hidden");
    });

    it("TAYYOR BO'LMAGAN karta avtomatik ochiq va yig'ib bo'lmaydi (yig'ish tugmasi yo'q)", () => {
      renderCard(aiPreview({ district_id: null, district_name: null }));

      expect(screen.queryByTestId("ai-card-toggle")).not.toBeInTheDocument();
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("max-md:hidden");
    });

    it("tahrirda karta tayyor bo'lsa O'ZI YOPILMAYDI; tayyor karta tayyor emasga o'tsa o'zi ochiladi", () => {
      const { card } = renderCard(aiPreview({ total_price: null }));
      const price = within(card()).getByRole("textbox", { name: "Umumiy summa" }) as HTMLInputElement;

      fireEvent.change(price, { target: { value: "150000" } });
      expect(card()).toHaveAttribute("data-ready", "true");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("max-md:hidden");
      expect(screen.getByTestId("ai-card-toggle")).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(screen.getByTestId("ai-card-toggle"));
      expect(screen.getByTestId("ai-card-body")).toHaveClass("max-md:hidden");

      fireEvent.change(price, { target: { value: "" } });
      expect(card()).toHaveAttribute("data-ready", "false");
      expect(screen.getByTestId("ai-card-body")).not.toHaveClass("max-md:hidden");
      expect(screen.queryByTestId("ai-card-toggle")).not.toBeInTheDocument();
    });

    it("telefonda bosiladigan elementlar 44px (`max-md:size-11` / `max-md:min-h-11`), ish stolida zich", () => {
      const { card } = renderCard(aiPreview());
      for (const name of [
        "telefon ushlagich sonini oshirish",
        "telefon ushlagich sonini kamaytirish",
        "Mahsulotni olib tashlash: telefon ushlagich",
        "Bu buyurtmani tashlab yuborish",
        "Bu kartani yaratish",
      ]) {
        const button = within(card()).getByRole("button", { name });
        expect(button.className, name).toMatch(/(^|\s)max-md:(size-11|min-h-11)(\s|$)/);
      }
      // Son guruhi nomlangan, bir dona bo'lsa «−» o'chiq.
      const quantity = within(card()).getByRole("group", { name: "telefon ushlagich soni" });
      expect(within(quantity).getByRole("button", { name: "telefon ushlagich sonini kamaytirish" })).toBeDisabled();
    });

    it("maydonlar moslashuvchan to'rda: 220px dan tor joyda bitta ustun (telefon), kengda 2–3 ta", () => {
      const { card } = renderCard(aiPreview());
      const grid = within(card()).getByRole("textbox", { name: "Mijoz ismi" }).closest(".grid") as HTMLElement;
      expect(grid).toHaveClass("grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))]");
    });
  });
});

describe("AI ogohlantirishlari `warnings[]` (J3hEDtFN)", () => {
  const fieldWarnings = () =>
    screen.queryAllByTestId("ai-field-warning").map((node) => [node.dataset.field, node.textContent]);

  it("har ogohlantirish o'z maydoni ostida, sabab bo'yicha o'z matni (server matni yo'q)", () => {
    renderCard(
      aiPreview({
        total_price: null,
        warnings: [
          { field: "total_price", reason: "unclear" },
          { field: "phone_number", reason: "ambiguous" },
          { field: "address", reason: "conflict" },
        ],
      }),
    );

    expect(fieldWarnings()).toEqual([
      ["phone_number", "Bir necha xil tushunish mumkin — tekshiring"],
      ["address", "Matnda bir-biriga zid qiymatlar bor — tekshiring"],
      ["total_price", "AI aniq o'qiy olmadi — tekshiring"],
    ]);
    // Maydonga bog'langan (aria-describedby → hint).
    expect(textbox("Umumiy summa")).toHaveAccessibleDescription(/AI aniq o'qiy olmadi/);
    expect(textbox("Manzil")).toHaveAccessibleDescription(/zid qiymatlar/);
  });

  it("noma'lum maydon yoki sabab, erkin matn — ko'rsatilmaydi; bo'sh massiv — belgi yo'q", () => {
    renderCard(
      aiPreview({
        warnings: [
          { field: "secret", reason: "unclear" },
          { field: "comment", reason: "Narx 150 mi yoki 1,5 mln?" },
          "phone_number",
        ] as never,
      }),
    );
    expect(fieldWarnings()).toEqual([]);
    expect(screen.queryByText(/Narx 150 mi/)).not.toBeInTheDocument();
  });

  it("ogohlantirish tayyorlikka ta'sir qilmaydi: to'liq karta «Tayyor» va yaratish mumkin", () => {
    renderCard(aiPreview({ warnings: [{ field: "customer_name", reason: "ambiguous" }] }));
    expect(screen.getByText("Tayyor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bu kartani yaratish" })).toBeEnabled();
    expect(fieldWarnings()).toEqual([["customer_name", "Bir necha xil tushunish mumkin — tekshiring"]]);
  });

  it("operator maydonni o'zgartirsa — o'sha belgi yo'qoladi, boshqalari qoladi", () => {
    renderCard(
      aiPreview({
        warnings: [
          { field: "customer_name", reason: "unclear" },
          { field: "comment", reason: "ambiguous" },
        ],
      }),
    );
    fireEvent.change(textbox("Mijoz ismi"), { target: { value: "Valiyev Ali" } });
    expect(fieldWarnings()).toEqual([["comment", "Bir necha xil tushunish mumkin — tekshiring"]]);
  });

  it("kartada maydoni yo'q `is_replacement` — maydonlar ustida nomi bilan", () => {
    renderCard(aiPreview({ warnings: [{ field: "is_replacement", reason: "conflict" }] }));
    const list = screen.getByRole("list", { name: "AI ogohlantirishlari" });
    expect(list).toHaveTextContent("Almashtirish buyurtmasi: Matnda bir-biriga zid qiymatlar bor — tekshiring");
  });
});
