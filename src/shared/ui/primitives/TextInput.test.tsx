import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { Field } from "./Field";
import { TextInput, type TextInputFieldProps } from "./TextInput";

/**
 * TextInput — `.el-input` / `.el-input-lg` / `.el-search` / `.el-textarea` (CODE-MAP 2.2,
 * `tizim-states-forms` 01–02): o'lcham, holatlar, qidiruv (tozalash, Enter, Esc), telefon niqobi,
 * summa, ko'p qatorli, telefonda 16 px.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const boxOf = (input: HTMLElement) => input.closest<HTMLElement>("[data-text-input]")!;

const Controlled = ({ initial = "", ...props }: { initial?: string } & Omit<TextInputFieldProps, "value">) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TextInput aria-label="maydon" value={value} onValueChange={setValue} {...props} />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe("TextInput — ko'rinish", () => {
  it("md: 40 px (telefonda 44), r 10, tokenli chegara/fon; maydon telefonda 16 px", () => {
    render(<TextInput aria-label="maydon" />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    const box = boxOf(input);
    expect(box).toHaveClass("h-10", "max-md:h-11", "rounded-[10px]", "border-border-strong", "bg-input", "px-3");
    expect(box).toHaveClass("focus-within:border-action", "focus-within:ring-3", "focus-within:ring-focus");
    expect(box).toHaveClass("hover:border-text-subtle");
    expect(input).toHaveClass("text-base", "md:text-sm", "outline-none!");
    expect(box.className).not.toMatch(/#|gradient|dark:|bg-white|\btext-(xs|sm)\b(?!\S)/);
  });

  it("lg: 48 px, r 12, 15 px", () => {
    render(<TextInput aria-label="maydon" size="lg" />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    expect(boxOf(input)).toHaveClass("h-12", "rounded-xl");
    expect(input).toHaveClass("text-base", "md:text-[15px]");
  });

  it("xato: danger chegara, fokusda danger-soft halqa, hover yo'q", () => {
    render(<TextInput aria-label="maydon" invalid />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const box = boxOf(input);
    expect(box).toHaveClass("border-danger", "focus-within:ring-danger-soft");
    expect(box).not.toHaveClass("hover:border-text-subtle", "focus-within:ring-focus");
  });

  it("muvaffaqiyat: success chegara + CircleCheck", () => {
    render(<TextInput aria-label="maydon" success defaultValue="Dilnoza" />);
    const box = boxOf(screen.getByRole("textbox", { name: "maydon" }));
    expect(box).toHaveClass("border-success");
    expect(box.querySelector("svg.text-success-fg")).not.toBeNull();
  });

  it("o'chirilgan: sunken fon, subtle matn, qulf ikonka; faqat o'qish: sunken, nusxa tugmasi", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <>
        <TextInput aria-label="o'chiq" disabled defaultValue="Dilnoza Karimova" />
        <TextInput aria-label="o'qish" readOnly copyable copyLabel="Ismdan nusxa olish" defaultValue="Dilnoza Karimova" />
      </>,
    );
    const disabled = screen.getByRole("textbox", { name: "o'chiq" });
    expect(disabled).toBeDisabled();
    expect(boxOf(disabled)).toHaveClass("bg-sunken", "text-text-subtle", "cursor-not-allowed");
    expect(boxOf(disabled)).not.toHaveClass("hover:border-text-subtle");
    expect(boxOf(disabled).querySelector("svg.text-text-subtle")).not.toBeNull();

    const readOnly = screen.getByRole("textbox", { name: "o'qish" });
    expect(boxOf(readOnly)).toHaveClass("bg-sunken");
    expect(boxOf(readOnly)).not.toHaveClass("text-text-subtle");
    await user.click(screen.getByRole("button", { name: "Ismdan nusxa olish" }));
    expect(writeText).toHaveBeenCalledWith("Dilnoza Karimova");
    expect(await screen.findByRole("button", { name: "Nusxa olindi" })).toBeInTheDocument();
  });

  it("chap ikonka va o'ng qo'shimcha (suffix)", () => {
    render(<TextInput aria-label="soni" suffix="ta" />);
    expect(screen.getByText("ta")).toHaveClass("text-text-muted");
  });
});

describe("TextInput — qidiruv", () => {
  it("type=search, chapda Search; yozilganda × — tozalaydi, fokus maydonda qoladi", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Controlled mode="search" onClear={onClear} />);
    const input = screen.getByRole("searchbox", { name: "maydon" });
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    expect(boxOf(input).querySelectorAll("svg")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Qidiruvni tozalash" })).not.toBeInTheDocument();

    await user.type(input, "Dilno");
    await user.click(screen.getByRole("button", { name: "Qidiruvni tozalash" }));
    expect(screen.getByTestId("value")).toHaveTextContent("");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("Enter — onSearch; Esc — tozalaydi va hodisa tashqariga chiqmaydi", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onDocumentEscape = vi.fn();
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onDocumentEscape(event.defaultPrevented);
    document.addEventListener("keydown", listener);
    render(<Controlled mode="search" onSearch={onSearch} />);
    const input = screen.getByRole("searchbox", { name: "maydon" });
    await user.type(input, "Baraka{Enter}");
    expect(onSearch).toHaveBeenCalledWith("Baraka");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
    expect(onDocumentEscape).not.toHaveBeenCalled();
    // Bo'sh maydonda Esc tashqariga o'tadi (oynani yopish uchun).
    await user.keyboard("{Escape}");
    expect(onDocumentEscape).toHaveBeenCalledWith(false);
    document.removeEventListener("keydown", listener);
  });
});

describe("TextInput — telefon", () => {
  it("+998 o'zgarmaydi, raqamlar 2-3-2-2 bo'linadi, qiymat +998…", async () => {
    const user = userEvent.setup();
    render(<Controlled mode="phone" initial="+998" />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("placeholder", "XX XXX XX XX");
    expect(boxOf(input)).toHaveTextContent("+998");

    await user.type(input, "901234567");
    expect(input).toHaveValue("90 123 45 67");
    expect(screen.getByTestId("value")).toHaveTextContent("+998901234567");

    await user.type(input, "8");
    expect(screen.getByTestId("value")).toHaveTextContent("+998901234567");
  });

  it("qiymat +998 bilan yoki raqamlar bilan kelsa ham to'g'ri ko'rinadi", () => {
    render(
      <>
        <TextInput aria-label="a" mode="phone" value="+998931234567" onValueChange={() => {}} />
        <TextInput aria-label="b" mode="phone" value="998901112233" onValueChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "a" })).toHaveValue("93 123 45 67");
    expect(screen.getByRole("textbox", { name: "b" })).toHaveValue("90 111 22 33");
  });
});

describe("TextInput — son va summa", () => {
  it("money: mingliklar bilan ko'rinadi, qiymat raqamlar; o'ngda so'm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    render(<Controlled mode="money" />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    await user.type(input, "1545000");
    expect(input).toHaveValue("1 545 000");
    expect(screen.getByTestId("value")).toHaveTextContent("1545000");
    expect(screen.getByText("so'm")).toBeInTheDocument();
  });

  it("number: harflar tushib qoladi", async () => {
    const user = userEvent.setup();
    render(<Controlled mode="number" />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    await user.type(input, "1a2");
    expect(input).toHaveValue("12");
  });
});

describe("TextInput — ko'p qatorli va boshqarilmaydigan", () => {
  it("multiline: textarea, kamida 88 px, bo'yiga cho'ziladi, telefonda 16 px", () => {
    render(<TextInput multiline aria-label="izoh" />);
    const textarea = screen.getByRole("textbox", { name: "izoh" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "3");
    expect(textarea).toHaveClass("min-h-[88px]", "resize-y", "py-2.5", "text-base", "md:text-sm", "bg-input");
  });

  it("defaultValue bilan ishlaydi, onChange ham chaqiriladi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextInput aria-label="maydon" defaultValue="a" onChange={onChange} clearable />);
    const input = screen.getByRole("textbox", { name: "maydon" });
    await user.type(input, "b");
    expect(input).toHaveValue("ab");
    expect(onChange).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(input).toHaveValue("");
  });

  it("quti chetiga bosilsa fokus maydonga o'tadi", async () => {
    const user = userEvent.setup();
    render(<TextInput aria-label="maydon" mode="search" />);
    const input = screen.getByRole("searchbox", { name: "maydon" });
    await user.click(boxOf(input));
    expect(input).toHaveFocus();
  });

  it("ref — ichki input", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextInput aria-label="maydon" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox", { name: "maydon" }));
  });

  it("Field ichida xato — maydon invalid", () => {
    render(
      <Field label="Telefon raqam" required error="Telefon raqam 9 ta raqamdan iborat bo'lishi kerak">
        <TextInput mode="phone" value="+99890" onValueChange={() => {}} />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Telefon raqam" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(boxOf(input)).toHaveClass("border-danger");
  });
});

describe("TextInput — til", () => {
  it("ru: valyuta сум, tozalash nomi ruscha", async () => {
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    render(<TextInput aria-label="maydon" mode="money" defaultValue="45000" clearable />);
    expect(screen.getByText("сум")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "maydon" })).toHaveValue("45 000");
    expect(screen.getByRole("button", { name: "Очистить" })).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("uz");
    });
  });
});
