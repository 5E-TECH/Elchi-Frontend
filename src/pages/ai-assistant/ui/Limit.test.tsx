import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { CapAlert } from "./Limit";

/**
 * Kunlik AI chegarasi (maket `superadmin-ai-assistant-daily-cap`): `warning` + `role="status"` + soat ikonkasi,
 * sarlavha «Bugungi AI chegarasi tugadi»; summalar, «Sarfni ko'rish», «Hisobotlar … tavsiyalar» va «oylik budjet» —
 * yo'q (backend yo'q); «Ogohlantirishlar ochiq; …» — faqat maslahatchi backend'i bo'lsa.
 */

const capBox = () => screen.getByText("Bugungi AI chegarasi tugadi").closest("[role=status]");

describe("CapAlert", () => {
  it("yordamchi chegarasi, maslahatchi backend'i bor — «Ogohlantirishlar ochiq; …» bilan", () => {
    renderWithProviders(<CapAlert code="assistant_usd_cap" advisorAvailable />);
    const box = capBox();
    expect(box).toHaveAttribute("data-tone", "warning");
    expect(box?.querySelector("svg.lucide-clock")).not.toBeNull();
    expect(box).toHaveTextContent(
      "Yordamchi bugungi xavfsizlik chegarasiga yetdi. Yangi savol ertaga, 00:00 dan (Toshkent vaqti). " +
        "Ogohlantirishlar ochiq; ogohlantirish qoidalari ishlayveradi.",
    );
    expect(screen.getByText("Kunlik chegara serverda o'rnatilgan — uni oshirib bo'lmaydi.")).toHaveClass("text-text-muted");
    expect(box).not.toHaveTextContent(/so'm|\$|Hisobotlar|tavsiyalar|budjet|Sarfni/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("yordamchi chegarasi, maslahatchi backend'i yo'q — «Ogohlantirishlar ochiq» gapisiz", () => {
    renderWithProviders(<CapAlert code="assistant_usd_cap" />);
    expect(capBox()).not.toHaveTextContent(/Ogohlantirishlar ochiq/);
    expect(capBox()).toHaveTextContent("Yordamchi bugungi xavfsizlik chegarasiga yetdi.");
  });

  it("umumiy chegara (`cap_exceeded`) — «Tizimdagi barcha AI xizmatlari …», server izohisiz", () => {
    renderWithProviders(<CapAlert code="cap_exceeded" advisorAvailable />);
    expect(capBox()).toHaveTextContent(
      "Bugungi AI chegarasi tugadiTizimdagi barcha AI xizmatlari uchun bugungi umumiy chegara tugadi. Yangi savol ertaga, 00:00 dan (Toshkent vaqti).",
    );
    expect(capBox()).not.toHaveTextContent(/Kunlik chegara serverda|Ogohlantirishlar ochiq/);
  });
});
