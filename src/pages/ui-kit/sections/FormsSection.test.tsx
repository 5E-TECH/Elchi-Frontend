import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { FormsSection } from "./FormsSection";

/**
 * «Forma elementlari» bo'limi: ikki panel (kunduzgi/tungi), id lar takrorlanmaydi, maketdagi uz matnlar
 * (`tizim-states-forms` 01–02), holatlar va maxsus maydonlar ishlaydi.
 */

const panels = () => Array.from(document.querySelectorAll<HTMLElement>("[data-kit-theme]"));

describe("FormsSection", () => {
  it("ikki panel; sahifada id lar takrorlanmaydi (yorliq ↔ maydon bog'lanishi buzilmasin)", () => {
    renderWithProviders(<FormsSection />, { route: "/ops/ui-kit?section=forms" });
    expect(panels()).toHaveLength(2);
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("holatlar matritsasi: maketdagi matnlar, xato, o'chirilgan, faqat o'qish", () => {
    renderWithProviders(<FormsSection />, { route: "/ops/ui-kit?section=forms" });
    const light = within(panels()[0]);
    const names = light.getAllByRole("textbox", { name: "Mijoz ismi" });
    expect(names).toHaveLength(6);
    expect(names[0]).toHaveAttribute("placeholder", "Ism kiriting");
    expect(names[0]).toHaveAccessibleDescription("Ism va familiya");
    expect(names[1]).toHaveValue("Dilnoza Karimova");
    expect(names[2]).toHaveAttribute("aria-invalid", "true");
    expect(names[2]).toHaveAccessibleDescription("Mijoz ismini kiriting");
    expect(names[4]).toBeDisabled();
    expect(names[4]).toHaveAccessibleDescription("Yopilgan buyurtmada tahrirlanmaydi");
    expect(names[5]).toHaveAttribute("readonly");
    expect(light.getByRole("button", { name: "Ismdan nusxa olish" })).toBeInTheDocument();
  });

  it("qidiruv, telefon, summa va ko'p qatorli maydonlar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FormsSection />, { route: "/ops/ui-kit?section=forms" });
    const light = within(panels()[0]);
    const searches = light.getAllByRole("searchbox", { name: "Buyurtmalarni qidirish" });
    expect(searches[0]).toHaveAttribute("placeholder", "Shu ro'yxatdan qidirish");
    expect(searches[1]).toHaveValue("Dilnoza");
    expect(light.getByRole("button", { name: "Qidiruvni tozalash" })).toBeInTheDocument();

    const phones = light.getAllByRole("textbox", { name: "Telefon raqam" });
    expect(phones.map((el) => (el as HTMLInputElement).value)).toEqual(["", "90 123 45 67", "90 12", "93 456 12 08"]);
    expect(phones[0]).toHaveAccessibleDescription("9 ta raqam, kod avtomatik");
    expect(phones[2]).toHaveAccessibleDescription("Telefon raqam 9 ta raqamdan iborat bo'lishi kerak");
    expect(phones[3].closest("[data-text-input]")).toHaveAttribute("data-size", "lg");

    expect(light.getByRole("textbox", { name: "Summa" })).toHaveValue("45 000");
    expect(light.getByRole("textbox", { name: "Izoh (ixtiyoriy)" })).toHaveAttribute("placeholder", "Izoh yozing...");

    const sms = light.getByRole("textbox", { name: "SMS matni" });
    expect(sms).toHaveAccessibleDescription("75 / 160 belgi");
    await user.type(sms, "!");
    expect(sms).toHaveAccessibleDescription("76 / 160 belgi");
  });
});
