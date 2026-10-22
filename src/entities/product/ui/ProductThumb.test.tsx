import { fireEvent, render } from "@testing-library/react";
import { ShoppingBag } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ProductThumb } from "./ProductThumb";

const thumb = (container: HTMLElement) => container.querySelector("[data-product-thumb]") as HTMLElement;

describe("ProductThumb (umumiy, CS-B)", () => {
  it("rasm bo'lsa — rasm (bezak, `alt` bo'sh), sukut 36 px chegarasiz", () => {
    const { container } = render(<ProductThumb imageUrl="https://cdn.example/a.png" />);
    const box = thumb(container);
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("data-product-thumb", "image");
    expect(box).toHaveClass("size-9");
    expect(box).not.toHaveClass("border");
    expect(box.querySelector("img")).toHaveAttribute("alt", "");
    expect(box.querySelector("img")).toHaveAttribute("src", "https://cdn.example/a.png");
  });

  it("rasm yuklanmasa yoki bo'lmasa — ikonka; `lg` — 40 px chegarali", () => {
    const { container, rerender } = render(<ProductThumb size="lg" imageUrl="https://cdn.example/broken.png" />);
    fireEvent.error(container.querySelector("img")!);
    expect(thumb(container)).toHaveAttribute("data-product-thumb", "icon");
    expect(thumb(container)).toHaveClass("size-10", "border", "border-border");

    rerender(<ProductThumb size="lg" imageUrl="  " fallbackIcon={ShoppingBag} />);
    expect(thumb(container)).toHaveAttribute("data-product-thumb", "icon");
    expect(thumb(container).querySelector("svg")).toHaveClass("lucide-shopping-bag");
  });

  it("boshqa rasm kelsa — avvalgi xato unutiladi", () => {
    const { container, rerender } = render(<ProductThumb imageUrl="https://cdn.example/broken.png" />);
    fireEvent.error(container.querySelector("img")!);
    rerender(<ProductThumb imageUrl="https://cdn.example/b.png" />);
    expect(thumb(container)).toHaveAttribute("data-product-thumb", "image");
  });
});
