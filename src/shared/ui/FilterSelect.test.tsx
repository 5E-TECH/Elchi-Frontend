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
  it("oddiy combobox; bo'sh variant — «Barchasi» (v1 «Tanlang <yorliq>» emas), ro'yxatda yo'q", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FilterSelect label="To'lov turi" name="type" value="" onChange={onChange} options={OPTIONS} />);
    const trigger = screen.getByRole("combobox", { name: "To'lov turi" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveTextContent("Barchasi");
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Naqd", "Karta"]);
    await user.click(screen.getByRole("option", { name: "Karta" }));
    expect(onChange).toHaveBeenCalledWith("card");
  });

  it("filtr: qiymat bo'lsa maydonda × «Tozalash» (Tab bilan) — onChange(\"\"), fokus maydonda", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FilterSelect label="To'lov turi" name="type" value="card" onChange={onChange} options={OPTIONS} />);
    const trigger = screen.getByRole("combobox", { name: "To'lov turi" });
    expect(trigger).toHaveTextContent("Karta");
    trigger.focus();
    await user.tab();
    const clear = screen.getByRole("button", { name: "Tozalash" });
    expect(clear).toHaveFocus();
    expect(clear).toHaveAccessibleDescription("To'lov turi");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("");
    expect(trigger).toHaveFocus();
  });

  it("forma ro'yxati (bo'sh variantsiz, «… tanlang» namunasi) — namuna qoladi, × yo'q", () => {
    renderWithProviders(
      <FilterSelect
        label="Karta"
        name="card"
        value="card"
        onChange={() => undefined}
        options={OPTIONS.filter((option) => option.value)}
        placeholder="Kartani tanlang"
      />,
    );
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("yashirin yorliqli filtr: maydon ichida «Rol:» + «Barchasi» (maket superadmin-users-list)", () => {
    renderWithProviders(
      <FilterSelect
        label="Rol"
        name="role"
        options={OPTIONS.filter((option) => option.value)}
        placeholder="Rolni tanlang"
        hideLabel
        useRedux
        reduxKey="userRole"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Rol" });
    expect(trigger).toHaveTextContent("Rol:Barchasi");
    expect(trigger.querySelector("[data-select-inline-label]")).toHaveAttribute("aria-hidden", "true");
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

    // × — «Barchasi» ga qaytish: Redux bo'sh, URL parametri olib tashlanadi.
    await user.click(screen.getByRole("button", { name: "Tozalash" }));
    expect(store.getState().filter.paymentType).toBe("");
    expect(screen.getByTestId("search")).not.toHaveTextContent("type=");
    expect(screen.getByRole("combobox", { name: "To'lov turi" })).toHaveTextContent("Barchasi");
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

  it("bo'sh — «Barchasi» (iste'molchi namunasi «Holatni tanlang» bo'lsa ham; maket superadmin-orders-list)", () => {
    renderWithProviders(
      <FilterMultiSelect label="Holat" name="status" value={[]} onChange={() => undefined} options={STATUSES} placeholder="Holatni tanlang" />,
    );
    // Ko'rinadigan namuna va ekran o'quvchi uchun tugma ichidagi xulosa — ikkalasi «Barchasi».
    expect(screen.getByRole("combobox", { name: "Holat" })).toHaveTextContent("Barchasi");
    expect(screen.getAllByText("Barchasi").some((node) => !node.closest("button"))).toBe(true);
    expect(screen.queryByText("Holatni tanlang")).not.toBeInTheDocument();
  });

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
