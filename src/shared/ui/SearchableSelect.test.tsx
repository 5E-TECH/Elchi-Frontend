import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import SearchableSelect from "./SearchableSelect";

/** SearchableSelect — eski API, ichi v2 `Field` + `Select searchable`. */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const OPTIONS = [
  { value: "", label: "Barchasi" },
  { value: "1", label: "Bosh ofis" },
  { value: "16", label: "Samarqand" },
];

const renderSelect = (props: Partial<Parameters<typeof SearchableSelect>[0]> = {}) => {
  const onChange = vi.fn();
  renderWithProviders(
    <SearchableSelect
      label="Filial"
      name="branch"
      value=""
      onChange={onChange}
      options={OPTIONS}
      placeholder="Filialni tanlang"
      {...props}
    />,
  );
  return { onChange };
};

describe("SearchableSelect (v2 ichida)", () => {
  it("yorliq — v2 Field (yashirin yorliq ham), maydon qidiruvli combobox", () => {
    renderSelect({ hideLabel: true });
    const input = screen.getByRole("combobox", { name: "Filial" });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("placeholder", "Filialni tanlang");
    expect(screen.getByText("Filial")).toHaveClass("sr-only");
  });

  it("bo'sh qiymatli variant ro'yxatga kirmaydi; tanlash onChange(qiymat)", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect();
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Bosh ofis", "Samarqand"]);
    await user.keyboard("sam{Enter}");
    expect(onChange).toHaveBeenCalledWith("16");
  });

  it("«Barchasi» namunasi — «Tanlang <yorliq>»", () => {
    renderSelect({ placeholder: "Barchasi" });
    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveAttribute("placeholder", "Tanlang filial");
  });

  it("tanlangan qiymat maydonda ko'rinadi", () => {
    renderSelect({ value: "16" });
    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveValue("Samarqand");
  });

  it("ro'yxat sukut bo'yicha pastda, placement='top' — tepada", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <SearchableSelect label="Filial" name="b" value="" onChange={() => undefined} options={OPTIONS} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    expect(screen.getByRole("listbox").closest("[data-select-panel]")).toHaveAttribute("data-side", "bottom");
    unmount();

    renderWithProviders(
      <SearchableSelect label="Filial" name="b" value="" onChange={() => undefined} options={OPTIONS} placement="top" />,
    );
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    expect(screen.getByRole("listbox").closest("[data-select-panel]")).toHaveAttribute("data-side", "top");
  });

  it("yuklanmoqda va o'chirilgan", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(
      <SearchableSelect label="Filial" name="b" value="" onChange={() => undefined} options={[]} loading />,
    );
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    expect(screen.getByRole("status")).toHaveTextContent("Yuklanmoqda...");
    unmount();
    renderWithProviders(
      <SearchableSelect label="Filial" name="b" value="" onChange={() => undefined} options={OPTIONS} disabled />,
    );
    expect(screen.getByRole("combobox", { name: "Filial" })).toBeDisabled();
  });
});
