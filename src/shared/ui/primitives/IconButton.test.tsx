import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Printer, RefreshCw } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { IconButton, type IconButtonVariant } from "./IconButton";

/**
 * IKONKA TUGMA — `tizim-states-buttons` («Ikonka tugma», «Ikonka tugma, chegarali») va
 * «O'lchamlar» (32 · 40 · 44, telefonda 44×44). Nomi majburiy: aria-label + maslahat.
 */

const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
/** Faol (o'chirilmagan, yuklanmayotgan) tugma prefiksi. */
const IA = "not-disabled:not-aria-busy:";

describe("IconButton — nom (aria-label) majburiy", () => {
  it("label → aria-label va title, ikonka aria-hidden", () => {
    render(<IconButton label="Yangilash" icon={RefreshCw} />);
    const button = screen.getByRole("button", { name: "Yangilash" });
    expect(button).toHaveAttribute("aria-label", "Yangilash");
    expect(button).toHaveAttribute("title", "Yangilash");
    expect(button).toHaveAttribute("type", "button");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveTextContent("");
  });

  it("label tipda majburiy, title/children bilan almashtirib bo'lmaydi", () => {
    // @ts-expect-error — `label` yo'q
    const missing = <IconButton icon={RefreshCw} />;
    // @ts-expect-error — `title` alohida berilmaydi, `label` dan olinadi
    const withTitle = <IconButton label="Yangilash" title="Boshqa" icon={RefreshCw} />;
    // @ts-expect-error — matn qo'shilmaydi (matnli tugma — Button)
    const withChildren = <IconButton label="Yangilash" icon={RefreshCw}>Yangilash</IconButton>;
    expect([missing, withTitle, withChildren]).toHaveLength(3);
  });

  it("aria-label (JSX'da tire bilangi atribut — TS tekshirmaydi) label'ni bosib o'tolmaydi", () => {
    const rest = { "aria-label": "Boshqa" } as Record<string, string>;
    render(<IconButton label="Yangilash" icon={RefreshCw} {...rest} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Yangilash");
  });

  it("bo'sh label — dev rejimida konsol xatosi", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<IconButton label="  " icon={RefreshCw} />);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("label"));
    error.mockRestore();
  });

  it("className, ...rest va ref o'tadi", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} label="Chek chop etish" icon={Printer} className="ml-2" data-testid="print" />);
    const button = screen.getByTestId("print");
    expect(ref.current).toBe(button);
    expect(classesOf(button)).toContain("ml-2");
  });
});

