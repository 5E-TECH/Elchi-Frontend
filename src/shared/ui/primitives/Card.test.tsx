import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Card } from "./Card";

/**
 * Card — `.el-card` / `.el-card-head` / `.el-card-pad` / `.el-card-foot` (design/CODE-MAP.md 2.4):
 * sarlavha slotlari, chekka variantlari, ichki karta (2 qavat) va semantika.
 */

const classesOf = (element: Element | null) => (element?.getAttribute("class") ?? "").split(/\s+/);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Card — yuza", () => {
  it("sukut: section, tokenli yuza, soyasiz va gradientsiz", () => {
    render(<Card data-testid="card">Matn</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName).toBe("SECTION");
    expect(card).toHaveAttribute("data-card-variant", "default");
    expect(classesOf(card)).toEqual(
      expect.arrayContaining(["rounded-[14px]", "border", "border-border", "bg-surface", "min-w-0"]),
    );
    expect(card.className).not.toMatch(/shadow|gradient|bg-linear|el-card/);
  });

  it("as: div va article", () => {
    const { rerender } = render(<Card as="div" data-testid="card" />);
    expect(screen.getByTestId("card").tagName).toBe("DIV");
    rerender(<Card as="article" data-testid="card" />);
    expect(screen.getByTestId("card").tagName).toBe("ARTICLE");
  });

  it("className qo'shiladi va qolgan atributlar ildizga o'tadi", () => {
    render(<Card data-testid="card" id="pay" className="h-full" aria-describedby="x" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("id", "pay");
    expect(card).toHaveAttribute("aria-describedby", "x");
    expect(classesOf(card)).toEqual(expect.arrayContaining(["h-full", "bg-surface"]));
  });
});

