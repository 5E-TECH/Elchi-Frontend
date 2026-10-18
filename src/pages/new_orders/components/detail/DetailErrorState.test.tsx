import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { DetailErrorState } from "./DetailErrorState";
import { DetailHeader } from "./DetailHeader";
import { normalizeOrderDetail } from "./orderDetailModel";

const httpError = (status: number, message: string) => ({ response: { status, data: { message } } });

describe("DetailErrorState — D-13", () => {
  it("⭐ 404: «Buyurtma topilmadi», backendning inglizcha matni yo'q, «Qayta urinish» o'rniga «Buyurtmalarga qaytish»", () => {
    const retry = vi.fn();
    renderWithProviders(
      <DetailErrorState orderId="99999999" error={httpError(404, "Order #99999999 topilmadi")} onRetry={retry} />,
    );

    expect(screen.getByText("Buyurtma topilmadi")).toBeInTheDocument();
    expect(screen.getByText(/№99999999 raqamli buyurtma yo'q/)).toBeInTheDocument();
    expect(screen.queryByText(/Order #/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Qayta urinish" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buyurtmalarga qaytish" })).toHaveAttribute("href", "/orders");
  });

  it("boshqa xato (500) — umumiy xato holati va «Qayta urinish»", () => {
    renderWithProviders(<DetailErrorState orderId="5" error={httpError(500, "boom")} onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.queryByText("Buyurtma topilmadi")).not.toBeInTheDocument();
  });
});

describe("DetailHeader — nusxalash tugmasi", () => {
  it("⭐ D-13: buyurtma yo'q (topilmadi / yuklanmoqda) — nusxalash tugmasi yo'q", () => {
    renderWithProviders(<DetailHeader orderId="99999999" order={null} layout="default" onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "№99999999" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raqamni nusxalash" })).not.toBeInTheDocument();
  });

  it("mavjud buyurtmada nusxalash bor", () => {
    const order = normalizeOrderDetail({ id: "95", status: "new" });
    renderWithProviders(<DetailHeader orderId="95" order={order} layout="default" onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Raqamni nusxalash" })).toBeInTheDocument();
  });
});
