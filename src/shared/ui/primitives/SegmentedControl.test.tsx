import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartColumn, List } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./SegmentedControl";

/**
 * SegmentedControl: radiogroup semantikasi (radio + aria-checked), roving tabindex,
 * ← → ↑ ↓ Home End bilan tanlash, o'lchamlar va telefonda to'liq en / 44 px.
 */

type Period = "today" | "thisWeek" | "thisMonth" | "allTime";

const OPTIONS: SegmentedOption<Period>[] = [
  { value: "today", label: "Bugun" },
  { value: "thisWeek", label: "Bu hafta" },
  { value: "thisMonth", label: "Bu oy", disabled: true },
  { value: "allTime", label: "Barchasi" },
];

const Controlled = ({
  initial = "today",
  onChange,
  ...props
}: Partial<SegmentedControlProps<Period>> & { initial?: Period; onChange?: (value: Period) => void }) => {
  const [value, setValue] = useState<Period>(initial);
  return (
    <SegmentedControl
      ariaLabel="Davr"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
};

const radio = (name: string) => screen.getByRole("radio", { name });

describe("SegmentedControl — semantika", () => {
  it("radiogroup nomi bilan, variantlar radio, faqat tanlangani aria-checked", () => {
    render(<Controlled initial="thisWeek" />);
    expect(screen.getByRole("radiogroup", { name: "Davr" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((el) => el.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false"]);
    expect(radio("Bu hafta")).toBeChecked();
  });

  it("roving tabindex: guruhda bitta Tab to'xtash joyi — tanlangan variant", () => {
    render(<Controlled initial="allTime" />);
    expect(screen.getAllByRole("radio").map((el) => el.tabIndex)).toEqual([-1, -1, -1, 0]);
  });

  it("bosilganda tanlaydi; tanlanganini yoki o'chirilganini bosish chaqirmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(radio("Bugun"));
    await user.click(radio("Bu oy"));
    expect(onChange).not.toHaveBeenCalled();
    expect(radio("Bu oy")).toBeDisabled();
    await user.click(radio("Barchasi"));
    expect(onChange).toHaveBeenCalledWith("allTime");
    expect(radio("Barchasi")).toBeChecked();
  });

  it("ikonka aria-hidden, nom matndan", () => {
    render(
      <SegmentedControl
        ariaLabel="Moliyaviy tahlil ko'rinishi"
        options={[
          { value: "chart", label: "Grafik", icon: ChartColumn },
          { value: "table", label: "Jadval", icon: List },
        ]}
        value="chart"
        onValueChange={() => undefined}
      />,
    );
    expect(radio("Grafik").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(radio("Grafik")).toHaveClass("px-2.5");
  });
});

describe("SegmentedControl — klaviatura", () => {
  it("Tab tanlangan variantga tushadi, ← → ↑ ↓ Home End tanlaydi, o'chirilganini o'tkazadi, aylanma", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} initial="thisWeek" />);

    await user.tab();
    expect(radio("Bu hafta")).toHaveFocus();

    await user.keyboard("{ArrowRight}"); // «Bu oy» o'chirilgan
    expect(radio("Barchasi")).toHaveFocus();
    expect(radio("Barchasi")).toBeChecked();

    await user.keyboard("{ArrowDown}"); // oxiridan boshiga
    expect(radio("Bugun")).toHaveFocus();

    await user.keyboard("{ArrowUp}"); // boshidan oxiriga
    expect(radio("Barchasi")).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(radio("Bu hafta")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(radio("Bugun")).toHaveFocus();

    await user.keyboard("{End}");
    expect(radio("Barchasi")).toHaveFocus();
    expect(radio("Barchasi")).toBeChecked();

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([
      "allTime",
      "today",
      "allTime",
      "thisWeek",
      "today",
      "allTime",
    ]);
  });

  it("guruhdan bitta Tab bilan chiqadi va qaytganda tanlanganiga tushadi", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled initial="today" />
        <button type="button">Keyingi maydon</button>
      </>,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Keyingi maydon" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(radio("Bu hafta")).toHaveFocus();
  });

  it("tashqi onKeyDown ham chaqiriladi, strelkalar ishlashda davom etadi", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(<Controlled onKeyDown={onKeyDown} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(radio("Bu hafta")).toBeChecked();
  });

  it("Bo'sh joy / Enter fokusdagi variantni tanlaydi (tugma)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl ariaLabel="Davr" options={OPTIONS} value="today" onValueChange={onChange} />,
    );
    // Boshqariladigan qiymat o'zgarmaydi — fokus strelka bilan ko'chadi, tanlov ota-onada.
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("thisWeek");
    expect(radio("Bu hafta")).toHaveFocus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("thisWeek");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe("SegmentedControl — o'lcham va en", () => {
  it("md (sukut): variant 32 px, 13 px matn; sm: 24 px, 12 px; telefonda har biri ≥ 44 px", () => {
    render(
      <>
        <SegmentedControl ariaLabel="O'rta" options={OPTIONS} value="today" onValueChange={() => undefined} />
        <SegmentedControl ariaLabel="Kichik" size="sm" options={OPTIONS} value="today" onValueChange={() => undefined} />
      </>,
    );
    const [md, sm] = screen.getAllByRole("radiogroup");
    const mdOption = md.querySelector('[role="radio"]');
    const smOption = sm.querySelector('[role="radio"]');
    expect(mdOption).toHaveClass("h-8", "text-[13px]", "rounded-lg", "max-md:min-h-11");
    expect(smOption).toHaveClass("h-6", "text-xs", "rounded-md", "max-md:min-h-11");
    expect(md).toHaveClass("rounded-[10px]", "border-border", "bg-sunken");
  });

  it("tanlangan variant: surface fon, text-text, kichik soya", () => {
    render(<Controlled />);
    expect(radio("Bugun")).toHaveClass("aria-checked:bg-surface", "aria-checked:text-text", "aria-checked:shadow-xs");
  });

  it('fullWidth="phone" (sukut): faqat telefonda to\'liq en', () => {
    render(<Controlled />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveClass("inline-flex", "max-md:flex", "max-md:w-full");
    expect(group).not.toHaveClass("w-full");
    expect(radio("Bugun")).toHaveClass("max-md:flex-1", "max-md:px-2", "px-3");
  });

  it("fullWidth: har doim to'liq en, variantlar teng", () => {
    render(<Controlled fullWidth />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveClass("flex", "w-full");
    expect(radio("Bugun")).toHaveClass("flex-1", "px-2");
    expect(radio("Bugun")).not.toHaveClass("px-3");
  });

  it("fullWidth={false}: telefonda ham o'z enida", () => {
    render(<Controlled fullWidth={false} />);
    const group = screen.getByRole("radiogroup");
    expect(group).not.toHaveClass("max-md:w-full");
    expect(radio("Bugun")).not.toHaveClass("max-md:flex-1");
  });

  it("className, ref va qo'shimcha atributlar guruhga o'tadi", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Controlled ref={ref} className="mt-2" data-testid="seg" />);
    expect(screen.getByTestId("seg")).toHaveClass("mt-2");
    expect(screen.getByTestId("seg")).toHaveAttribute("role", "radiogroup");
    expect(ref.current).toBe(screen.getByTestId("seg"));
  });

  it("burchak oddiy utilita (`!` siz) — global fokus radiusi `@layer base` da, utilita yutadi", () => {
    render(<Controlled />);
    for (const el of screen.getAllByRole("radio")) expect(el.className).not.toMatch(/rounded-\S*!/);
  });
});
