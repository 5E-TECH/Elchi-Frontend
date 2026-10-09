import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import { TrackingTimelineItem } from "./TrackingTimelineItem";
import type { TrackingEvent } from "../../../entities/order";

/**
 * Marketga qaytarish hodisalari buyurtma tarixida — backend yozganidek:
 * initiate-return → `action: "note"`, holat o'zgarmaydi, izoh "Return initiated: <sabab>";
 * mark-returned-to-market → `action: "returned_to_market"`, waiting → returned_to_market.
 */
const base = {
  id: "t1",
  order_id: "96",
  changed_by: "1",
  changed_by_role: "superadmin",
  actor: { name: "Bosh admin", role: "superadmin" },
  created_at: "2026-10-09T08:00:00.000Z",
};

const render = (event: Partial<TrackingEvent>) =>
  renderWithProviders(
    <TrackingTimelineItem
      event={{ ...base, ...event } as TrackingEvent}
      index={0}
      total={1}
      isLast
      context={{ marketName: "Kimdur Kimdur" }}
    />,
  );

describe("TrackingTimelineItem — marketga qaytarish", () => {
  it("⭐ initiate-return: \"Qaytarish so'raldi\" + kim boshlagani va SABABI (inglizcha xom izoh emas)", () => {
    render({
      action: "note",
      from_status: "waiting",
      to_status: "waiting",
      old_value: { status: "waiting" },
      new_value: { status: "waiting" },
      note: "Return initiated: Mijoz rad etdi",
      description: "Return initiated: Mijoz rad etdi",
    });
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("Qaytarish so'raldi");
    expect(item).toHaveTextContent("Bosh admin buyurtmani marketga qaytarishni boshladi. Sabab: Mijoz rad etdi");
    expect(item).not.toHaveTextContent("Return initiated");
  });

  it("⭐ mark-returned-to-market: \"Marketga qaytarildi\" + market nomi, holat tarjima qilingan", () => {
    render({
      action: "returned_to_market",
      from_status: "waiting",
      to_status: "returned_to_market",
      old_value: { status: "waiting" },
      new_value: { status: "returned_to_market" },
      changed_by_role: "manager",
      actor: { name: "Filial menejeri", role: "manager" },
      note: "Xodim 501 market egasiga topshirdi",
    });
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("Marketga qaytarildi");
    expect(item).toHaveTextContent("Filial menejeri buyurtmani Kimdur Kimdurga QR tasdiq bilan topshirdi");
    expect(item).toHaveTextContent("Marketga qaytarilgan");
    expect(item).not.toHaveTextContent("Returned To Market");
  });

  it("boshqa izohli hodisalar avvalgidek (qaytarish deb belgilanmaydi)", () => {
    render({
      action: "note",
      from_status: "waiting",
      to_status: "waiting",
      note: "Mijoz telefonni ko'tarmadi",
    });
    const item = screen.getByTestId("tracking-event");
    expect(item).not.toHaveTextContent("Qaytarish so'raldi");
    expect(item).toHaveTextContent("Mijoz telefonni ko'tarmadi");
  });
});
