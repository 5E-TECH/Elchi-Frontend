import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { Dialog as DialogV2 } from "./Dialog";
import { Field } from "./Field";
import { useFocusTrap } from "./overlay/useFocusTrap";
import { Select, type SelectOption, type SelectProps } from "./Select";

/**
 * Select — `.el-select` / `.el-options` / `.el-option` / `.el-option-empty` (CODE-MAP 2.2,
 * `tizim-states-forms` 03): WAI-ARIA combobox + listbox, klaviatura, qidiruv, ko'p tanlov, holatlar.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const REGIONS: SelectOption[] = [
  { value: "tashkent-city", label: "Toshkent sh." },
  { value: "tashkent", label: "Toshkent viloyati" },
  { value: "samarkand", label: "Samarqand" },
  { value: "fergana", label: "Farg'ona", disabled: true },
  { value: "andijan", label: "Andijon" },
];

const MARKETS: SelectOption[] = [
  { value: "1", label: "Baraka Shop" },
  { value: "2", label: "Barhayot Market" },
  { value: "3", label: "Anbar Savdo" },
  { value: "4", label: "Nur Elektronika" },
];

const STATUSES: SelectOption[] = [
  { value: "new", label: "Yangi" },
  { value: "created", label: "Yaratilgan" },
  { value: "received", label: "Qabul qilindi" },
  { value: "on_the_road", label: "Yo'lda" },
  { value: "waiting", label: "Kutilmoqda" },
  { value: "sold", label: "Sotilgan" },
];

const SingleControlled = ({
  initial = null,
  onChangeSpy,
  ...props
}: { initial?: string | null; onChangeSpy?: (value: string | null) => void } & Omit<
  Extract<SelectProps, { multiple?: false }>,
  "value" | "onChange"
>) => {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <Field label="Viloyat" required labelAs="span">
      <Select
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChangeSpy?.(next);
        }}
      />
    </Field>
  );
};

const MultiControlled = ({
  initial = [],
  onChangeSpy,
  ...props
}: { initial?: string[]; onChangeSpy?: (value: string[]) => void } & Omit<
  Extract<SelectProps, { multiple: true }>,
  "value" | "onChange" | "multiple"
>) => {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <Field label="Holat" labelAs="span" hint="Tanlanmasa — barcha holatlar">
      <Select
        {...props}
        multiple
        value={value}
        onChange={(next) => {
          setValue(next);
          onChangeSpy?.(next);
        }}
      />
    </Field>
  );
};

const combobox = (name = "Viloyat") => screen.getByRole("combobox", { name });
const activeOption = () => {
  const id = combobox().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("Select — yopiq holat", () => {
  it("tugma combobox: yorliq bilan nomlanadi, aria-haspopup=listbox, namuna matni text-subtle", () => {
    render(<SingleControlled options={REGIONS} placeholder="Viloyat tanlang" />);
    const trigger = combobox();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-required", "true");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(within(trigger).getByText("Viloyat tanlang")).toHaveClass("text-text-subtle");
    const box = trigger.closest("[data-select]")!;
    expect(box).toHaveClass("h-10", "max-md:h-11", "rounded-[10px]", "border-border-strong", "bg-input");
  });

  it("tanlangan qiymat ko'rinadi (text-subtle emas)", () => {
    render(<SingleControlled options={REGIONS} initial="tashkent-city" placeholder="Viloyat tanlang" />);
    expect(within(combobox()).getByText("Toshkent sh.")).not.toHaveClass("text-text-subtle");
  });

  it("xato: aria-invalid + aria-errormessage, chegara danger", () => {
    render(
      <Field label="Tuman" required labelAs="span" error="Tumanni tanlang">
        <Select options={REGIONS} placeholder="Tuman tanlang" />
      </Field>,
    );
    const trigger = combobox("Tuman");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    const errorId = trigger.getAttribute("aria-errormessage")!;
    expect(document.getElementById(errorId)).toHaveTextContent("Tumanni tanlang");
    expect(trigger.closest("[data-select]")).toHaveClass("border-danger");
  });

  it("o'chirilgan: tugma disabled, ochilmaydi, sabab ko'rsatmada", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Tuman" required labelAs="span" disabled hint="Viloyat tanlangach ochiladi">
        <Select options={REGIONS} placeholder="Avval viloyatni tanlang" />
      </Field>,
    );
    const trigger = combobox("Tuman");
    expect(trigger).toBeDisabled();
    expect(trigger.closest("[data-select]")).toHaveClass("bg-sunken", "cursor-not-allowed");
    await user.click(trigger.closest("[data-select]")!);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAccessibleDescription("Viloyat tanlangach ochiladi");
  });

  it("name: oddiy forma uchun yashirin input", () => {
    const { container } = render(<Select aria-label="Viloyat" name="region" options={REGIONS} value="samarkand" />);
    expect(container.querySelector('input[type="hidden"][name="region"]')).toHaveValue("samarkand");
  });
});

describe("Select — ochiq ro'yxat", () => {
  it("bosilganda ochiladi: listbox yorliq bilan, tanlangan variant aria-selected + Check, faol", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={REGIONS} initial="tashkent-city" />);
    await user.click(combobox());
    const listbox = screen.getByRole("listbox", { name: "Viloyat" });
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(combobox()).toHaveAttribute("aria-controls", listbox.id);
    const selected = screen.getByRole("option", { name: "Toshkent sh." });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveClass("bg-action-soft", "font-semibold", "text-action-fg");
    expect(selected.querySelector("svg")).not.toBeNull();
    expect(activeOption()).toBe(selected);
    expect(screen.getByRole("option", { name: "Farg'ona" })).toHaveAttribute("aria-disabled", "true");
    // Fokus maydonda qoladi (aria-activedescendant naqshi).
    expect(combobox()).toHaveFocus();
  });

  it("variantni bosish — tanlaydi, yopiladi, fokus maydonda", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SingleControlled options={REGIONS} onChangeSpy={onChange} />);
    await user.click(combobox());
    await user.click(screen.getByRole("option", { name: "Samarqand" }));
    expect(onChange).toHaveBeenCalledWith("samarkand");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveTextContent("Samarqand");
    expect(combobox()).toHaveFocus();
  });

  it("o'chirilgan variant bosilmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SingleControlled options={REGIONS} onChangeSpy={onChange} />);
    await user.click(combobox());
    await user.click(screen.getByRole("option", { name: "Farg'ona" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it.each([
    ["oddiy", false],
    ["qidiruvli", true],
  ])("%s: fokus hech qayerga ketsa (telefon klaviaturasi yopildi, `blur()`) — ro'yxat yopiladi, `onBlur` chaqiriladi", async (_, searchable) => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onChangeSpy = vi.fn();
    render(<SingleControlled options={REGIONS} searchable={searchable} onBlur={onBlur} onChangeSpy={onChangeSpy} />);
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    act(() => combobox().blur());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onChangeSpy).not.toHaveBeenCalled();

    // Variant bosilishi fokusni maydondan olmaydi — tanlash avvalgidek ishlaydi.
    await user.click(combobox());
    await user.click(screen.getByRole("option", { name: "Andijon" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith("andijan");
    expect(combobox()).toHaveFocus();
  });

  it("tashqariga bosish va Tab yopadi", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SingleControlled options={REGIONS} />
        <button type="button">Boshqa</button>
      </>,
    );
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Boshqa" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(combobox());
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ochiq maydon — fokus ko'rinishida (maket `.is-focus`): ko'k chegara + halqa; xatoda — qizil halqa", () => {
    const { rerender } = render(<Select aria-label="Viloyat" portal={false} open options={REGIONS} />);
    const box = () => combobox().closest("[data-select]")!;
    expect(box()).toHaveClass("border-action", "ring-3", "ring-focus");
    expect(box()).not.toHaveClass("border-border-strong");
    rerender(<Select aria-label="Viloyat" portal={false} open invalid options={REGIONS} />);
    expect(box()).toHaveClass("border-danger", "ring-danger-soft");
    expect(box()).not.toHaveClass("border-action");
    rerender(<Select aria-label="Viloyat" portal={false} options={REGIONS} />);
    expect(box()).toHaveClass("border-border-strong");
    expect(box()).not.toHaveClass("ring-3");
  });

  it("qidiruvli maydon namunasiz ham bo'sh qolmaydi — «Tanlang»", () => {
    render(<Select aria-label="Market" searchable options={MARKETS} />);
    expect(screen.getByRole("combobox", { name: "Market" })).toHaveAttribute("placeholder", "Tanlang");
  });

  it("maket o'lchamlari: panel RAISED p-1.5, variant 36 px (telefonda 44)", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={REGIONS} />);
    await user.click(combobox());
    const panel = screen.getByRole("listbox").closest("[data-select-panel]")!;
    expect(panel).toHaveClass("rounded-xl", "border-border", "bg-raised", "shadow-xl", "p-1.5");
    expect(panel.parentElement).toHaveAttribute("data-ui-layer", "dropdown");
    expect(screen.getByRole("option", { name: "Samarqand" })).toHaveClass("min-h-9", "max-md:min-h-11", "rounded-lg");
  });
});

describe("Select — klaviatura (select-only combobox)", () => {
  it("↓ ochadi (tanlangan faol), ↓ ↑ yuradi va o'chirilganni o'tkazadi, Enter tanlaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SingleControlled options={REGIONS} initial="samarkand" onChangeSpy={onChange} />);
    combobox().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(activeOption()).toHaveTextContent("Samarqand");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Andijon"); // Farg'ona o'chirilgan
    expect(activeOption()).toHaveAttribute("data-active", "true");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("Toshkent sh."); // aylanma
    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toHaveTextContent("Andijon");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("andijan");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveFocus();
  });

  it("Home / End / PageDown / PageUp", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={REGIONS} />);
    combobox().focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(activeOption()).toHaveTextContent("Andijon");
    await user.keyboard("{Home}");
    expect(activeOption()).toHaveTextContent("Toshkent sh.");
    await user.keyboard("{PageDown}");
    expect(activeOption()).toHaveTextContent("Andijon");
    await user.keyboard("{PageUp}");
    expect(activeOption()).toHaveTextContent("Toshkent sh.");
  });

  it("Enter va Probel yopiq ro'yxatni ochadi; Probel ochiqda tanlaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SingleControlled options={REGIONS} onChangeSpy={onChange} />);
    combobox().focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown} ");
    expect(onChange).toHaveBeenCalledWith("tashkent");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("type-ahead: harf yozilsa mos variantga o'tadi (bir xil harf — keyingisiga)", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={REGIONS} />);
    combobox().focus();
    await user.keyboard("t");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(activeOption()).toHaveTextContent("Toshkent sh.");
    await user.keyboard("t");
    expect(activeOption()).toHaveTextContent("Toshkent viloyati");
    await new Promise((resolve) => setTimeout(resolve, 600));
    await user.keyboard("sam");
    expect(activeOption()).toHaveTextContent("Samarqand");
  });

  it("Esc faqat ro'yxatni yopadi: oyna (fokus qamog'i) ochiq qoladi, fokus maydonda", async () => {
    const user = userEvent.setup();
    const onDialogEscape = vi.fn();
    const Dialog = () => {
      const ref = useFocusTrap<HTMLDivElement>(true, { onEscape: onDialogEscape });
      return (
        <div ref={ref} role="dialog" aria-label="Oyna" tabIndex={-1}>
          <SingleControlled options={REGIONS} />
        </div>
      );
    };
    render(<Dialog />);
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onDialogEscape).not.toHaveBeenCalled();
    expect(combobox()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onDialogEscape).toHaveBeenCalledTimes(1);
  });

  it("v2 Dialog ichida: ro'yxat oynadan yuqori qatlamda, bosish tanlaydi, oyna ochiq qoladi; Esc — avval ro'yxat", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onChange = vi.fn();
    render(
      <DialogV2 open onClose={onClose} title="Xodim qo'shish">
        <SingleControlled options={REGIONS} onChangeSpy={onChange} />
      </DialogV2>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Xodim qo'shish" });
    await user.click(within(dialog).getByRole("combobox", { name: "Viloyat" }));
    const listbox = screen.getByRole("listbox", { name: "Viloyat" });
    const layerZ = (element: Element) => Number((element.closest("[data-ui-layer]") as HTMLElement).style.zIndex);
    expect(layerZ(listbox)).toBeGreaterThan(layerZ(dialog));
    expect(listbox.closest("[inert]")).toBeNull();
    await user.click(screen.getByRole("option", { name: "Samarqand" }));
    expect(onChange).toHaveBeenCalledWith("samarkand");
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("combobox", { name: "Viloyat" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Select — qidiruv (searchable)", () => {
  const renderMarkets = (props: Partial<Extract<SelectProps, { multiple?: false }>> = {}) => {
    const onChange = vi.fn();
    const Demo = () => {
      const [value, setValue] = useState<string | null>(null);
      return (
        <Field label="Market" required>
          <Select
            searchable
            options={MARKETS}
            value={value}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
            {...props}
          />
        </Field>
      );
    };
    render(<Demo />);
    return { onChange };
  };

  it("maydon — input combobox (aria-autocomplete=list), chapda qidiruv ikonkasi", () => {
    renderMarkets();
    const input = screen.getByRole("combobox", { name: "Market" });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveClass("text-inherit");
    expect(input.closest("[data-select]")).toHaveClass("text-base", "md:text-sm");
  });

  it("yozilganda saralaydi, mos qism qalin, birinchi mos variant faol, Enter tanlaydi", async () => {
    const user = userEvent.setup();
    const { onChange } = renderMarkets();
    const input = screen.getByRole("combobox", { name: "Market" });
    await user.click(input);
    await user.keyboard("bar");
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Baraka Shop", "Barhayot Market", "Anbar Savdo"]);
    expect(options[2].querySelector("strong")).toHaveTextContent("bar");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);
    expect(screen.getByRole("status")).toHaveTextContent("3 ta natija");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2");
    expect(input).toHaveValue("Barhayot Market");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("apostrof turlari bir xil qidiriladi", async () => {
    const user = userEvent.setup();
    render(
      <Select
        aria-label="Viloyat"
        searchable
        options={[
          { value: "a", label: "Farg‘ona" },
          { value: "b", label: "Andijon" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Viloyat" }));
    await user.keyboard("farg'");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Farg‘ona"]);
  });

  it("topilmasa — «Topilmadi» + izoh (maket matni), live region", async () => {
    const user = userEvent.setup();
    renderMarkets({ emptyHint: (query) => `«${query}» bo'yicha market yo'q` });
    await user.click(screen.getByRole("combobox", { name: "Market" }));
    await user.keyboard("Zarafshon");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("«Zarafshon» bo'yicha market yo'q")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Topilmadi");
  });

  it("yopilganda (Esc) qidiruv tozalanadi, tanlangan nom qaytadi", async () => {
    const user = userEvent.setup();
    renderMarkets();
    const input = screen.getByRole("combobox", { name: "Market" });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Nur Elektronika" }));
    expect(input).toHaveValue("Nur Elektronika");
    await user.click(input);
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Nur Elektronika");
    await user.keyboard("ba{Escape}");
    expect(input).toHaveValue("Nur Elektronika");
  });

  it("server qidiruvi: filter={false} — saralamaydi, onSearchChange chaqiriladi", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Select aria-label="Market" searchable filter={false} onSearchChange={onSearchChange} options={MARKETS} />);
    await user.click(screen.getByRole("combobox", { name: "Market" }));
    await user.keyboard("zz");
    expect(onSearchChange).toHaveBeenLastCalledWith("zz");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });
});

describe("Select — tozalash va «Barchasi» (ega qarori 2026-10-16, filtrlar)", () => {
  const WITH_ALL: SelectOption[] = [{ value: "", label: "Barchasi" }, ...REGIONS];

  it("clearable: × «Tozalash» faqat qiymat bo'lsa (chevron o'rnida); bosilsa null, fokus maydonda", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<SingleControlled options={REGIONS} clearable placeholder="Viloyat tanlang" onChangeSpy={onChangeSpy} />);
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
    await user.click(combobox());
    await user.click(screen.getByRole("option", { name: "Samarqand" }));
    const clear = screen.getByRole("button", { name: "Tozalash" });
    expect(clear).toHaveAccessibleDescription("Viloyat");
    // Telefonda 44 px (IconButton `max-md:size-11`).
    expect(clear).toHaveClass("size-8", "max-md:size-11");
    await user.click(clear);
    expect(onChangeSpy).toHaveBeenLastCalledWith(null);
    expect(combobox()).toHaveFocus();
    expect(within(combobox()).getByText("Viloyat tanlang")).toHaveClass("text-text-subtle");
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("klaviatura: Tab — × ga, Enter / Probel tozalaydi", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<SingleControlled options={REGIONS} clearable initial="samarkand" onChangeSpy={onChangeSpy} />);
    combobox().focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Tozalash" })).toHaveFocus();
    await user.keyboard(" ");
    expect(onChangeSpy).toHaveBeenLastCalledWith(null);
    expect(combobox()).toHaveFocus();
  });

  it("bo'sh qiymatli («Barchasi») variant: bo'sh maydonda uning nomi (namuna), × o'zi chiqadi va \"\" qaytaradi", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<SingleControlled options={WITH_ALL} placeholder="Viloyat tanlang" onChangeSpy={onChangeSpy} />);
    expect(within(combobox()).getByText("Barchasi")).toHaveClass("text-text-subtle");
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();

    await user.click(combobox());
    // «Barchasi» ro'yxatda ham — tanlangan (qiymat bo'sh).
    expect(screen.getByRole("option", { name: "Barchasi" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Andijon" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith("andijan");

    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith("");
    expect(within(combobox()).getByText("Barchasi")).toHaveClass("text-text-subtle");
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("qiymat \"\" (variantsiz) — tanlanmagan: × yo'q", () => {
    render(<SingleControlled options={REGIONS} clearable initial="" placeholder="Viloyat tanlang" />);
    expect(within(combobox()).getByText("Viloyat tanlang")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("qidiruvli maydonda ham × (chevron o'rnida); ochiq ro'yxat tozalanganda yopiladi", async () => {
    const user = userEvent.setup();
    const onChangeSpy = vi.fn();
    render(<SingleControlled options={WITH_ALL} searchable initial="samarkand" onChangeSpy={onChangeSpy} />);
    expect(combobox()).toHaveValue("Samarqand");
    await user.click(combobox());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveValue("");
    expect(combobox()).toHaveAttribute("placeholder", "Barchasi");
  });

  it("yuklanayotganda × o'rnida spinner (URL'dagi qiymat nomi hali kelmagan)", () => {
    render(<SingleControlled options={[]} clearable loading initial="samarkand" />);
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
    expect(combobox().closest("[data-select]")!.querySelector("[data-select-loading]")).not.toBeNull();
  });

  it("o'chirilgan maydonda × yo'q", () => {
    render(<SingleControlled options={REGIONS} clearable disabled initial="samarkand" />);
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("inlineLabel — kulrang «Holat:» (aria-hidden), bo'sh matn oddiy rangda (maket superadmin-users-list)", () => {
    render(<SingleControlled options={WITH_ALL} inlineLabel="Holat" />);
    const inline = combobox().querySelector("[data-select-inline-label]")!;
    expect(inline).toHaveTextContent("Holat:");
    expect(inline).toHaveAttribute("aria-hidden", "true");
    expect(inline).toHaveClass("text-text-muted");
    expect(within(combobox()).getByText("Barchasi")).not.toHaveClass("text-text-subtle");
  });
});

describe("Select — ko'p tanlov", () => {
  it("belgilar: 2 tasi ko'rinadi, qolgani «+N»; har birini olib tashlash", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiControlled
        options={STATUSES}
        initial={["new", "on_the_road", "waiting"]}
        onChangeSpy={onChange}
        removeLabel={(label) => `${label} holatini olib tashlash`}
      />,
    );
    const trigger = combobox("Holat");
    expect(trigger).toHaveTextContent("Yangi, Yo'lda, Kutilmoqda");
    expect(screen.getByText("+1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yo'lda holatini olib tashlash" }));
    expect(onChange).toHaveBeenLastCalledWith(["new", "waiting"]);
    expect(combobox("Holat")).toHaveFocus();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });

  it("ro'yxat ochiq qoladi, aria-multiselectable, pastda «N ta tanlangan · Tozalash»", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiControlled options={STATUSES} initial={["new"]} onChangeSpy={onChange} />);
    await user.click(combobox("Holat"));
    const listbox = screen.getByRole("listbox", { name: "Holat" });
    expect(listbox).toHaveAttribute("aria-multiselectable", "true");
    await user.click(screen.getByRole("option", { name: "Kutilmoqda" }));
    expect(onChange).toHaveBeenLastCalledWith(["new", "waiting"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Pastda ko'rinadigan «2 ta tanlangan» (ekran o'quvchiga — live region orqali, takrorlanmaydi).
    const footerCount = screen.getAllByText("2 ta tanlangan").find((node) => node.getAttribute("role") !== "status");
    expect(footerCount).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 ta tanlangan");
    // Klaviatura: Enter — almashtiradi, ro'yxat ochiq
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["new"]);
    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("clearable: «Barchasini tozalash» (maketda — «Barcha holatlarni tozalash»)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiControlled
        options={STATUSES}
        initial={["new", "sold"]}
        clearable
        placeholder="Holatni tanlang"
        clearLabel="Barcha holatlarni tozalash"
        onChangeSpy={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Barcha holatlarni tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(combobox("Holat")).toHaveTextContent("Holatni tanlang");
    expect(screen.queryByRole("button", { name: "Barcha holatlarni tozalash" })).not.toBeInTheDocument();
  });

  it("multiDisplay=count — «N ta tanlangan»", () => {
    render(<MultiControlled options={STATUSES} initial={["new", "sold"]} multiDisplay="count" />);
    expect(screen.getByText("2 ta tanlangan")).toBeInTheDocument();
  });
});

describe("Select — holatlar va guruhlar", () => {
  it("yuklanmoqda: spinner + «Yuklanmoqda...», aria-busy", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={[]} loading placeholder="Tuman tanlang" />);
    expect(combobox()).toHaveAttribute("aria-busy", "true");
    await user.click(combobox());
    expect(screen.getByRole("listbox", { hidden: true })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Yuklanmoqda...");
  });

  it("yopiq + yuklanmoqda (`tizim-loading` 9): chevron o'rnida spinner, maydon bloklanmaydi; loadingText", async () => {
    const user = userEvent.setup();
    render(
      <SingleControlled
        options={[]}
        loading
        loadingText="Kuryerlar yuklanmoqda…"
        placeholder="Kuryerni tanlang"
      />,
    );
    const box = combobox().closest<HTMLElement>("[data-select]")!;
    expect(box.querySelector("[data-select-loading]")).not.toBeNull();
    expect(combobox()).toBeEnabled();
    await user.click(combobox());
    // Ochiq: spinner ro'yxatda, maydonda — yuqoriga chevron.
    expect(box.querySelector("[data-select-loading]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Kuryerlar yuklanmoqda…");
    expect(screen.getAllByText("Kuryerlar yuklanmoqda…").length).toBeGreaterThan(0);
  });

  it("ro'yxat bo'sh — «Ro'yxat bo'sh»", async () => {
    const user = userEvent.setup();
    render(<SingleControlled options={[]} />);
    await user.click(combobox());
    expect(screen.getAllByText("Ro'yxat bo'sh").length).toBeGreaterThan(0);
  });

  it("guruhlar: role=group yorliq bilan, ikkinchi qator (izoh)", async () => {
    const user = userEvent.setup();
    render(
      <Select
        aria-label="Foydalanuvchi"
        options={[
          { value: "1", label: "Dilshod Karimov", description: "dilshod.k · Kuryer", group: "Kuryerlar" },
          { value: "2", label: "Umid Haydarov", description: "umid.h · Menejer", group: "Menejerlar" },
          { value: "3", label: "Doniyor Rasulov", description: "doniyor.r · Kuryer", group: "Kuryerlar" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Foydalanuvchi" }));
    const couriers = screen.getByRole("group", { name: "Kuryerlar" });
    expect(within(couriers).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Dilshod Karimovdilshod.k · Kuryer",
      "Doniyor Rasulovdoniyor.r · Kuryer",
    ]);
    // Klaviatura tartibi ko'rinish tartibida: Kuryerlar, keyin Menejerlar.
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Foydalanuvchi" }), { key: "End" });
    expect(screen.getByRole("combobox", { name: "Foydalanuvchi" })).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /Umid Haydarov/ }).id,
    );
  });

  it("portal={false}: ro'yxat maydon ostida absolute (namuna sahifasi)", () => {
    render(<Select aria-label="Viloyat" portal={false} open options={REGIONS} />);
    const panel = screen.getByRole("listbox").closest("[data-select-panel]")!;
    expect(panel).toHaveClass("absolute", "top-full", "mt-2", "max-h-[280px]");
    expect(panel.closest("[data-ui-layer]")).toBeNull();
  });
});

describe("Select — ekran o'quvchi va eski (v1) konteynerlar", () => {
  it("qidiruvda faol variant id'si qiymatga bog'liq: natija o'zgarsa aria-activedescendant ham o'zgaradi", async () => {
    const user = userEvent.setup();
    render(<Select aria-label="Market" searchable options={MARKETS} />);
    const input = screen.getByRole("combobox", { name: "Market" });
    await user.click(input);
    const before = input.getAttribute("aria-activedescendant");
    expect(document.getElementById(before!)).toHaveTextContent("Baraka Shop");
    await user.keyboard("nur");
    const after = input.getAttribute("aria-activedescendant");
    // Indeks bo'yicha id (`-option-0`) bir xil qolardi — ekran o'quvchi yangi variantni aytmasdi.
    expect(after).not.toBe(before);
    expect(document.getElementById(after!)).toHaveTextContent("Nur Elektronika");
  });

  it("qiymatda bo'sh joy va maxsus belgi bo'lsa ham id yaroqli va noyob", async () => {
    const user = userEvent.setup();
    render(
      <Select
        aria-label="Market"
        options={[
          { value: "a b", label: "Bir" },
          { value: "a_b", label: "Ikki" },
          { value: "a\"b", label: "Uch" },
        ]}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Market" }));
    const ids = screen.getAllByRole("option").map((option) => option.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).not.toMatch(/\s/);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("ko'p tanlov: belgilanganda live region tanlanganlar sonini aytadi", async () => {
    const user = userEvent.setup();
    render(<MultiControlled options={STATUSES} />);
    await user.click(combobox("Holat"));
    await user.click(screen.getByRole("option", { name: "Yo'lda" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 ta tanlangan");
    await user.click(screen.getByRole("option", { name: "Yangi" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 ta tanlangan");
  });

  it("qidiruvli yopiq maydonda Enter formani yubormaydi — ro'yxatni ochadi (v1 kabi)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Select aria-label="Market" searchable options={MARKETS} />
        <button type="submit">Yuborish</button>
      </form>,
    );
    const input = screen.getByRole("combobox", { name: "Market" });
    input.focus();
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("maydon ko'rinmay qolsa (ota panel yig'ildi / skroll) — ro'yxat yopiladi, egasiz osilib qolmaydi", async () => {
    const user = userEvent.setup();
    let notify: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          notify = callback;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve() {}
        takeRecords() {
          return [];
        }
      },
    );
    try {
      render(<MultiControlled options={STATUSES} />);
      await user.click(combobox("Holat"));
      expect(observe).toHaveBeenCalledWith(combobox("Holat").closest("[data-select]"));
      act(() => notify?.([{ isIntersecting: true }]));
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      act(() => notify?.([{ isIntersecting: false }]));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(combobox("Holat")).toHaveAttribute("aria-expanded", "false");
      expect(disconnect).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ro'yxatga bosish eski «tashqariga bosish» (document mousedown) panelini yopmaydi", async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    const Legacy = () => (
      <div
        ref={(node) => {
          if (!node) return;
          const handler = (event: MouseEvent) => {
            if (!node.contains(event.target as Node)) outside();
          };
          document.addEventListener("mousedown", handler);
          return () => document.removeEventListener("mousedown", handler);
        }}
      >
        <Select aria-label="Holat" multiple options={STATUSES} />
      </div>
    );
    render(<Legacy />);
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(screen.getByRole("option", { name: "Yangi" }));
    expect(outside).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Yangi" })).toHaveAttribute("aria-selected", "true");
  });
});
