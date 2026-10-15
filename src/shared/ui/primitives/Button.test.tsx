import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { SEMANTIC_TOKENS, TEXT_MUTED, type ThemeName } from "../../config/themeTokens";
import { Button, buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * TUGMA — `tizim-states-buttons` taxtasi bo'yicha: 7 tur × 3 o'lcham, ikonka, yuklanish,
 * o'chirilgan holat, klaviatura va `buttonClasses` (`<Link>` uchun).
 */

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "link", "success", "danger", "danger-soft"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
/** Faol (o'chirilmagan, yuklanmayotgan) tugma prefiksi. */
const IA = "not-disabled:not-aria-busy:";

describe("Button — sukut va atributlar", () => {
  it("sukut: primary · md · type=button", () => {
    render(<Button>Saqlash</Button>);
    const button = screen.getByRole("button", { name: "Saqlash" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeEnabled();
    expect(classesOf(button)).toEqual(expect.arrayContaining(["bg-action", "text-on-solid", "h-10", "px-4"]));
  });

  it("type=submit, className va ...rest (data-*, aria-*) o'tadi, ref ishlaydi", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <form>
        <Button ref={ref} type="submit" className="mt-4" data-testid="save" aria-describedby="hint" name="action">
          Saqlash
        </Button>
      </form>,
    );
    const button = screen.getByTestId("save");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-describedby", "hint");
    expect(button).toHaveAttribute("name", "action");
    expect(classesOf(button)).toContain("mt-4");
    expect(ref.current).toBe(button);
  });

  it("fokus halqasi o'chirilmaydi (global :focus-visible); `!` kerak emas (index.css @layer base)", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        for (const compact of [false, true]) {
          const classes = buttonClasses({ variant, size, compact }).split(" ");
          expect(classes.some((c) => /(^|:)outline-none$|(^|:)outline-0$/.test(c))).toBe(false);
          expect(classes.filter((c) => c.endsWith("!") || c.startsWith("!"))).toEqual([]);
          expect(classes.some((c) => /^rounded-/.test(c))).toBe(true);
        }
      }
    }
  });

  it("o'tish maketdagi ro'yxat: fokus halqasi rangi (outline-color) animatsiyasiz, harakat kamaytirilganda yo'q", () => {
    const classes = buttonClasses().split(" ");
    expect(classes).toEqual(
      expect.arrayContaining(["transition-[background-color,border-color,color,box-shadow,opacity]", "motion-reduce:transition-none"]),
    );
    // `transition` / `transition-colors` / `transition-all` outline-color ni ham o'tkazadi
    expect(classes.filter((c) => /^transition(-colors|-all)?$/.test(c))).toEqual([]);
  });

  it("hover va bosilgan uslublari faqat faol tugmada (o'chirilgan ham, yuklanayotgan ham emas)", () => {
    for (const variant of VARIANTS) {
      const classes = buttonClasses({ variant }).split(" ");
      const interactive = classes.filter((c) => /(^|:)(hover|active):/.test(c));
      expect(interactive.length).toBeGreaterThan(0);
      for (const c of interactive) expect(c.startsWith("not-disabled:not-aria-busy:"), c).toBe(true);
    }
  });

  it("chaqiruvchining aria-busy / aria-disabled i yuklanmaganda saqlanadi", () => {
    render(
      <Button aria-disabled="true" aria-describedby="why">
        Saqlash
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

describe("Button — turlar va o'lchamlar", () => {
  it.each([
    ["primary", ["bg-action", "text-on-solid", `${IA}hover:bg-action-hover`, `${IA}active:bg-action-hover`]],
    ["secondary", ["border-border-strong", "bg-surface", "text-text", `${IA}hover:bg-sunken`, `${IA}active:bg-border`]],
    ["ghost", ["bg-transparent", "text-text-muted", `${IA}hover:bg-sunken`, `${IA}hover:text-text`]],
    ["link", ["text-action-fg", `${IA}hover:underline`, "px-1"]],
    ["success", ["bg-success", "text-on-solid", `${IA}hover:brightness-108`]],
    ["danger", ["bg-danger", "text-on-solid", `${IA}hover:brightness-108`]],
    ["danger-soft", ["bg-danger-soft", "text-danger-fg", `${IA}hover:bg-danger`, `${IA}hover:text-on-solid`]],
  ] as const)("%s", (variant, expected) => {
    render(<Button variant={variant}>Amal</Button>);
    expect(classesOf(screen.getByRole("button"))).toEqual(expect.arrayContaining([...expected]));
  });

  it.each([
    ["sm", ["h-8", "px-3", "gap-2", "rounded-lg", "text-[13px]"]],
    ["md", ["h-10", "px-4", "gap-2", "rounded-[10px]", "text-sm"]],
    ["lg", ["h-12", "px-5", "gap-2", "rounded-xl", "text-[15px]"]],
  ] as const)("o'lcham %s", (size, expected) => {
    render(<Button size={size}>Amal</Button>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(expect.arrayContaining([...expected, "font-semibold", "max-md:min-h-11"]));
  });

  it("havola balandlik va ichki oraliq olmaydi (maket: height:auto; padding:0 4px), telefonda ≥ 44px", () => {
    for (const size of SIZES) {
      const classes = buttonClasses({ variant: "link", size }).split(" ");
      expect(classes).toEqual(expect.arrayContaining(["px-1", "max-md:min-h-11"]));
      expect(classes.filter((c) => /^h-\d/.test(c) || /^px-[2-9]/.test(c))).toEqual([]);
    }
  });

  it("har tur faqat v2 tokenlarida: hex, palitra, dark: va eski nom yo'q", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        const value = buttonClasses({ variant, size, fullWidth: true });
        expect(value).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|(^|\s|:)dark:/i);
        expect(value).not.toMatch(/-(white|black|gray|slate|blue|red|green|purple|indigo)(-\d+)?(\s|$|\/)/);
        expect(value).not.toMatch(/(^|[\s:-])(bg|text|border)-(main|maindark|primary|primarydark|border-soft|error)(\s|$)/);
        expect(value).not.toMatch(/font-(black|extrabold)|bg-linear|gradient|text-\[(10|11)px\]/);
      }
    }
  });

  it.each([
    ["sm", "px-2.5", "16"],
    ["md", "px-3", "16"],
    ["lg", "px-4", "18"],
  ] as const)("ixcham %s: ichki oraliq %s, oraliq 6, ikonka %spx, balandlik o'zgarmaydi", (size, px, icon) => {
    render(
      <Button size={size} compact leftIcon={Plus}>
        Buyurtma yaratish
      </Button>,
    );
    const button = screen.getByRole("button");
    const classes = classesOf(button);
    expect(classes).toEqual(expect.arrayContaining([px, "gap-1.5", size === "sm" ? "h-8" : size === "md" ? "h-10" : "h-12"]));
    expect(classes).not.toContain("gap-2");
    expect(classes.filter((c) => /^px-/.test(c))).toEqual([px]);
    expect(button.querySelector("svg")).toHaveAttribute("width", icon);
  });

  it("ixcham havola: ichki oraliq baribir 4px (px-1)", () => {
    const classes = buttonClasses({ variant: "link", compact: true }).split(" ");
    expect(classes.filter((c) => /^px-/.test(c))).toEqual(["px-1"]);
    expect(classes).toContain("gap-1.5");
  });

  it("fullWidth → w-full", () => {
    render(<Button fullWidth>Qabul qilish</Button>);
    expect(classesOf(screen.getByRole("button"))).toContain("w-full");
  });
});