describe("Card — sarlavha slotlari", () => {
  it("title (h2 sukut), description va actions; section sarlavha bilan nomlanadi", () => {
    render(
      <Card
        title="Mijoz"
        description="2 ta yozuv — eng yangisi tepada"
        actions={<button type="button">Tahrirlash</button>}
        titleAddon={<span>2 ta</span>}
      >
        Tana
      </Card>,
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Mijoz" });
    expect(classesOf(heading)).toEqual(expect.arrayContaining(["text-base", "font-bold", "text-text"]));
    // Badge sarlavha ichiga kirmaydi (nomi faqat «Mijoz»).
    expect(heading).toHaveTextContent(/^Mijoz$/);
    expect(screen.getByText("2 ta")).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Mijoz" });
    expect(region).toHaveAttribute("aria-labelledby", heading.id);

    const description = screen.getByText("2 ta yozuv — eng yangisi tepada");
    expect(classesOf(description)).toEqual(expect.arrayContaining(["text-[13px]", "text-text-muted"]));
    expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument();
  });

  it("titleAs — faqat daraja; ko'rinish o'zgarmaydi (maketda `h3.el-h2`, `h4.el-h2` bor)", () => {
    render(
      <>
        <Card title="Kassa" titleAs="h3" />
        <Card title="Filial" titleAs="h4" />
      </>,
    );
    for (const heading of [
      screen.getByRole("heading", { level: 3, name: "Kassa" }),
      screen.getByRole("heading", { level: 4, name: "Filial" }),
    ]) {
      expect(classesOf(heading)).toEqual(expect.arrayContaining(["text-base", "font-bold"]));
    }
  });

  it("titleSize=sm — 14/20 · 600 (`.el-h3`), daraja sukut h2", () => {
    render(<Card title="Kassa" titleSize="sm" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Kassa" });
    expect(classesOf(heading)).toEqual(expect.arrayContaining(["text-sm", "font-semibold"]));
    expect(classesOf(heading)).not.toContain("text-base");
  });

  it("divided (sukut): sarlavha ostida chiziq (.el-card-head), tana alohida chekka bilan", () => {
    render(
      <Card title="Manzil" data-testid="card">
        <p>Tana</p>
      </Card>,
    );
    const head = screen.getByRole("heading", { name: "Manzil" }).closest("div.border-b");
    expect(head).not.toBeNull();
    expect(classesOf(head)).toEqual(expect.arrayContaining(["border-border", "px-5", "py-4", "items-center", "flex-wrap"]));
    // Maket `.el-card-head` (nowrap): amal o'ngda qoladi, sarlavha/izoh o'z ichida o'raladi. Sarlavha
    // bloki asosi 0, lekin kamida 96px — amal shundan ko'p joy olsagina (keng segment) pastga o'tadi.
    expect(classesOf(head?.firstElementChild ?? null)).toEqual(
      expect.arrayContaining(["flex-[1_1_0%]", "min-w-[min(100%,6rem)]"]),
    );
    expect(classesOf(head?.firstElementChild ?? null)).not.toContain("flex-auto");
    const body = screen.getByText("Tana").parentElement;
    expect(classesOf(body)).toContain("p-5");
    // Maket: `.el-card-pad` va `.el-card-head` telefonda ham 20px.
    expect(body?.className).not.toMatch(/max-md:p/);
    expect(head?.className).not.toMatch(/max-md:p/);
    expect(classesOf(screen.getByTestId("card"))).not.toContain("p-5");
  });

  it("divided={false}: chiziqsiz sarlavha (.el-chart-head), chekka butun kartada", () => {
    render(
      <Card title="Buyurtmalar holati" divided={false} data-testid="card">
        <p>Tana</p>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(classesOf(card)).toEqual(expect.arrayContaining(["p-5", "max-md:p-4", "gap-4", "max-md:gap-3.5"]));
    expect(card.querySelector(".border-b")).toBeNull();
    // `.el-chart-titles` — flex: 1 1 200px.
    expect(classesOf(screen.getByRole("heading", { name: "Buyurtmalar holati" }).closest(".flex-col"))).toContain(
      "flex-[1_1_200px]",
    );
    expect(classesOf(screen.getByText("Tana").parentElement)).not.toContain("p-5");
  });

  it("sarlavhasiz: header chizilmaydi, aria-labelledby yo'q", () => {
    render(<Card data-testid="card">Tana</Card>);
    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("aria-labelledby");
    expect(card.querySelector("h2, h3, .border-b")).toBeNull();
  });

  it("as=div — aria-labelledby qo'yilmaydi; tayyor aria-label ustun", () => {
    const { rerender } = render(<Card as="div" title="Mijoz" data-testid="card" />);
    expect(screen.getByTestId("card")).not.toHaveAttribute("aria-labelledby");
    rerender(<Card title="Mijoz" aria-label="Mijoz kartasi" data-testid="card" />);
    expect(screen.getByTestId("card")).not.toHaveAttribute("aria-labelledby");
    expect(screen.getByRole("region", { name: "Mijoz kartasi" })).toBeInTheDocument();
  });

  it("footer — .el-card-foot (border-t)", () => {
    render(<Card footer={<span>Barcha 14 hudud</span>}>Tana</Card>);
    const foot = screen.getByText("Barcha 14 hudud").parentElement;
    expect(classesOf(foot)).toEqual(expect.arrayContaining(["border-t", "border-border", "px-5", "py-3"]));
  });
});

describe("Card — chekka (padding)", () => {
  it.each([
    ["lg", ["p-5"]],
    ["md", ["px-5", "py-4"]],
  ] as const)("padding=%s", (padding, expected) => {
    render(<Card padding={padding}>Tana</Card>);
    expect(classesOf(screen.getByText("Tana").closest("div"))).toEqual(expect.arrayContaining([...expected]));
  });

  it("padding=none — tana chekkasiz, sarlavha o'z chekkasini saqlaydi", () => {
    render(
      <Card padding="none" title="Jadval">
        <table>
          <tbody>
            <tr>
              <td>Qator</td>
            </tr>
          </tbody>
        </table>
      </Card>,
    );
    const body = screen.getByRole("table").parentElement;
    expect(body?.className).not.toMatch(/\bp[xy]?-\d/);
    const head = screen.getByRole("heading", { name: "Jadval" }).closest("div.border-b");
    expect(classesOf(head)).toEqual(expect.arrayContaining(["px-5", "py-4"]));
  });
});

describe("Card — chiziqsiz sarlavha + padding=none", () => {
  it("tana chetma-chet, sarlavha va pastki qism yon chekkasini saqlaydi (hujjatdagi va'da)", () => {
    render(
      <Card
        divided={false}
        padding="none"
        title="Filiallar"
        actions={<button type="button">Jadval</button>}
        footer={<span>Barchasi</span>}
        data-testid="card"
      >
        <table>
          <tbody>
            <tr>
              <td>Qator</td>
            </tr>
          </tbody>
        </table>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(classesOf(card)).toEqual(expect.arrayContaining(["pt-5", "max-md:pt-4", "gap-4"]));
    expect(card.className).not.toMatch(/(^|\s)(p|px|pb)-\d/);

    const head = screen.getByRole("heading", { name: "Filiallar" }).closest(".justify-between");
    expect(classesOf(head)).toEqual(expect.arrayContaining(["px-5", "max-md:px-4"]));

    const body = screen.getByRole("table").parentElement;
    expect(body?.className).not.toMatch(/\bp[xy]?-\d/);

    const foot = screen.getByText("Barchasi").parentElement;
    expect(classesOf(foot)).toEqual(expect.arrayContaining(["border-t", "pt-4", "px-5", "pb-5", "max-md:pb-4"]));
  });

  it("chiziqsiz sarlavha + lg: chekka faqat ildizda, sarlavhaga qo'shimcha yon chekka yo'q", () => {
    render(<Card divided={false} title="Grafik" data-testid="card" />);
    const head = screen.getByRole("heading", { name: "Grafik" }).closest(".justify-between");
    expect(classesOf(head)).not.toContain("px-5");
    expect(classesOf(screen.getByTestId("card"))).not.toContain("pt-5");
  });
});

describe("Card — ichki karta (ko'pi bilan 2 qavat)", () => {
  it("karta ichidagi karta avtomatik inset: bg-sunken, chegarasiz, ixcham chekka", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <Card data-testid="outer">
        <Card data-testid="inner">Ichki</Card>
      </Card>,
    );
    const inner = screen.getByTestId("inner");
    expect(inner).toHaveAttribute("data-card-variant", "inset");
    expect(classesOf(inner)).toEqual(expect.arrayContaining(["bg-sunken", "rounded-xl"]));
    expect(classesOf(inner)).not.toContain("border");
    expect(classesOf(inner)).not.toContain("bg-surface");
    expect(classesOf(screen.getByText("Ichki").closest("div"))).toEqual(expect.arrayContaining(["px-4", "py-3.5"]));
    expect(warn).not.toHaveBeenCalled();
  });

  it("variant=inset sahifada ham ishlatiladi", () => {
    render(<Card variant="inset" data-testid="card" />);
    expect(screen.getByTestId("card")).toHaveAttribute("data-card-variant", "inset");
  });

  it("uchinchi qavat — dev ogohlantirish", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <Card>
        <Card>
          <Card>Uchinchi</Card>
        </Card>
      </Card>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("2 qavatdan chuqur"));
  });

  it("karta ichida variant=default — dev ogohlantirish", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <Card>
        <Card variant="default">Ichki</Card>
      </Card>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("karta ichida karta"));
  });
});