describe("IconButton — turlar va o'lchamlar", () => {
  it.each([
    ["ghost", ["border-transparent", "bg-transparent", "text-text-muted", `${IA}hover:bg-sunken`, `${IA}hover:text-text`]],
    ["secondary", ["border-border-strong", "bg-surface", "text-text-muted", `${IA}hover:bg-sunken`]],
    ["primary", ["bg-action", "text-on-solid", `${IA}hover:bg-action-hover`]],
    ["danger", ["text-danger-fg", `${IA}hover:bg-danger-soft`]],
    // Maket `*-orders-detail-edit-order-dialog`: `.el-iconbtn` + `.el-btn-danger-soft` (mahsulotni olib tashlash).
    ["danger-soft", ["bg-danger-soft", "text-danger-fg", `${IA}hover:bg-danger`, `${IA}hover:text-on-solid`]],
  ] as const)("%s", (variant: IconButtonVariant, expected) => {
    render(<IconButton variant={variant} label="Amal" icon={RefreshCw} />);
    expect(classesOf(screen.getByRole("button"))).toEqual(expect.arrayContaining([...expected]));
  });

  it("sukut — ghost · md", () => {
    render(<IconButton label="Yangilash" icon={RefreshCw} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "ghost");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("to'liq qizil fon yo'q (faqat tasdiqlash oynasidagi matnli tugmada)", () => {
    render(<IconButton variant="danger" label="O'chirish" icon={RefreshCw} />);
    expect(classesOf(screen.getByRole("button")).some((c) => /^bg-danger(-fg)?$/.test(c))).toBe(false);
  });

  it.each([
    ["sm", "size-8", "rounded-lg", "16"],
    ["md", "size-10", "rounded-[10px]", "20"],
    ["lg", "size-11", "rounded-xl", "22"],
  ] as const)("o'lcham %s: kvadrat, telefonda 44×44, ikonka %s", (size, box, radius, iconPx) => {
    render(<IconButton size={size} label="Yangilash" icon={RefreshCw} />);
    const button = screen.getByRole("button");
    expect(classesOf(button)).toEqual(expect.arrayContaining([box, radius, "max-md:size-11"]));
    // `!` kerak emas: index.css dagi fokus burchagi va kursor `@layer base` da
    expect(classesOf(button).filter((c) => c.includes("!"))).toEqual([]);
    expect(button.querySelector("svg")).toHaveAttribute("width", iconPx);
  });

  it("fokus halqasi o'chirilmaydi; hover/bosilgan faqat faol tugmada", () => {
    for (const variant of ["ghost", "secondary", "primary", "danger", "danger-soft"] as const) {
      const { unmount } = render(<IconButton variant={variant} label="Yangilash" icon={RefreshCw} />);
      const classes = classesOf(screen.getByRole("button"));
      expect(classes.some((c) => /outline-(none|0)$/.test(c))).toBe(false);
      // fokus halqasi rangi o'tkazilmaydi (Button bilan bir xil ro'yxat)
      expect(classes).toContain("transition-[background-color,border-color,color,box-shadow,opacity]");
      expect(classes.filter((c) => /^transition(-colors|-all)?$/.test(c))).toEqual([]);
      const interactive = classes.filter((c) => /(^|:)(hover|active):/.test(c));
      expect(interactive.length).toBeGreaterThan(0);
      for (const c of interactive) expect(c.startsWith(IA), c).toBe(true);
      unmount();
    }
  });
});

describe("IconButton — yuklanish, o'chirilgan, klaviatura", () => {
  it("loading → aria-busy + aria-disabled (disabled EMAS), spinner ikonka o'rnida, nomi saqlanadi", () => {
    render(<IconButton label="Yangilash" icon={RefreshCw} loading />);
    const button = screen.getByRole("button", { name: "Yangilash" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(classesOf(button)).toContain("aria-busy:cursor-progress");
    expect(button.querySelector("svg")).toBeNull();
    expect(button.querySelector("[data-spinner]")).not.toBeNull();
    expect(classesOf(button.firstElementChild!)).toContain("size-5");
  });

  it("loadingLabel → yuklanish paytida aria-label va title (maket: «Yangilanmoqda»), fokus saqlanadi", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<IconButton label="Yangilash" loadingLabel="Yangilanmoqda" icon={RefreshCw} />);
    await user.tab();
    const button = screen.getByRole("button", { name: "Yangilash" });
    expect(button).toHaveAttribute("title", "Yangilash");

    rerender(<IconButton label="Yangilash" loadingLabel="Yangilanmoqda" icon={RefreshCw} loading />);
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Yangilanmoqda");
    expect(button).toHaveAttribute("title", "Yangilanmoqda");

    rerender(<IconButton label="Yangilash" loadingLabel="Yangilanmoqda" icon={RefreshCw} />);
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleName("Yangilash");
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("disabled → native disabled, aria-busy yo'q", () => {
    render(<IconButton label="Yangilash" icon={RefreshCw} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("loading type=submit formani yubormaydi", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <IconButton type="submit" label="Yangilash" icon={RefreshCw} loading />
      </form>,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["disabled", { disabled: true }],
    ["loading", { loading: true }],
  ])("%s → onClick chaqirilmaydi", async (_, props) => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Yangilash" icon={RefreshCw} onClick={onClick} {...props} />);
    const button = screen.getByRole("button");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Tab bilan fokus, Enter va Space bosadi", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton label="Yangilash" icon={RefreshCw} onClick={onClick} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Yangilash" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
