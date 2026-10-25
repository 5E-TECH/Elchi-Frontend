import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  cancelStageMetaFor,
  isWarehouseReturn,
  OrderStatusBadge,
  readCancelHandoverInfo,
  type TrackingEvent,
} from "../../entities/order";
import i18n from "../../i18n";
import uzStatus from "../../locales/uz/status.json";
import ruStatus from "../../locales/ru/status.json";
import enStatus from "../../locales/en/status.json";
import uzOrders from "../../locales/uz/orders.json";
import ruOrders from "../../locales/ru/orders.json";
import enOrders from "../../locales/en/orders.json";
import { renderWithProviders } from "../../test/test-utils";
import { buildReturnPath } from "../../widgets/order-return-path/model/returnPath";
import { describeTrackingEvent } from "./model/describeTrackingEvent";
import { TrackingTimelineItem } from "./ui/TrackingTimelineItem";

/**
 * 6kHnNH9j (backend Elchi-Backend#568): ombor buyurtmasi bekor bo'lib, posilka ombor filialiga qaytib qabul qilinsa —
 * `status: returned_to_market`, `holder_type: MARKET`, tracking `action: warehouse_returned`. Ko'rinishi «Marketga
 * topshirildi» emas, «Omborga qaytdi»: ro'yxat / tafsilot belgisi, «Hozir kimda», tarix va «Qaytarish yo'li».
 */

const WAREHOUSE_ORDER = {
  id: "10244",
  status: "returned_to_market",
  holder_type: "MARKET",
  fulfillment_source: "WAREHOUSE",
  warehouse: { id: "3", name: "Samarqand filiali ombori", branch_id: "11" },
  branch: { id: "11", name: "Samarqand filiali" },
};
const HQ_ORDER = { ...WAREHOUSE_ORDER, fulfillment_source: "HQ", warehouse: null };

const RETURN_EVENT = {
  id: "t9",
  order_id: "10244",
  action: "warehouse_returned",
  from_status: "cancelled",
  to_status: "returned_to_market",
  old_value: { status: "cancelled" },
  new_value: { status: "returned_to_market" },
  changed_by: "31",
  changed_by_role: "manager",
  actor: { name: "Dilshod Usmonov", role: "manager" },
  description: "Omborga qaytarildi",
  note: "Ombor buyurtmasi omborga qaytarildi — qoldiq tiklandi (HQ qaytarish oqimisiz)",
  metadata: { warehouse_id: "3" },
  created_at: "2026-10-25T12:30:00+05:00",
} as unknown as TrackingEvent;

describe("ombor buyurtmasi omborga qaytdi — model", () => {
  it("isWarehouseReturn / cancelStageMetaFor: faqat WAREHOUSE + yakuniy bosqich", () => {
    expect(isWarehouseReturn(WAREHOUSE_ORDER)).toBe(true);
    expect(isWarehouseReturn(HQ_ORDER)).toBe(false);
    expect(isWarehouseReturn({ ...WAREHOUSE_ORDER, status: "cancelled", holder_type: "BRANCH" })).toBe(false);
    expect(cancelStageMetaFor(WAREHOUSE_ORDER, "market").labelKey).toBe("cancelStage.warehouse");
    expect(cancelStageMetaFor(HQ_ORDER, "market").labelKey).toBe("cancelStage.market");
  });

  it("`warehouse_returned` — marketga topshirish hodisasi EMAS (usul yo'q)", () => {
    expect(readCancelHandoverInfo(RETURN_EVENT)).toBeNull();
  });
});

