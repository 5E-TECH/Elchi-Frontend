import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readOrderReplacement } from "../../../../entities/order";
import { renderWithProviders } from "../../../../test/test-utils";
import { DetailAlerts } from "./DetailAlerts";
import { buildActionOrder, normalizeOrderDetail } from "./orderDetailModel";

/** lQjt6sKP — buyurtma tafsiloti: almashtirish banneri va sotish oynasiga (tafsilot, skan) ketadigan maydonlar. */

const renderAlerts = (order: unknown, layout: "default" | "market" | "courier" = "default") =>
  renderWithProviders(
    <DetailAlerts
      layout={layout}
      pendingApproval={null}
      productsLocked={false}
      destinationLocked={false}
      canEditCustomer={false}
      parentOrderId={null}
      replacement={readOrderReplacement(order)}
    />,
  );

describe("DetailAlerts — almashtirish banneri", () => {
  it("⭐ yangi buyurtma (eski mahsulot olinmagan) — «Eski №EL-… o'rniga» + eski buyurtmaga havola", () => {
    renderAlerts({ replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" });
    const banner = screen.getByTestId("order-replacement-banner");
    expect(banner).toHaveTextContent("Almashtirish buyurtmasi");
    expect(banner).toHaveTextContent("Eski №EL-100081 o'rniga.");
    expect(within(banner).getByRole("link", { name: "Eski buyurtmani ochish" })).toHaveAttribute("href", "/orders/edit/81");
  });

  it("kuryerda havola yo'q (eski buyurtma kuryerga 403)", () => {
    renderAlerts({ replacement_of_order_id: "81", replacement_state: "awaiting_old_pickup" }, "courier");
    expect(screen.getByTestId("order-replacement-banner")).toHaveTextContent("Eski №EL-100081 o'rniga.");
    expect(screen.queryByRole("link", { name: "Eski buyurtmani ochish" })).toBeNull();
  });

  it("eski buyurtma — «Almashtirish qaytarmasi» va holat", () => {
    renderAlerts({ is_replacement_return: true, replacement_state: "awaiting_old_pickup" });
    expect(screen.getByTestId("order-replacement-return-banner")).toHaveTextContent(
      "Almashtirish qaytarmasi Eski mahsulot — kuryer mijozdan olishi kerak",
    );
  });

  it("oddiy buyurtma — hech narsa", () => {
    const { container } = renderAlerts({ id: "5" });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("buildActionOrder — almashtirish maydonlari (tafsilot va menejer skani)", () => {
  it("sotish oynasi darvozasi uchun maydonlar o'tadi", () => {
    const action = buildActionOrder(
      normalizeOrderDetail({
        id: "120",
        status: "waiting",
        items: [],
        replacement_of_order_id: "81",
        replacement_state: "awaiting_old_pickup",
        old_item_collected_at: null,
      }),
    );
    expect(action).toMatchObject({
      replacement_of_order_id: "81",
      replacement_state: "awaiting_old_pickup",
      old_item_collected_at: null,
    });
  });

  it("oddiy buyurtmada — null", () => {
    expect(buildActionOrder(normalizeOrderDetail({ id: "1", status: "waiting", items: [] }))).toMatchObject({
      replacement_of_order_id: null,
      replacement_state: null,
    });
  });
});
