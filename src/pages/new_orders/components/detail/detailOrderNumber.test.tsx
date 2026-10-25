import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { DetailHeader } from "./DetailHeader";
import { normalizeOrderDetail } from "./orderDetailModel";

/**
 * rwAy8Qyk — tafsilot sarlavhasida yorliqdagi raqam (`order_number`, «№EL-100081») va nusxalash shu raqamni oladi;
 * `order_number` yo'q (eski javob) yoki buyurtma hali yuklanmagan — `№id`.
 */
vi.mock("../../../../shared/api/api", () => ({ api: { get: vi.fn(() => new Promise(() => {})) } }));

const ORDER = { id: "81", status: "new", createdAt: "2026-10-16T09:00:00.000Z", order_number: "EL-100081" };

describe("Buyurtma tafsiloti — raqam (rwAy8Qyk)", () => {
  it("sarlavha «№EL-100081», nusxa «EL-100081»", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DetailHeader orderId="81" order={normalizeOrderDetail(ORDER)} layout="default" onBack={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("№EL-100081");
    await user.click(screen.getByRole("button", { name: "Raqamni nusxalash" }));
    await expect(navigator.clipboard.readText()).resolves.toBe("EL-100081");
    expect(await screen.findByText("Buyurtma raqami nusxalandi")).toBeInTheDocument();
  });

  it("`order_number` yo'q — zaxira «№81»", () => {
    const { order_number: _omit, ...legacy } = ORDER;
    void _omit;
    renderWithProviders(
      <DetailHeader orderId="81" order={normalizeOrderDetail(legacy)} layout="default" onBack={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("№81");
  });

  it("buyurtma hali yuklanmagan — URL'dagi «№81», nusxalash yo'q", () => {
    renderWithProviders(<DetailHeader orderId="81" order={null} layout="default" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("№81");
    expect(screen.queryByRole("button", { name: "Raqamni nusxalash" })).not.toBeInTheDocument();
  });
});
