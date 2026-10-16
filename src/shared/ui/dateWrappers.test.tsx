import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { getPresetDateRange, type ISODateRange } from "../lib/dateRange";
import CustomDatePicker from "./CustomDatePicker";
import DateRangePicker, { type DateRangeValue } from "./DateRangePicker";
import FilterDateInput from "./FilterDateInput";
import FilterDateRange from "./FilterDateRange";
import QuickDateRangeFilter from "./QuickDateRangeFilter";

/**
 * v1 sana komponentlari — API o'zgarmagan, ichi dizayn v2 (`DateRange` / `DateInput`, 3-bosqich):
 * `DateRangePicker` (`Date`), `FilterDateRange` (satrlar), `FilterDateInput` (yorliqli bitta sana),
 * `CustomDatePicker` (bitta sana), `QuickDateRangeFilter` (segment + «Yil» + oraliq).
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("DateRangePicker (v1 API: Date)", () => {
  it("Date qiymatni ko'rsatadi va tanlovni mahalliy yarim tun Date bilan qaytaradi; × — ikkalasi null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState<DateRangeValue>({
        startDate: new Date(2026, 9, 1),
        endDate: new Date(2026, 9, 8, 15, 30),
      });
      return (
        <DateRangePicker
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    };
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Sana oralig'i: 01.10.2026 dan 08.10.2026 gacha" });
    expect(trigger).toHaveTextContent("01.10 – 08.10.2026");

    await user.click(trigger);
    const october = within(screen.getByRole("dialog")).getAllByRole("grid")[0];
    await user.click(within(october).getByRole("gridcell", { name: /^3-oktabr/ }));
    await user.click(within(october).getByRole("gridcell", { name: /^12-oktabr/ }));
    expect(onChange).toHaveBeenLastCalledWith({ startDate: new Date(2026, 9, 3), endDate: new Date(2026, 9, 12) });

    await user.click(screen.getByRole("button", { name: "Sanalar oralig'ini tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith({ startDate: null, endDate: null });
    // Sukut namuna matni — v1 dagidek «Boshlanish → Tugash».
    expect(screen.getByRole("button", { name: /^Sana oralig'i:/ })).toHaveTextContent("Boshlanish → Tugash");
  });
});

describe("FilterDateRange (v1 API: satrlar)", () => {
  it("onChangeRange bo'lsa — bitta chaqiruv; bo'lmasa — from va to alohida", async () => {
    const user = userEvent.setup();
    const onChangeRange = vi.fn();
    const onFrom = vi.fn();
    const onTo = vi.fn();
    const { rerender } = render(
      <FilterDateRange
        dateFrom="2026-10-01"
        dateTo="2026-10-08"
        onChangeDateFrom={onFrom}
        onChangeDateTo={onTo}
        onChangeRange={onChangeRange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Sanalar oralig'ini tozalash" }));
    expect(onChangeRange).toHaveBeenCalledWith("", "");
    expect(onFrom).not.toHaveBeenCalled();

    rerender(<FilterDateRange dateFrom="2026-10-01" dateTo="2026-10-08" onChangeDateFrom={onFrom} onChangeDateTo={onTo} />);
    await user.click(screen.getByRole("button", { name: /^Sana oralig'i:/ }));
    const october = within(screen.getByRole("dialog")).getAllByRole("grid")[0];
    await user.click(within(october).getByRole("gridcell", { name: /^20-oktabr/ }));
    await user.click(within(october).getByRole("gridcell", { name: /^5-oktabr/ }));
    expect(onFrom).toHaveBeenCalledWith("2026-10-05");
    expect(onTo).toHaveBeenCalledWith("2026-10-20");
  });

  it("URL'da faqat boshlanish bo'lsa — «01.10.2026 dan»", () => {
    render(<FilterDateRange dateFrom="2026-10-01" dateTo="" onChangeDateFrom={() => {}} onChangeDateTo={() => {}} />);
    expect(screen.getByRole("button", { name: /^Sana oralig'i:/ })).toHaveTextContent("01.10.2026 dan");
  });
});

describe("FilterDateInput (v1 API: yorliqli bitta sana)", () => {
  it("yorliq ustida (Field), nomi «yorliq + sana», minDate dan oldingi kun tanlanmaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterDateInput label="Tugash" value="2026-10-08" onChange={onChange} minDate="2026-10-05" />);

    expect(screen.getByText("Tugash")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Tugash 08.10.2026" });
    await user.click(trigger);
    await user.click(screen.getByRole("gridcell", { name: /^4-oktabr/ }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("gridcell", { name: /^6-oktabr/ }));
    expect(onChange).toHaveBeenCalledWith("2026-10-06");
  });
});

describe("CustomDatePicker (v1 API: bitta sana)", () => {
  it("namuna matni, tanlov va tozalash; eski variant/size — e'tiborsiz", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomDatePicker value="" onChange={onChange} placeholder="To'lov kuni" variant="form" size="sm" />,
    );
    expect(screen.getByRole("button", { name: "Sana: To'lov kuni" })).toHaveTextContent("To'lov kuni");

    rerender(<CustomDatePicker value="2026-10-08" onChange={onChange} variant="form" />);
    await user.click(screen.getByRole("button", { name: "Sana: 08.10.2026" }));
    await user.click(screen.getByRole("gridcell", { name: /^10-oktabr/ }));
    expect(onChange).toHaveBeenLastCalledWith("2026-10-10");

    await user.click(screen.getByRole("button", { name: "Sanani tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("QuickDateRangeFilter (segment + «Yil» + oraliq)", () => {
  const Harness = ({ onChange, onClear, includeAll = true }: { onChange?: (r: ISODateRange) => void; onClear?: () => void; includeAll?: boolean }) => {
    const [range, setRange] = useState<ISODateRange>(getPresetDateRange("today"));
    return (
      <QuickDateRangeFilter
        fromDate={range.from}
        toDate={range.to}
        includeAll={includeAll}
        onChange={(next) => {
          setRange(next);
          onChange?.(next);
        }}
        onClear={
          onClear
            ? () => {
                setRange({ from: "", to: "" });
                onClear();
              }
            : undefined
        }
      />
    );
  };

  it("segment «Davr» — radio guruhi, maketdagi yorliqlar, joriy davr tanlangan; bosilsa shared/lib davri keladi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const group = screen.getByRole("radiogroup", { name: "Davr" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
      "Bugun",
      "Bu hafta",
      "Bu oy",
      "Barchasi",
    ]);
    expect(within(group).getByRole("radio", { name: "Bugun" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(group).getByRole("radio", { name: "Bu oy" }));
    expect(onChange).toHaveBeenLastCalledWith(getPresetDateRange("month"));

    await user.click(within(group).getByRole("radio", { name: "Barchasi" }));
    expect(onChange).toHaveBeenLastCalledWith(getPresetDateRange("all"));
    // «Barchasi» (1970 … bugun) maydonda sana bo'lib ko'rinmaydi.
    expect(screen.getByRole("button", { name: /^Sana oralig'i:/ })).toHaveTextContent("Dan → Gacha");
  });

  it("«Yil» ro'yxati yil oralig'ini beradi; segmentda hech biri tanlanmaydi; × — onClear", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<Harness onChange={onChange} onClear={onClear} includeAll={false} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Yilni tanlash" }), "2025");
    expect(onChange).toHaveBeenLastCalledWith({ from: "2025-01-01", to: "2025-12-31" });
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sana oralig'i:/ })).toHaveTextContent("01.01 – 31.12.2025");

    // Oraliq panelida tez tanlov yo'q — segment yonida turibdi.
    await user.click(screen.getByRole("button", { name: /^Sana oralig'i:/ }));
    expect(within(screen.getByRole("dialog")).queryByRole("group", { name: "Tez tanlov" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Sanalar oralig'ini tozalash" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
