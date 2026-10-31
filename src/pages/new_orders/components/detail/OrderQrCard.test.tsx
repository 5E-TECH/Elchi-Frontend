import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { OrderQrCard } from "./OrderQrCard";
import type { OrderDetail } from "./orderDetailModel";

const order = (qr_code_token: string | null | undefined) =>
  ({ id: "95", order_number: "EL-100095", qr_code_token }) as unknown as OrderDetail;

describe("OrderQrCard (TzfF0bmQ)", () => {
  it("token bor — karta, buyurtma raqami va QR", async () => {
    renderWithProviders(<OrderQrCard order={order("5c0c4c27af78467d451a027e")} />);
    expect(screen.getByRole("heading", { name: "QR kod" })).toBeInTheDocument();
    expect(screen.getByText("№EL-100095")).toBeInTheDocument();
    expect(
      await screen.findByRole("img", { name: "№EL-100095 buyurtmasining QR kodi" }),
    ).toBeInTheDocument();
  });

  it.each([[null], [undefined], [""], ["   "]])("token %j — karta chizilmaydi", (token) => {
    const { container } = renderWithProviders(<OrderQrCard order={order(token)} />);
    expect(container.querySelector("section, h2, h3")).toBeNull();
    expect(screen.queryByRole("heading", { name: "QR kod" })).not.toBeInTheDocument();
  });
});
