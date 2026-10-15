import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";
import { TONES, TONE_SOFT } from "./tone";

/** Holat = rang + so'z + (nuqta yoki ikonka). Hech qachon faqat rang emas. */

const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

describe("StatusBadge", () => {
  it.each(TONES)("%s — so'z va nuqta bilan (maket: el-badge-dot)", (tone) => {
    render(<StatusBadge tone={tone} label="Holat" />);
    const el = screen.getByText("Holat").closest("span") as HTMLElement;
    expect(el).toHaveClass(...classesOf(TONE_SOFT[tone]), "h-6", "px-2", "text-xs", "font-semibold");
    expect(el.querySelector("[data-badge-dot]")).not.toBeNull();
    expect(el.querySelector("svg")).toBeNull();
  });

  it("ikonka berilsa — nuqta o'rniga ikonka", () => {
    render(<StatusBadge tone="warning" label="Kutilmoqda" icon={Clock} />);
    const el = screen.getByText("Kutilmoqda").closest("span") as HTMLElement;
    expect(el.querySelector("svg.lucide-clock")).not.toBeNull();
    expect(el.querySelector("[data-badge-dot]")).toBeNull();
  });

  it("ko'rinish va o'lcham o'tkaziladi («Bekor — jo'natilgan»: danger + chegarali)", () => {
    render(<StatusBadge tone="danger" variant="outline" size="sm" label="Bekor — jo'natilgan" data-testid="s" />);
    const el = screen.getByTestId("s");
    expect(el).toHaveClass("text-danger-fg", "bg-transparent", "ring-current", "h-5");
    expect(el).toHaveTextContent("Bekor — jo'natilgan");
  });
});