describe("ombor buyurtmasi omborga qaytdi — belgilar", () => {
  it("ro'yxat / tafsilot belgisi: «Omborga qaytdi»; HQ buyurtmasida — «Marketga topshirildi»", () => {
    renderWithProviders(
      <>
        <span data-testid="warehouse">
          <OrderStatusBadge status="returned_to_market" order={WAREHOUSE_ORDER} />
        </span>
        <span data-testid="hq">
          <OrderStatusBadge status="returned_to_market" order={HQ_ORDER} />
        </span>
      </>,
    );
    expect(within(screen.getByTestId("warehouse")).getByText("Omborga qaytdi")).toBeInTheDocument();
    expect(screen.getByTestId("warehouse").querySelector("[data-cancel-stage]")).toHaveAttribute("data-cancel-stage", "warehouse");
    expect(within(screen.getByTestId("hq")).getByText("Marketga topshirildi")).toBeInTheDocument();
  });

  it("uz / ru / en matnlari", () => {
    for (const [status, orders, label] of [
      [uzStatus, uzOrders, "Omborga qaytdi"],
      [ruStatus, ruOrders, "Возвращён на склад"],
      [enStatus, enOrders, "Returned to warehouse"],
    ] as const) {
      expect(status.cancelStage.warehouse).toBe(label);
      expect(orders.tracking.action.warehouseReturned).toBe(label);
      expect(orders.returnPath.step.warehouse).toBe(label);
      expect(orders.tracking.dynamic.warehouseReturnedByActor).toContain("{{actor}}");
      expect(orders.returnPath.subtitleClosedWarehouse.length).toBeGreaterThan(0);
    }
  });
});

describe("ombor buyurtmasi omborga qaytdi — tarix va qaytarish yo'li", () => {
  it("tarix yozuvi: amal «Omborga qaytdi», jumla, holat belgisi «Omborga qaytdi» (xom izoh emas)", () => {
    const view = describeTrackingEvent(RETURN_EVENT, i18n.getFixedT("uz", "orders"));
    expect(view.actionName).toBe("Omborga qaytdi");
    expect(view.warehouseReturn).toBe(true);
    expect(view.note).toBe("");

    renderWithProviders(
      <ol>
        <TrackingTimelineItem event={RETURN_EVENT} isLast />
      </ol>,
    );
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("posilkani qabul qildi — mahsulot omborga qaytdi, qoldiq tiklandi");
    expect(within(item).getByText("Omborga qaytdi")).toBeInTheDocument();
    expect(within(item).queryByText("Marketga topshirildi")).not.toBeInTheDocument();
    expect(item).not.toHaveTextContent("HQ qaytarish oqimisiz");
  });

  it("«Qaytarish yo'li»: kuryer bekor → filialga → filial qabul → «Omborga qaytdi» (marketga topshirish qadami yo'q)", () => {
    const events = [
      { ...RETURN_EVENT },
      {
        id: "t8",
        action: "cancelled_post_received",
        from_status: "cancelled (sent)",
        to_status: "cancelled",
        old_value: { status: "cancelled (sent)" },
        new_value: { status: "cancelled" },
        changed_by_role: "manager",
        actor: { name: "Dilshod Usmonov", role: "manager" },
        metadata: { destination_branch: "Samarqand filiali (SM, ID: 11)", received_by_hq: false },
        created_at: "2026-10-25T12:29:00+05:00",
      },
      {
        id: "t7",
        action: "status_change",
        from_status: "waiting",
        to_status: "cancelled",
        old_value: { status: "waiting" },
        new_value: { status: "cancelled" },
        changed_by_role: "courier",
        actor: { name: "Jasur Tursunov", role: "courier" },
        created_at: "2026-10-25T10:00:00+05:00",
      },
    ] as unknown as TrackingEvent[];
    const path = buildReturnPath(events, WAREHOUSE_ORDER);
    expect(path?.steps.map((step) => step.kind)).toEqual(["cancelled", "received", "warehouse"]);
    expect(path?.steps.at(-1)?.place).toBe("Samarqand filiali");
    expect(path?.closed).toBe(true);
    expect(path?.closedToWarehouse).toBe(true);
    expect(path?.pending).toBeNull();
  });
});
