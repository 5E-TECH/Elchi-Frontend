import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { readFulfillmentSource } from "../model/fulfillment";
import { FulfillmentSourceTag } from "./FulfillmentSourceTag";

/** 6kHnNH9j: «Ombordan · <ombor>» — `fulfillment_source === "WAREHOUSE"` (ro'yxat va tafsilot). */
describe("FulfillmentSourceTag", () => {
  it("ombor nomi bilan; nomsiz — «Ombordan»; HQ / eski javob — hech narsa", () => {
    const view = renderWithProviders(
      <FulfillmentSourceTag order={{ fulfillment_source: "WAREHOUSE", warehouse: { id: 3, name: "Samarqand filiali ombori" } }} />,
    );
    expect(screen.getByTestId("fulfillment-source-badge")).toHaveTextContent("Ombordan · Samarqand filiali ombori");
    expect(screen.getByTestId("fulfillment-source-badge")).toHaveAttribute(
      "title",
      "Ombordan · Samarqand filiali ombori. Buyurtma viloyat omboridan ketadi — HQ va pochtasiz",
    );
    view.unmount();

    const unnamed = renderWithProviders(<FulfillmentSourceTag order={{ fulfillment_source: "warehouse", warehouse: null }} />);
    expect(screen.getByTestId("fulfillment-source-badge")).toHaveTextContent(/^Ombordan$/);
    unnamed.unmount();

    renderWithProviders(
      <>
        <FulfillmentSourceTag order={{ fulfillment_source: "HQ", warehouse: { id: 3, name: "X" } }} />
        <FulfillmentSourceTag order={{ id: "1" }} />
      </>,
    );
    expect(screen.queryByTestId("fulfillment-source-badge")).not.toBeInTheDocument();
  });

  it("readFulfillmentSource", () => {
    expect(readFulfillmentSource({ fulfillment_source: "WAREHOUSE", warehouse: { id: 3, name: " Urgut " } })).toEqual({
      fromWarehouse: true,
      warehouseId: "3",
      warehouseName: "Urgut",
      warehouseKind: null,
    });
    expect(readFulfillmentSource(null)).toEqual({
      fromWarehouse: false,
      warehouseId: null,
      warehouseName: null,
      warehouseKind: null,
    });
    // hfkhYrGk №4: `warehouse.kind` — Markaziy ombor (HQ) yoki viloyat ombori; HQ buyurtmasida — `null`.
    expect(readFulfillmentSource({ fulfillment_source: "WAREHOUSE", warehouse: { id: 1, kind: "HQ" } }).warehouseKind).toBe("HQ");
    expect(readFulfillmentSource({ fulfillment_source: "WAREHOUSE", warehouse: { id: 3, kind: "regional" } }).warehouseKind).toBe(
      "REGIONAL",
    );
    expect(readFulfillmentSource({ fulfillment_source: "HQ", warehouse: { id: 1, kind: "HQ" } }).warehouseKind).toBeNull();
  });
});
