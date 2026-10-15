import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { ArrowDownLeft } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge, type BadgeVariant } from "./Badge";
import { TONES, TONE_FG, TONE_SOFT, TONE_SOLID } from "./tone";

/**
 * BADGE — maketdagi `.el-badge` (helmet.html) bilan aynan: 24px, 0 8px, radius 6,
 * 12px/1 · 600, bir qatorda; ton klasslari faqat `tone.ts` dan (kontrast
 * `tone.test.ts` da ikkala mavzuda tekshirilgan).
 */

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);
const badge = () => screen.getByText("Yorliq").closest("span") as HTMLElement;

describe("Badge — asosiy ko'rinish (.el-badge)", () => {
  it("sukut: md, neutral, soft — maket o'lchamlari", () => {
    render(<Badge>Yorliq</Badge>);
    const el = badge();
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass(
      "inline-flex",
      "items-center",
      "whitespace-nowrap",
      "rounded-md",
      "text-xs",
      "font-semibold",
      "leading-none",
      "h-6",
      "gap-1.5",
      "px-2",
    );
    // `.el-tone-neutral`: sunken fon + text-muted + border rangidagi ichki chegara.
    expect(el).toHaveClass("bg-sunken", "text-text-muted", "ring-1", "ring-inset", "ring-border");
  });

  it("yorliq matni chiziladi (faqat rang bilan ma'no berilmaydi)", () => {
    render(<Badge tone="success">Faol</Badge>);
    expect(screen.getByText("Faol")).toBeInTheDocument();
  });

  it("sm — 20px, zichroq oraliq", () => {
    render(<Badge size="sm">Yorliq</Badge>);
    expect(badge()).toHaveClass("h-5", "gap-1", "px-1.5", "text-xs");
    expect(badge()).not.toHaveClass("h-6", "px-2");
  });

  it("eski uslub yo'q: dark: jufti, rang oilasi, 12px dan kichik matn", () => {
    const { container } = render(
      <>
        {TONES.map((tone) =>
          (["soft", "outline", "solid"] as const).map((variant) => (
            <Badge key={`${tone}-${variant}`} tone={tone} variant={variant} dot>
              {tone}
            </Badge>
          )),
        )}
      </>,
    );
    const all = Array.from(container.querySelectorAll("span")).flatMap((el) => classesOf(el.className));
    expect(all.some((c) => c.startsWith("dark:"))).toBe(false);
    expect(all.some((c) => /^(bg|text|ring)-(white|black|gray|slate|blue|red|green|amber|purple)/.test(c))).toBe(false);
    expect(all.some((c) => /text-\[(?:[0-9]|1[01])px\]/.test(c))).toBe(false);
  });
});

describe("Badge — ton × ko'rinish", () => {
  it.each(TONES)("%s · soft — TONE_SOFT", (tone) => {
    render(<Badge tone={tone}>Yorliq</Badge>);
    expect(badge()).toHaveClass(...classesOf(TONE_SOFT[tone]));
    if (tone === "neutral") expect(badge()).toHaveClass("ring-border");
    else expect(badge()).not.toHaveClass("ring-1");
  });

  it.each(TONES)("%s · outline — shaffof fon, matn rangidagi halqa", (tone) => {
    render(
      <Badge tone={tone} variant="outline">
        Yorliq
      </Badge>,
    );
    const el = badge();
    expect(el).toHaveClass(...classesOf(TONE_FG[tone]), "bg-transparent", "ring-1", "ring-inset", "ring-current");
    expect(classesOf(el.className).some((c) => c.endsWith("-soft") || c === "bg-sunken")).toBe(false);
  });

  it.each(TONES)("%s · solid — TONE_SOLID", (tone) => {
    render(
      <Badge tone={tone} variant="solid">
        Yorliq
      </Badge>,
    );
    expect(badge()).toHaveClass(...classesOf(TONE_SOLID[tone]));
  });

  it("solid: har tonda to'liq fon, yumshoq fon emas (tone.ts)", () => {
    for (const tone of TONES) {
      const { unmount } = render(
        <Badge tone={tone} variant="solid">
          Yorliq
        </Badge>,
      );
      const softBg = classesOf(TONE_SOFT[tone]).filter((c) => c.startsWith("bg-"));
      expect(badge()).not.toHaveClass(...softBg);
      unmount();
    }
  });

  it("har ko'rinishda bir xil o'lcham va tipografiya", () => {
    for (const variant of ["soft", "outline", "solid"] as BadgeVariant[]) {
      const { unmount } = render(
        <Badge tone="warning" variant={variant}>
          Yorliq
        </Badge>,
      );
      expect(badge()).toHaveClass("h-6", "px-2", "rounded-md", "text-xs", "font-semibold");
      unmount();
    }
  });
});

describe("Badge — nuqta va ikonka", () => {
  it("dot — 6px dumaloq, matn rangida, aria-hidden, yorliqdan oldin", () => {
    render(
      <Badge tone="info" dot>
        Yorliq
      </Badge>,
    );
    const dot = badge().querySelector("[data-badge-dot]") as HTMLElement;
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("size-1.5", "shrink-0", "rounded-full", "bg-current");
    expect(badge().firstChild).toBe(dot);
  });

  it("dot berilmasa — nuqta yo'q", () => {
    render(<Badge tone="info">Yorliq</Badge>);
    expect(badge().querySelector("[data-badge-dot]")).toBeNull();
  });

  it("icon — 14px lucide, aria-hidden, chapda; nuqta o'rnini oladi", () => {
    render(
      <Badge icon={ArrowDownLeft} dot>
        Yorliq
      </Badge>,
    );
    const svg = badge().querySelector("svg") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("width", "14");
    expect(svg).toHaveAttribute("height", "14");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("lucide-arrow-down-left", "shrink-0");
    expect(badge().firstChild).toBe(svg);
    expect(badge().querySelector("[data-badge-dot]")).toBeNull();
  });
});

describe("Badge — o'tkaziladigan xususiyatlar", () => {
  it("className qo'shiladi, qolgan atributlar va ref span'ga tushadi", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <Badge ref={ref} className="self-start" title="Izoh" data-testid="b" tone="danger">
        Yorliq
      </Badge>,
    );
    const el = screen.getByTestId("b");
    expect(el).toHaveClass("self-start", "bg-danger-soft", "text-danger-fg");
    expect(el).toHaveAttribute("title", "Izoh");
    expect(ref.current).toBe(el);
  });
});
