import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import type { ISODateRange } from "../../lib/dateRange";
import { DateRange, DateRangePanel, type DateRangeProps } from "./DateRange";
import { Field } from "./Field";

/**
 * DateRange — `.el-select` + `.el-cal*` + `.el-cal-presets` (CODE-MAP 2.2, `tizim-states-forms` 04):
 * maydon matni va nomi, tez tanlov, ikki bosishda oraliq (darhol qo'llanadi va yopiladi), Esc,
 * tozalash, `Field` bilan bog'lanish, klaviatura, telefonda pastki varaqa.
 */

const TODAY = "2026-10-08";

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const Controlled = ({
  initial = { from: "", to: "" },
  onChange,
  ...props
}: Partial<DateRangeProps> & { initial?: ISODateRange }) => {
  const [value, setValue] = useState<ISODateRange>(initial);
  return (
    <DateRange
      today={TODAY}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const trigger = () => screen.getByRole("button", { name: /^Sana oralig'i:/ });

describe("DateRange — maydon", () => {
  it("bo'sh: namuna matni, nomi «Sana oralig'i: …», dialog ochadi; chevron, × yo'q", () => {
    render(<Controlled />);
    const button = trigger();
    expect(button).toHaveAccessibleName("Sana oralig'i: Sana oralig'ini tanlang");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveTextContent("Sana oralig'ini tanlang");
    expect(screen.queryByRole("button", { name: "Sanalar oralig'ini tozalash" })).not.toBeInTheDocument();
  });

  it("tanlangan: «01.10 – 08.10.2026», nomida to'liq sanalar; × tozalaydi va fokus maydonda", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={{ from: "2026-10-01", to: "2026-10-08" }} onChange={onChange} />);

    expect(trigger()).toHaveTextContent("01.10 – 08.10.2026");
    expect(trigger()).toHaveAccessibleName("Sana oralig'i: 01.10.2026 dan 08.10.2026 gacha");

    await user.click(screen.getByRole("button", { name: "Sanalar oralig'ini tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "", to: "" });
    expect(trigger()).toHaveTextContent("Sana oralig'ini tanlang");
    expect(document.activeElement).toBe(trigger());
  });

  it("Field ichida — nomi yorliq + qiymat (aria-labelledby), xato — aria-invalid", () => {
    render(
      <Field label="Sana" labelAs="span" error="Sanani tanlang">
        <DateRange value={{ from: "2026-10-01", to: "2026-10-08" }} onChange={() => {}} today={TODAY} />
      </Field>,
    );
    const button = screen.getByRole("button", { name: "Sana 01.10.2026 dan 08.10.2026 gacha" });
    expect(button).toHaveAttribute("aria-invalid", "true");
    expect(button).toHaveAccessibleDescription("Sanani tanlang");
  });

  it("bitta chekka: «01.10.2026 dan»; o'chirilgan maydon ochilmaydi", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={{ from: "2026-10-01", to: "" }} disabled />);
    expect(trigger()).toHaveTextContent("01.10.2026 dan");
    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("DateRange — panel", () => {
  it("ochiladi: dialog nomi, tez tanlov (Bu oy bosilgan), ikki oy, pastda «… · 8 kun», fokus tanlangan kunda", async () => {
    const user = userEvent.setup();
    render(<Controlled initial={{ from: "2026-10-01", to: "2026-10-08" }} />);
    await user.click(trigger());

    const dialog = screen.getByRole("dialog", { name: "Sana oralig'ini tanlash" });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls", dialog.id);

    const presets = within(dialog).getByRole("group", { name: "Tez tanlov" });
    expect(within(presets).getAllByRole("button").map((chip) => chip.textContent)).toEqual([
      "Bugun",
      "Bu hafta",
      "Bu oy",
      "Barchasi",
    ]);
    expect(within(presets).getByRole("button", { name: "Bu oy" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getAllByRole("grid").map((grid) => grid.getAttribute("aria-labelledby"))).toHaveLength(2);
    expect(dialog).toHaveTextContent("01.10.2026 – 08.10.2026 · 8 kun");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-01");
  });

  it("birinchi bosish — boshlanish, ikkinchisi — tugash: darhol qo'llanadi, panel yopiladi, fokus maydonga", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(trigger());
    const dialog = screen.getByRole("dialog");
    const october = within(dialog).getAllByRole("grid")[0];

    await user.click(within(october).getByRole("gridcell", { name: "10-oktabr" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("10.10.2026 – … · Tugash sanasini tanlang");

    // Tugash boshlanishdan oldin — joylari almashadi.
    await user.click(within(october).getByRole("gridcell", { name: "3-oktabr" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-03", to: "2026-10-10" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
    expect(trigger()).toHaveTextContent("03.10 – 10.10.2026");
  });

  it("tez tanlov darhol qo'llanadi; «Barchasi» — bo'sh oraliq", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} initial={{ from: "2026-10-01", to: "2026-10-08" }} />);

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Bu hafta" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-10-05", to: TODAY });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Barchasi" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "", to: "" });
  });

  it("Esc va tashqariga bosish — qoralama bekor, qiymat o'zgarmaydi; Esc dan keyin fokus maydonda", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <button type="button">Tashqarida</button>
        <Controlled onChange={onChange} initial={{ from: "2026-10-01", to: "2026-10-08" }} />
      </>,
    );

    await user.click(trigger());
    await user.click(screen.getAllByRole("gridcell", { name: "15-oktabr" })[0]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
    expect(onChange).not.toHaveBeenCalled();

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Tashqarida" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("01.10 – 08.10.2026");
  });

  it("faqat klaviatura: Enter ochadi, strelkalar va Enter bilan oraliq, Tab panel ichida aylanadi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} initial={{ from: "2026-10-01", to: "2026-10-08" }} />);

    trigger().focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-01");

    // Tab: kun → «Keyingi oy» → tez tanlov boshiga aylanadi (Shift+Tab — teskari).
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Keyingi oy");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName("Bugun");
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAccessibleName("Keyingi oy");
    await user.tab({ shift: true });
    expect(document.activeElement).toHaveAttribute("data-day", "2026-10-01");

    await user.keyboard("{ArrowDown}{Enter}{ArrowRight}{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledWith({ from: "2026-10-08", to: "2026-10-10" });
    expect(document.activeElement).toBe(trigger());
  });
});

describe("DateRange — telefon", () => {
  it("pastki varaqa: modal, sarlavha, bitta oy, «Yopish»", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query === "(max-width: 767px)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const user = userEvent.setup();
    render(<Controlled initial={{ from: "2026-10-01", to: "2026-10-08" }} />);

    await user.click(trigger());
    const sheet = screen.getByRole("dialog", { name: "Sana oralig'ini tanlash" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(within(sheet).getByRole("heading", { level: 2, name: "Sana oralig'ini tanlash" })).toBeInTheDocument();
    expect(within(sheet).getAllByRole("grid")).toHaveLength(1);
    expect(document.documentElement).toHaveAttribute("data-scroll-locked");

    await user.click(within(sheet).getByRole("button", { name: "Yopish" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-scroll-locked");
    expect(document.activeElement).toBe(trigger());
  });
});

describe("DateRangePanel — sahifadagi ochiq namuna", () => {
  it("o'z yuzasi bilan chiziladi va tanlov onChange ga boradi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DateRangePanel
        surface="raised"
        role="group"
        aria-label="Namuna"
        value={{ from: "2026-10-01", to: "2026-10-08" }}
        onChange={onChange}
        today={TODAY}
      />,
    );
    const panel = screen.getByRole("group", { name: "Namuna" });
    expect(panel).toHaveClass("bg-raised", "rounded-[14px]");
    await user.click(within(panel).getByRole("button", { name: "Bugun" }));
    expect(onChange).toHaveBeenCalledWith({ from: TODAY, to: TODAY }, "preset");
  });
});
