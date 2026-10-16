import { useState } from "react";
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

/** Forma ro'yxati (bo'sh variantsiz). */
const OPTIONS = [
  { value: "1", label: "Bosh ofis" },
  { value: "16", label: "Samarqand" },
];

/** Filtr: bo'sh qiymatli «Barchasi» varianti bilan. */
const FILTER_OPTIONS = [{ value: "", label: "Barchasi" }, ...OPTIONS];

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

/** Iste'molchi kabi: qiymat holatda, `onChange` uni yangilaydi (spy ham chaqiriladi). */
const Controlled = ({ onChangeSpy, ...props }: Partial<Parameters<typeof SearchableSelect>[0]> & {
  onChangeSpy: (value: string) => void;
}) => {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <SearchableSelect
      label="Filial"
      name="branch"
      options={OPTIONS}
      placeholder="Filialni tanlang"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy(next);
      }}
    />
  );
};

describe("SearchableSelect (v2 ichida)", () => {
  it("yorliq — v2 Field (yashirin yorliq ham), maydon qidiruvli combobox; forma — o'z namunasi, × yo'q", () => {
    renderSelect({ hideLabel: true, value: "16" });
    const input = screen.getByRole("combobox", { name: "Filial" });
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("placeholder", "Filialni tanlang");
    expect(screen.getByText("Filial")).toHaveClass("sr-only");
    // Forma ro'yxatida ichki yorliq ham, × ham yo'q.
    expect(document.querySelector("[data-select-inline-label]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("bo'sh qiymatli variant ro'yxatga kirmaydi; tanlash onChange(qiymat)", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect({ options: FILTER_OPTIONS });
    await user.click(screen.getByRole("combobox", { name: "Filial" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Bosh ofis", "Samarqand"]);
    await user.keyboard("sam{Enter}");
    expect(onChange).toHaveBeenCalledWith("16");
  });

  it("filtr («Barchasi» varianti): bo'sh maydonda «Barchasi», tanlangach × «Tozalash» → onChange(\"\")", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Controlled options={FILTER_OPTIONS} onChangeSpy={onChange} />);
    const input = screen.getByRole("combobox", { name: "Filial" });
    expect(input).toHaveAttribute("placeholder", "Barchasi");
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();

    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Samarqand" }));
    expect(input).toHaveValue("Samarqand");
    const clear = screen.getByRole("button", { name: "Tozalash" });
    expect(clear).toHaveAccessibleDescription("Filial");
    await user.click(clear);
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "Barchasi");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
  });

  it("filtr: × klaviaturadan — Tab bilan yetib boriladi, Enter tozalaydi", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSelect({ options: FILTER_OPTIONS, value: "1" });
    screen.getByRole("combobox", { name: "Filial" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Tozalash" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("filtr belgisi `allOption` (iste'molchi namunasi «Filialni tanlang» bo'lsa ham) — «Barchasi» + ×", () => {
    renderSelect({ allOption: true, value: "1" });
    const input = screen.getByRole("combobox", { name: "Filial" });
    expect(input).toHaveAttribute("placeholder", "Barchasi");
    expect(screen.getByRole("button", { name: "Tozalash" })).toBeInTheDocument();
  });

  it("«Barchasi» namunasi — o'zgarishsiz (v1 «Tanlang <yorliq>» emas), filtr", () => {
    renderSelect({ placeholder: "Barchasi", value: "1" });
    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveAttribute("placeholder", "Barchasi");
    expect(screen.getByRole("button", { name: "Tozalash" })).toBeInTheDocument();
  });

  it("yashirin yorliqli filtr — maydon ichida «Filial:» + «Barchasi» (maket superadmin-mails-old)", () => {
    renderSelect({ allOption: true, hideLabel: true, placeholder: "Barcha filiallar" });
    const inline = document.querySelector("[data-select-inline-label]");
    expect(inline).toHaveTextContent("Filial:");
    expect(inline).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("combobox", { name: "Filial" })).toHaveAttribute("placeholder", "Barchasi");
  });

  it("allOption={false} — «Barchasi» namunasi bo'lsa ham forma (× yo'q)", () => {
    renderSelect({ allOption: false, placeholder: "Barchasi", value: "1" });
    expect(screen.queryByRole("button", { name: "Tozalash" })).not.toBeInTheDocument();
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