describe("Button — ikonkalar", () => {
  it("chap ikonka (lucide komponenti): aria-hidden, md/lg 18px, sm 16px, matndan oldin", () => {
    const { rerender } = render(<Button leftIcon={Plus}>Yaratish</Button>);
    const button = screen.getByRole("button", { name: "Yaratish" });
    const svg = button.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "18");
    expect(button.firstElementChild).toBe(svg);

    rerender(
      <Button size="sm" leftIcon={Plus}>
        Yaratish
      </Button>,
    );
    expect(screen.getByRole("button").querySelector("svg")).toHaveAttribute("width", "16");
  });

  it("element sifatida berilgan ikonka aria-hidden quti ichida", () => {
    render(<Button leftIcon={<Check data-testid="icon" />}>Saqlash</Button>);
    const wrapper = screen.getByTestId("icon").parentElement!;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    expect(classesOf(wrapper)).toContain("size-[18px]");
    expect(screen.getByRole("button")).toHaveAccessibleName("Saqlash");
  });

  it("o'ng ikonka matndan keyin", () => {
    render(<Button rightIcon={Plus}>Keyingi</Button>);
    const button = screen.getByRole("button", { name: "Keyingi" });
    expect(button.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  });
});

describe("Button — yuklanish va o'chirilgan holat", () => {
  it("loading → aria-busy + aria-disabled (disabled EMAS) + spinner chap ikonka o'rnida, yuklanish matni", () => {
    render(
      <Button leftIcon={Plus} loading loadingText="Yaratilmoqda…">
        Yaratish
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Yaratilmoqda…" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[data-spinner]")).not.toBeNull();
    // ikonka spinner bilan almashadi (svg yo'q), spinner ikonka o'lchamidagi qutida — kenglik o'zgarmaydi
    expect(button.querySelector("svg")).toBeNull();
    expect(classesOf(button.firstElementChild!)).toContain("size-[18px]");
    expect(button).not.toHaveTextContent("Yaratish");
  });

  it("loading: rang saqlanadi — shaffoflik faqat oddiy disabled'da, kursor progress", () => {
    render(<Button loading>Saqlash</Button>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(
      expect.arrayContaining(["not-aria-busy:disabled:opacity-45", "aria-busy:cursor-progress"]),
    );
    expect(classes).not.toContain("disabled:opacity-45");
  });

  it("ikonka va yuklanish matni yo'q: spinner markazda, matn joyida ko'rinmas (kenglik o'zgarmaydi)", () => {
    render(
      <Button size="sm" loading>
        Saqlash
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saqlash" });
    const label = screen.getByText("Saqlash");
    expect(classesOf(label)).toContain("opacity-0");
    expect(classesOf(button)).toContain("relative");
    const overlay = button.querySelector("[data-spinner]")!.parentElement!;
    expect(classesOf(overlay)).toEqual(expect.arrayContaining(["absolute", "inset-0"]));
  });

  it("yuklanish matni bor, ikonka yo'q: spinner matndan oldin (maketdagi ko'rinish)", () => {
    render(
      <Button loading loadingText="Saqlanmoqda…">
        Saqlash
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saqlanmoqda…" });
    expect(button.firstElementChild?.querySelector("[data-spinner]")).not.toBeNull();
    expect(classesOf(button)).not.toContain("relative");
  });

  it.each([
    ["disabled", { disabled: true }],
    ["loading", { loading: true }],
  ])("%s → bosish va klaviatura onClick'ni chaqirmaydi", async (_, props) => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} {...props}>
        Saqlash
      </Button>,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each([
    ["disabled", { disabled: true }],
    ["loading", { loading: true }],
  ])("%s type=submit formani yubormaydi (bosish, Enter, Space, maydonda Enter)", async (_, props) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Nomi" />
        <Button type="submit" {...props}>
          Saqlash
        </Button>
      </form>,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.type(screen.getByRole("textbox", { name: "Nomi" }), "x{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("loading: fokus tugmada qoladi va Tab tartibidan chiqmaydi; tugagach bosiladi", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button onClick={onClick} loadingText="Saqlanmoqda…">
        Saqlash
      </Button>,
    );
    await user.tab();
    const button = screen.getByRole("button", { name: "Saqlash" });
    expect(button).toHaveFocus();

    rerender(
      <Button onClick={onClick} loading loadingText="Saqlanmoqda…">
        Saqlash
      </Button>,
    );
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Saqlanmoqda…");
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button onClick={onClick} loadingText="Saqlanmoqda…">
        Saqlash
      </Button>,
    );
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-disabled");
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("o'chirilgan → native disabled (Tab'da o'tkazib yuboriladi), aria-busy yo'q", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button disabled>Saqlash</Button>
        <Button>Keyingi</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saqlash" })).not.toHaveAttribute("aria-busy");
    await user.tab();
    expect(screen.getByRole("button", { name: "Keyingi" })).toHaveFocus();
  });
});

describe("Button — klaviatura", () => {
  it("Tab bilan fokus oladi, Enter va Space bosadi", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Saqlash</Button>);
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe("buttonClasses — <Link> uchun", () => {
  it("sukut primary · md, className oxirida", () => {
    const value = buttonClasses({ className: "mt-2" });
    expect(value.split(" ")).toEqual(expect.arrayContaining(["bg-action", "text-on-solid", "h-10", "rounded-[10px]"]));
    expect(value.endsWith("mt-2")).toBe(true);
    expect(buttonClasses()).toBe(buttonClasses({ variant: "primary", size: "md" }));
  });

  it("Button bilan bir xil klasslar (holat qo'shimchalarisiz)", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        for (const compact of [false, true]) {
          const { unmount } = render(
            <Button variant={variant} size={size} fullWidth compact={compact}>
              Amal
            </Button>,
          );
          expect(screen.getByRole("button").getAttribute("class")).toBe(
            buttonClasses({ variant, size, fullWidth: true, compact }),
          );
          unmount();
        }
      }
    }
  });

  it("<a> ga qo'llanadi va havola sifatida ishlaydi", () => {
    render(
      <a href="/orders" className={buttonClasses({ variant: "secondary", size: "lg" })}>
        Orqaga
      </a>,
    );
    const link = screen.getByRole("link", { name: "Orqaga" });
    expect(classesOf(link)).toEqual(expect.arrayContaining(["border-border-strong", "h-12", "rounded-xl"]));
  });
});

