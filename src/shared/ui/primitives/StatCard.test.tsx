import { fireEvent, screen } from "@testing-library/react";
import { Banknote, CircleX } from "lucide-react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { renderWithProviders } from "../../../test/test-utils";
import { StatCard } from "./StatCard";

/**
 * StatCard — `.el-kpi` (design/CODE-MAP.md 2.9): qiymat, delta yo'nalishi × `goodWhen`,
 * yuklanish skeleti va bosiladigan karta semantikasi.
 */

const classesOf = (element: Element | null) => (element?.getAttribute("class") ?? "").split(/\s+/);
const deltaOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-stat-delta]");

describe("StatCard — asosiy ko'rinish", () => {
  it("yorliq, qiymat va birlik (.el-kpi-value / .el-kpi-unit)", () => {
    const { container } = renderWithProviders(<StatCard label="Jami daromad" value="48,6 mln" unit="so'm" />);
    expect(screen.getByText("Jami daromad")).toHaveClass("text-[13px]", "font-semibold", "text-text-muted");
    const value = container.querySelector("[data-stat-value]");
    // Ekran o'quvchi uchun qiymat va birlik orasida bo'sh joy bor.
    expect(value).toHaveTextContent("48,6 mln so'm");
    expect(classesOf(value)).toEqual(
      expect.arrayContaining(["text-[28px]", "leading-9", "font-bold", "proportional-nums", "whitespace-nowrap", "text-text"]),
    );
    expect(classesOf(screen.getByText("so'm"))).toEqual(expect.arrayContaining(["ml-1", "text-sm", "text-text-muted"]));
  });

  it("yuza: .el-kpi tokenlari, telefonda ixcham chekka", () => {
    renderWithProviders(<StatCard label="Sof foyda" value="4,9" data-testid="kpi" className="h-full" />);
    const card = screen.getByTestId("kpi");
    expect(card.tagName).toBe("DIV");
    expect(classesOf(card)).toEqual(
      expect.arrayContaining(["bg-surface", "border-border", "rounded-[14px]", "px-5", "py-4", "max-md:px-4", "h-full"]),
    );
    expect(card).not.toHaveAttribute("aria-busy");
  });

  it("ikonka — neytral chip (bg-sunken text-text-muted), telefonda yashirin, aria-hidden", () => {
    const { container } = renderWithProviders(<StatCard label="Jami daromad" value="48,6" icon={Banknote} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(classesOf(svg?.parentElement ?? null)).toEqual(
      expect.arrayContaining(["size-9", "bg-sunken", "text-text-muted", "max-md:hidden"]),
    );
  });

  it("ikonkasiz — svg yo'q", () => {
    const { container } = renderWithProviders(<StatCard label="Sof foyda" value="4,9" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("izoh (hint) .el-kpi-meta qatorida", () => {
    renderWithProviders(<StatCard label="Sof foyda" value="4,9" hint="kechaga nisbatan" />);
    const hint = screen.getByText("kechaga nisbatan");
    expect(classesOf(hint.parentElement)).toContain("flex-wrap");
    expect(classesOf(hint.closest(".text-xs"))).toEqual(expect.arrayContaining(["text-text-muted", "leading-[18px]"]));
  });

  it("valueTone — ishorali pul rangi (manfiy foyda)", () => {
    const { container } = renderWithProviders(<StatCard label="Sof foyda" value="−1,2 mln" valueTone="danger" />);
    const value = container.querySelector("[data-stat-value]");
    expect(classesOf(value)).toContain("text-danger-fg");
    expect(classesOf(value)).not.toContain("text-text");
  });
});

describe("StatCard — delta: yo'nalish × goodWhen", () => {
  it.each([
    // [delta, goodWhen, matn, yo'nalish, sifat, klass]
    [6.4, "up", "+6,4%", "up", "good", "bg-success-soft"],
    [-3, "up", "−3%", "down", "bad", "bg-danger-soft"],
    // Bekor qilinganlar o'sishi — yomon: o'q tepaga, lekin qizil.
    [12.5, "down", "+12,5%", "up", "bad", "bg-danger-soft"],
    // Yo'qotilgan daromad kamaydi — yaxshi: o'q pastga, lekin yashil.
    [-10.7, "down", "−10,7%", "down", "good", "bg-success-soft"],
    [5, "none", "+5%", "up", "neutral", "bg-sunken"],
  ] as const)("delta=%s goodWhen=%s → %s (%s, %s)", (delta, goodWhen, text, direction, quality, toneClass) => {
    const { container } = renderWithProviders(
      <StatCard label="Ko'rsatkich" value="1" delta={delta} goodWhen={goodWhen} />,
    );
    const badge = deltaOf(container);
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveAttribute("data-direction", direction);
    expect(badge).toHaveAttribute("data-quality", quality);
    expect(classesOf(badge)).toEqual(expect.arrayContaining([toneClass, "h-[22px]", "rounded-md", "text-xs", "font-bold"]));
    // Yo'nalish ikonkasi (14px, aria-hidden) — rang yolg'iz ma'no bermaydi.
    expect(badge?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("goodWhen sukut — up", () => {
    const { container } = renderWithProviders(<StatCard label="Ko'rsatkich" value="1" delta={-2} />);
    expect(deltaOf(container)).toHaveAttribute("data-quality", "bad");
  });

  it.each([0, 0.04, -0.04])("delta=%s → «0%», o'qsiz va neytral", (delta) => {
    const { container } = renderWithProviders(<StatCard label="Ko'rsatkich" value="1" delta={delta} />);
    const badge = deltaOf(container);
    expect(badge).toHaveTextContent(/^0%$/);
    expect(badge).toHaveAttribute("data-direction", "flat");
    expect(badge).toHaveAttribute("data-quality", "neutral");
    expect(badge?.querySelector("svg")).toBeNull();
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])("delta=%s → delta chizilmaydi", (delta) => {
    const { container } = renderWithProviders(<StatCard label="Ko'rsatkich" value="1" delta={delta} />);
    expect(deltaOf(container)).toBeNull();
  });

  it("deltaText — matn almashadi, yo'nalish/rang delta'dan", () => {
    const { container } = renderWithProviders(
      <StatCard label="Yetkazish vaqti" value="5 soat" delta={-25} deltaText="−25 daq" goodWhen="down" />,
    );
    const badge = deltaOf(container);
    expect(badge).toHaveTextContent(/^−25 daq$/);
    expect(badge).toHaveAttribute("data-quality", "good");
  });

  it("foiz locale bo'yicha (en — nuqta)", async () => {
    await i18n.changeLanguage("en");
    try {
      const { container } = renderWithProviders(<StatCard label="Revenue" value="1" delta={6.4} />);
      expect(deltaOf(container)).toHaveTextContent("+6.4%");
    } finally {
      await i18n.changeLanguage("uz");
    }
  });
});

describe("StatCard — yuklanish", () => {
  it("aria-busy, qiymat va delta yo'q; yorliq, ikonka va izoh joyida (tizim-loading)", () => {
    const { container } = renderWithProviders(
      <StatCard
        label="Sof foyda"
        value="4,9"
        unit="so'm"
        icon={Banknote}
        delta={5}
        hint="Market tarifi − kuryer tarifi"
        loading
        data-testid="kpi"
      >
        <span>sparkline</span>
      </StatCard>,
    );
    const card = screen.getByTestId("kpi");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("[data-stat-value]")).toBeNull();
    expect(screen.queryByText("4,9")).toBeNull();
    expect(deltaOf(container)).toBeNull();
    expect(screen.queryByText("sparkline")).toBeNull();

    expect(screen.getByText("Sof foyda")).toBeInTheDocument();
    expect(screen.getByText("Market tarifi − kuryer tarifi")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();

    const skeleton = container.querySelector("[data-stat-skeleton] > span");
    expect(classesOf(skeleton)).toEqual(expect.arrayContaining(["bg-border", "motion-safe:animate-pulse", "h-7", "w-32"]));
    // Harakatni kamaytirish sozlamasida pulsatsiya yo'q: animatsiya faqat motion-safe.
    expect(classesOf(skeleton)).not.toContain("animate-pulse");
    expect(screen.getByText("Yuklanmoqda…")).toHaveClass("sr-only");
  });
});

describe("StatCard — bosiladigan karta", () => {
  it("href → havola (butun karta), hover/fokus, «›» belgisi", () => {
    renderWithProviders(
      <StatCard label="Kassadagi summa" value="24,6 mln" unit="so'm" hint="Asosiy kassa · smena ochiq" href="/payments" />,
    );
    const link = screen.getByRole("link", { name: /Kassadagi summa/ });
    expect(link).toHaveAttribute("href", "/payments");
    expect(link).toHaveAccessibleName(/24,6 mln so'm/);
    expect(classesOf(link)).toEqual(expect.arrayContaining(["hover:bg-row-hover", "cursor-pointer", "transition-[background-color]"]));
    // Global :focus-visible halqasi o'chirilmagan.
    expect(link.className).not.toMatch(/outline-none/);
    const chevron = link.querySelector("svg");
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(classesOf(chevron)).toEqual(expect.arrayContaining(["ml-auto", "shrink-0"]));
    // «›» o'raladigan guruhdan tashqarida — izoh bilan bir qatorda qoladi.
    expect(classesOf(chevron?.parentElement ?? null)).not.toContain("flex-wrap");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("onClick → <button type=button>, bosish ishlaydi", () => {
    const onClick = vi.fn();
    renderWithProviders(<StatCard label="Bekor qilingan" value="25" unit="ta" onClick={onClick} />);
    const button = screen.getByRole("button", { name: /Bekor qilingan/ });
    expect(button).toHaveAttribute("type", "button");
    expect(classesOf(button)).toEqual(expect.arrayContaining(["w-full", "text-left", "hover:bg-row-hover"]));
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("oddiy karta — havola ham, tugma ham emas", () => {
    renderWithProviders(<StatCard label="Sof foyda" value="4,9" icon={CircleX} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("StatCard — ref (boshqa primitivlar kabi)", () => {
  it.each([
    ["href", { href: "/payments" }, "A"],
    ["onClick", { onClick: () => undefined }, "BUTTON"],
    ["oddiy", {}, "DIV"],
  ] as const)("%s → ref ildiz elementga (%s)", (_mode, extra, tagName) => {
    const ref = createRef<HTMLElement>();
    renderWithProviders(<StatCard ref={ref} label="Kassa" value="1" data-testid="kpi" {...extra} />);
    expect(ref.current).toBe(screen.getByTestId("kpi"));
    expect(ref.current?.tagName).toBe(tagName);
  });

  it("bosiladigan karta nomi bo'shliqlar bilan: yorliq, qiymat + birlik, delta, izoh", () => {
    renderWithProviders(
      <StatCard label="Bekor qilingan" value="25" unit="ta" delta={12.5} goodWhen="down" hint="kechaga nisbatan" href="/orders" />,
    );
    expect(screen.getByRole("link")).toHaveAccessibleName("Bekor qilingan 25 ta +12,5% kechaga nisbatan");
  });
});
