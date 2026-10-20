import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "../../../entities/order/model/statusRegistry";
import { renderWithProviders } from "../../../test/test-utils";
import { BadgesSection } from "./BadgesSection";

/** «Holat belgilari» namunasi: har panelda 11 holat, ton × ko'rinish × o'lcham matritsasi. */

describe("BadgesSection", () => {
  it("har panelda (kunduzgi + tungi) 13 buyurtma holati", () => {
    renderWithProviders(<BadgesSection />, { route: "/ops/ui-kit?section=badges" });
    for (const panel of document.querySelectorAll("[data-kit-theme]")) {
      const keys = Array.from(panel.querySelectorAll("[data-order-status]"))
        .slice(0, ORDER_STATUSES.length)
        .map((el) => el.getAttribute("data-order-status"));
      expect(keys).toEqual([
        "new",
        "created",
        "received",
        "on_the_road",
        "waiting",
        "waiting_customer",
        "partly_paid",
        "sold",
        "paid",
        "cancelled",
        "cancelled_sent",
        "returned_to_market",
        "closed",
      ]);
    }
    expect(document.querySelectorAll("[data-kit-theme]")).toHaveLength(2);
  });

  it("matritsa: 5 ton × 3 ko'rinish × 2 o'lcham har panelda", () => {
    renderWithProviders(<BadgesSection />, { route: "/ops/ui-kit?section=badges" });
    // Har ton yorlig'i 6 marta (3 ko'rinish × 2 o'lcham) × 2 panel.
    for (const label of ["Neytral", "Ma'lumot", "Muvaffaqiyat", "Ogohlantirish", "Xato"]) {
      expect(screen.getAllByText(label)).toHaveLength(12);
    }
  });

  it("API qiymatlari: yozilishlar normallashadi, noma'lum — neytral", () => {
    renderWithProviders(<BadgesSection />, { route: "/ops/ui-kit?section=badges&theme-pair=0" });
    expect(screen.getByText("Lost in transit")).toBeInTheDocument();
    expect(screen.getByText("Noma'lum")).toBeInTheDocument();
    // `cancelled_sent` namunasi + 11 holat ichidagisi.
    expect(screen.getAllByText("Bekor — jo'natilgan")).toHaveLength(2);
  });
});
