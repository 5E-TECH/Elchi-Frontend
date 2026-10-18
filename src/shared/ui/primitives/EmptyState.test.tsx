import { render, screen } from "@testing-library/react";
import { Plus, SearchX, ShoppingBag } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/** EmptyState — `.el-empty` / `.el-empty-icon` / `.el-empty-title` / `.el-empty-text`, `.el-chart-empty` (CODE-MAP 2.7 / 2.9). */
describe("EmptyState", () => {
  it("karta: doiradagi lucide ikonka (aria-hidden), sarlavha, izoh, bitta tugma", () => {
    const { container } = render(
      <EmptyState
        icon={ShoppingBag}
        title="Hali buyurtma yo'q"
        description="Buyurtmalar shu ro'yxatda paydo bo'ladi."
        action={<Button leftIcon={Plus}>Buyurtma yaratish</Button>}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-state-size", "card");
    expect(root).toHaveClass("flex", "flex-col", "items-center", "gap-2", "px-6", "py-12", "text-center");
    expect(root).not.toHaveClass("border");

    const icon = root.querySelector("[data-state-icon]");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("size-12", "rounded-full", "bg-sunken", "text-text-muted");
    expect(icon?.querySelector("svg")).toHaveAttribute("width", "22");

    expect(screen.getByText("Hali buyurtma yo'q")).toHaveClass("text-base", "font-bold", "text-text");
    expect(screen.getByText("Buyurtmalar shu ro'yxatda paydo bo'ladi.")).toHaveClass("text-sm", "text-text-muted");
    expect(screen.getByRole("button", { name: "Buyurtma yaratish" }).parentElement).toHaveClass("mt-2");
  });

  it("sukut ikonka — Inbox; element ikonka ham qabul qilinadi; emoji yo'q", () => {
    const { container, rerender } = render(<EmptyState title="Bo'sh" />);
    expect(container.querySelector("svg.lucide-inbox")).not.toBeNull();
    rerender(<EmptyState title="Bo'sh" icon={<SearchX size={28} />} />);
    expect(container.querySelector("svg.lucide-search-x")).not.toBeNull();
  });

  it("sahifa: 56 px ikonka, ustki yozuv, h2 sarlavha (24 px), tugmalar teng enli", () => {
    render(
      <EmptyState
        size="page"
        overline="Xato kodi 404"
        title="Bu sahifa topilmadi"
        action={
          <>
            <Button>Bosh sahifaga qaytish</Button>
            <Button variant="secondary">Orqaga</Button>
          </>
        }
      />,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Bu sahifa topilmadi" });
    expect(heading).toHaveClass("text-2xl", "font-bold", "max-md:text-xl");
    expect(screen.getByText("Xato kodi 404")).toHaveClass("uppercase", "text-xs");
    const root = heading.closest("[data-state-size]") as HTMLElement;
    expect(root.querySelector("[data-state-icon]")).toHaveClass("size-14");
    expect(screen.getByRole("button", { name: "Orqaga" }).parentElement?.className).toContain("[&>*]:flex-[1_1_180px]");
  });

  it("grafik ichida: kulrang yuza, kamida 200 px; danger ton; framed", () => {
    const { container, rerender } = render(<EmptyState size="chart" title="Bu davrda buyurtma yo'q" />);
    expect(container.firstElementChild).toHaveClass("min-h-[200px]", "rounded-xl", "bg-sunken");
    rerender(<EmptyState tone="danger" framed title="Xato" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("rounded-[14px]", "border", "border-border", "bg-surface");
    expect(root.querySelector("[data-state-icon]")).toHaveClass("bg-danger-soft", "text-danger-fg");
  });

  it("ixcham (inline): gorizontal, balandlik cho'zilmaydi, doira kulrang yuzada ko'rinadi", () => {
    const { container } = render(<EmptyState size="inline" title="Bu davrda reyting uchun buyurtma yo'q" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("flex", "items-center", "bg-sunken", "px-4", "py-3");
    expect(root).not.toHaveClass("flex-col");
    expect(root.className).not.toMatch(/min-h-/);
    expect(root.querySelector("[data-state-icon]")).toHaveClass("size-10", "bg-surface");
    expect(screen.getByText("Bu davrda reyting uchun buyurtma yo'q")).toHaveClass("text-sm", "font-semibold");
  });
});