/**
 * KONTRAST — klass xaritasidan (oddiy holat va hover) fon va matn tokenini olib, `SEMANTIC_TOKENS`
 * bo'yicha ikkala mavzuda o'lchaydi. Tugma matni 13–15px (600), shuning uchun ≥ 4.5:1.
 * Shaffof fon (ghost, link) va yarim shaffof `*-soft` — tugma turishi mumkin bo'lgan har yuzada.
 */
describe("Button — kontrast (AA, ikkala mavzuda)", () => {
  const THEMES: ThemeName[] = ["light", "dark"];
  const SURFACES = ["surface", "raised", "bg", "sunken"] as const;

  const tokenValue = (theme: ThemeName, name: string) => {
    if (name === "text-muted") return TEXT_MUTED[theme];
    const value = (SEMANTIC_TOKENS[theme] as Record<string, string>)[name];
    if (!value) throw new Error(`Noma'lum token: ${name}`);
    return value;
  };
  const parse = (value: string): [number, number, number, number] => {
    const rgba = value.match(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)/);
    if (rgba) return [+rgba[1], +rgba[2], +rgba[3], rgba[4] === undefined ? 1 : +rgba[4]];
    const n = parseInt(value.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  };
  const over = (top: string, under: number[]) => {
    const [r, g, b, a] = parse(top);
    return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)];
  };
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  /** `prefix` bilan boshlanadigan (masalan `not-disabled:hover:`) `bg-*` / `text-*` token nomi. */
  const tokenFrom = (classes: string[], prefix: string, kind: "bg" | "text") => {
    const re = new RegExp(`^${prefix.replace(/[:]/g, "\\:")}${kind}-(.+)$`);
    const names = classes.map((c) => c.match(re)?.[1]).filter((n): n is string => !!n && !/^\[|^(xs|sm|base|lg)$/.test(n));
    return names[0];
  };

  const cases = VARIANTS.flatMap((variant) => (["", `${IA}hover:`] as const).map((state) => [variant, state] as const));

  it.each(cases)("%s %s", (variant, state) => {
    const classes = buttonClasses({ variant }).split(" ");
    const bg = tokenFrom(classes, state, "bg") ?? tokenFrom(classes, "", "bg") ?? "transparent";
    const fg = tokenFrom(classes, state, "text") ?? tokenFrom(classes, "", "text");
    expect(fg).toBeDefined();
    for (const theme of THEMES) {
      for (const surface of SURFACES) {
        const base = over(tokenValue(theme, surface), [0, 0, 0]);
        const background = bg === "transparent" ? base : over(tokenValue(theme, bg), base);
        const value = ratio(over(tokenValue(theme, fg!), background), background);
        expect(value, `${variant} ${state || "oddiy"} ${theme}/${surface}: ${bg} + ${fg} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
