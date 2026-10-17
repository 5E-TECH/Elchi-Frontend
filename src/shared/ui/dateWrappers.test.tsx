import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import CustomDatePicker from "./CustomDatePicker";
import DateRangePicker, { type DateRangeValue } from "./DateRangePicker";
import FilterDateInput from "./FilterDateInput";
import FilterDateRange from "./FilterDateRange";

/**
 * v1 sana komponentlari — API o'zgarmagan, ichi dizayn v2 (`DateRange` / `DateInput`, 3-bosqich):
 * `DateRangePicker` (`Date`), `FilterDateRange` (satrlar), `FilterDateInput` (yorliqli bitta sana),
 * `CustomDatePicker` (bitta sana).
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
