import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniMarkdown } from "./MiniMarkdown";

describe("MiniMarkdown — AI javobi (faqat React tugunlari)", () => {
  it("qalin, sarlavha, ro'yxat va jadval (`DataTable`)", () => {
    render(
      <MiniMarkdown
        source={"Kassaga **286,4 mln so'm** tushdi.\n\n### Eng ko'p qarzi bor kuryerlar\n\n- Toshkent HQ\n- Samarqand\n\n| Kuryer | Qarz |\n|---|---:|\n| Jasur Tursunov | 2 840 000 so'm |"}
      />,
    );
    expect(screen.getByText("286,4 mln so'm").tagName).toBe("STRONG");
    expect(screen.getByRole("heading", { level: 3, name: "Eng ko'p qarzi bor kuryerlar" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Toshkent HQ", "Samarqand"]);
    const table = screen.getByRole("table", { name: "Kuryer, Qarz" });
    expect(within(table).getByRole("columnheader", { name: "Kuryer" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "2 840 000 so'm" })).toBeInTheDocument();
  });

  it("HTML va havola bajarilmaydi — matn bo'lib chiqadi", () => {
    const { container } = render(<MiniMarkdown source={"<img src=x onerror=alert(1)> [bosing](javascript:alert(1))"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)> bosing");
  });

  it("matn 14 px, sarlavha `.el-h3`; `caret` — kursor faqat oxirgi paragraf / ro'yxat bandi oxirida", () => {
    const { container, rerender } = render(<MiniMarkdown source={"Birinchi.\n\n### Sarlavha\n\nOxirgi paragraf"} caret />);
    expect(container.firstElementChild).toHaveClass("text-sm");
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("text-sm", "font-semibold");
    const carets = container.querySelectorAll("[data-md-caret]");
    expect(carets).toHaveLength(1);
    expect(carets[0]).toHaveAttribute("aria-hidden", "true");
    expect(carets[0].parentElement?.textContent).toBe("Oxirgi paragraf");

    rerender(<MiniMarkdown source={"- bir\n- ikki"} caret />);
    expect(container.querySelector("[data-md-caret]")?.parentElement?.textContent).toBe("ikki");

    rerender(<MiniMarkdown source={"- bir\n- ikki"} />);
    expect(container.querySelector("[data-md-caret]")).toBeNull();
  });
});
