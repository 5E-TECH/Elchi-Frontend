import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import FilterMultiSelect from "./FilterMultiSelect";
import FilterSelect from "./FilterSelect";

/** FilterSelect / FilterMultiSelect — eski API (Redux + URL), ichi v2 `Field` + `Select`. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const OPTIONS = [
  { value: "", label: "Barchasi" },
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
];

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="search">{location.search}</output>;
};

describe("FilterSelect (v2 ichida)", () => {
  it("oddiy combobox; bo'sh variant — namuna («Tanlang <yorliq>»), ro'yxatda yo'q", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FilterSelect label="To'lov turi" name="type" value="" onChange={onChange} options={OPTIONS} />);
    const trigger = screen.getByRole("combobox", { name: "To'lov turi" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent("Tanlang to'lov turi");
    await user.click(trigger);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Naqd", "Karta"]);
    await user.click(screen.getByRole("option", { name: "Karta" }));
    expect(onChange).toHaveBeenCalledWith("card");
  });

  it("useRedux: qiymat filterSlice va URL'ga yoziladi (urlKey)", async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(
      <Routes>
        <Route
          path="*"
          element={
            <>
              <FilterSelect label="To'lov turi" name="type" options={OPTIONS} useRedux reduxKey="paymentType" urlKey="type" />
              <LocationProbe />
            </>
          }
        />
      </Routes>,
      { route: "/payments" },
    );
    await user.click(screen.getByRole("combobox", { name: "To'lov turi" }));
    await user.click(screen.getByRole("option", { name: "Naqd" }));
    expect(store.getState().filter.paymentType).toBe("cash");
    expect(screen.getByTestId("search")).toHaveTextContent("type=cash");
    expect(screen.getByRole("combobox", { name: "To'lov turi" })).toHaveTextContent("Naqd");
  });

  it("klaviatura: ↓ ochadi, Enter tanlaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FilterSelect label="Tur" name="t" value="cash" onChange={onChange} options={OPTIONS} />);
    screen.getByRole("combobox", { name: "Tur" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("card");
  });
});

describe("FilterMultiSelect (v2 ichida)", () => {
  const STATUSES = [
    { value: "new", label: "Yangi" },
    { value: "on the road", label: "Yo'lda" },
    { value: "waiting", label: "Kutilmoqda" },
  ];

  it("belgilar, «+N», × — hammasini tozalash; ro'yxatda belgilash", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <FilterMultiSelect
        label="Holat"
        name="status"
        value={["new", "on the road", "waiting"]}
        onChange={onChange}
        options={STATUSES}
        placeholder="Holatni tanlang"
      />,
    );
    expect(screen.getByText("+1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Barchasini tozalash" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    await user.click(screen.getByRole("combobox", { name: "Holat" }));
    await user.click(screen.getByRole("option", { name: "Yangi" }));
    expect(onChange).toHaveBeenLastCalledWith(["on the road", "waiting"]);
  });
});
