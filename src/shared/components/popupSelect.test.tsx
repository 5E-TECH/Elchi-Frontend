import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Store } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { renderWithProviders } from "../../test/test-utils";
import PopupSelect from "./popupSelect";

/** Tanlash oynasi — eski API, ichi v2 `Dialog` + qidiruv + ro'yxat (`superadmin-payments-to-give-dialog`). */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

type Market = { id: number; name: string; phone: string };

const MARKETS: Market[] = [
  { id: 1, name: "Baraka Shop", phone: "+998 90 315 22 41" },
  { id: 2, name: "Nur Elektronika", phone: "+998 93 604 18 72" },
  { id: 3, name: "Chilonzor Market", phone: "+998 97 228 90 13" },
];

const Harness = ({
  onSelect = () => undefined,
  immediateSelection = false,
  renderItem,
}: {
  onSelect?: (market: Market) => void;
  immediateSelection?: boolean;
  renderItem?: (market: Market, isSelected: boolean) => React.ReactNode;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ochish
      </button>
      <PopupSelect<Market>
        isOpen={open}
        onClose={() => setOpen(false)}
        data={MARKETS}
        title="Berilishi kerak"
        description="Pul to'lanadigan marketni tanlang"
        icon={<Store size={20} />}
        keyExtractor={(market) => market.id}
        searchKeys={["name", "phone"]}
        labelKey="name"
        secondaryLabelKey="phone"
        onSelect={onSelect}
        immediateSelection={immediateSelection}
        renderItem={renderItem}
      />
    </>
  );
};

describe("PopupSelect (v2 Dialog ichida)", () => {
  it("oyna: sarlavha, izoh, qidiruv combobox, ro'yxat; «Tanlash» tanlanmaguncha o'chiq", () => {
    renderWithProviders(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Berilishi kerak" });
    expect(dialog).toHaveAccessibleDescription("Pul to'lanadigan marketni tanlang");
    const search = within(dialog).getByRole("combobox", { name: "Qidirish..." });
    expect(search).toHaveAttribute("aria-controls", within(dialog).getByRole("listbox", { name: "Berilishi kerak" }).id);
    expect(within(dialog).getAllByRole("option")).toHaveLength(3);
    expect(within(dialog).getByRole("button", { name: "Tanlash" })).toBeDisabled();
    // Maket: ro'yxat qidiruv va amallardan chiziq bilan ajralgan; qator 56 px.
    const listbox = within(dialog).getByRole("listbox", { name: "Berilishi kerak" });
    expect(listbox.parentElement).toHaveClass("border-t", "border-border");
    expect(listbox).toHaveClass("max-h-[360px]");
    expect(within(dialog).getAllByRole("option")[0]).toHaveClass("min-h-14");
    expect(dialog.querySelector("[data-dialog-footer]")).toHaveClass("border-t");
  });

  it("qidiruv saralaydi (izoh maydoni bo'yicha ham); bosish belgilaydi; «Tanlash» onSelect + yopadi", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<Harness onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox", { name: "Qidirish..." }), "604");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Nur Elektronika +998 93 604 18 72" })).toBeInTheDocument();
    await user.clear(screen.getByRole("combobox", { name: "Qidirish..." }));
    await user.click(screen.getByRole("option", { name: /Chilonzor Market/ }));
    expect(screen.getByRole("option", { name: /Chilonzor Market/ })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Tanlash" }));
    expect(onSelect).toHaveBeenCalledWith(MARKETS[2]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("klaviatura: ↓ yuradi, Enter belgilaydi, yana Enter — tanlaydi", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<Harness onSelect={onSelect} />);
    const search = screen.getByRole("combobox", { name: "Qidirish..." });
    search.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(search).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: /Nur Elektronika/ }).id);
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: /Nur Elektronika/ })).toHaveAttribute("aria-selected", "true");
    expect(onSelect).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(MARKETS[1]);
  });

  it("immediateSelection: bosish darhol tanlaydi, pastki tugmalar yo'q", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<Harness onSelect={onSelect} immediateSelection />);
    expect(screen.queryByRole("button", { name: "Tanlash" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Baraka Shop/ }));
    expect(onSelect).toHaveBeenCalledWith(MARKETS[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderItem ikkinchi argumenti doim false (tanlov — radio va qator foni)", async () => {
    const user = userEvent.setup();
    const renderItem = vi.fn<(market: Market, isSelected: boolean) => React.ReactNode>((market) => (
      <span>{market.name}</span>
    ));
    renderWithProviders(<Harness renderItem={renderItem} />);
    await user.click(screen.getByRole("option", { name: "Baraka Shop" }));
    expect(renderItem.mock.calls.every(([, selected]) => selected === false)).toBe(true);
  });

  it("topilmasa — «Topilmadi»; Esc avval qidiruvni tozalaydi, keyin oynani yopadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.type(screen.getByRole("combobox", { name: "Qidirish..." }), "Zarafshon");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getAllByText("Topilmadi").length).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("combobox", { name: "Qidirish..." })).toHaveValue("");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("qidiruvda faol qator o'zgarsa aria-activedescendant ham o'zgaradi (id — kalitdan, indeksdan emas)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const search = screen.getByRole("combobox", { name: "Qidirish..." });
    await user.type(search, "Baraka");
    const before = search.getAttribute("aria-activedescendant");
    expect(document.getElementById(before!)).toHaveTextContent("Baraka Shop");
    await user.clear(search);
    await user.type(search, "Chilonzor");
    const after = search.getAttribute("aria-activedescendant");
    expect(after).not.toBe(before);
    expect(document.getElementById(after!)).toHaveTextContent("Chilonzor Market");
  });
});
