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
    <ol>
      <TrackingTimelineItem event={{ ...base, ...event } as TrackingEvent} isLast context={{ marketName: "Kimdur Kimdur" }} />
    </ol>,
  );

describe("TrackingTimelineItem — marketga qaytarish", () => {
  it("⭐ initiate-return: \"Qaytarish so'raldi\" belgisi + kim boshlagani va SABABI (inglizcha xom izoh emas)", () => {
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
    // Holat o'zgarmagan (waiting → waiting): o'tish o'rnida amal nomi.
    expect(item).toHaveTextContent("Qaytarish so'raldi");
    expect(item).toHaveTextContent("Superadmin Bosh admin buyurtmani marketga qaytarishni boshladi. Sabab: Mijoz rad etdi");
    expect(item).not.toHaveTextContent("Return initiated");
  });

  it("⭐ mark-returned-to-market: jumla market nomi va usul bilan, o'tish «Kutilmoqda › Marketga topshirildi»", () => {
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
    // Ikonka nomi — amal, jumla — kim, qaysi marketga va qanday (MHA ruxsati — QR orqali).
    expect(screen.getByRole("img", { name: "Marketga topshirildi" })).toBeInTheDocument();
    expect(item).toHaveTextContent("Menejer Filial menejeri buyurtmani Kimdur Kimdurga topshirdi — QR orqali");
    expect(item).toHaveTextContent("Kutilmoqda");
    expect(item).toHaveTextContent("Marketga topshirildi");
    expect(item).not.toHaveTextContent("Returned To Market");
    expect(item).not.toHaveTextContent("QR tasdiq bilan");
  });

  it("⭐ qo'lda tasdiq: «qo'lda tasdiq — sabab» (`cancelled_market_handover_manual`), xom metadata ko'rinmaydi", () => {
    render({
      action: "cancelled_market_handover_manual",
      from_status: "cancelled",
      to_status: "returned_to_market",
      old_value: { status: "cancelled" },
      new_value: { status: "returned_to_market" },
      changed_by_role: "registrator",
      actor: { name: "Bobur Xolmatov", role: "registrator" },
      note: "Bekor qilingan order market 7ga QR buzilgani sabab qo'lda tasdiqlanib topshirildi: QR yirtilgan",
      metadata: { manual_override: true, manual_reason: "QR yirtilgan", market_id: "7" },
    });
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("Bobur Xolmatov buyurtmani Kimdur Kimdurga topshirdi — Qo'lda tasdiq — QR yirtilgan");
    expect(item).not.toHaveTextContent("Manual Override");
    expect(item).not.toHaveTextContent("true");
  });

  it("⭐ QR'siz market: «QR'siz (market sozlamasi)»", () => {
    render({
      from_status: "cancelled",
      to_status: "returned_to_market",
      old_value: { status: "cancelled" },
      new_value: { status: "returned_to_market" },
      note: "Bekor qilingan order market 7ga QR talab qilinmasdan topshirildi",
    });
    expect(screen.getByTestId("tracking-event")).toHaveTextContent("topshirdi — QR'siz (market sozlamasi)");
  });

  it("⭐ bekor pochtani qabul: joy nomi `metadata.destination_branch` dan («… (UR, ID: 12)» siz)", () => {
    render({
      action: "cancelled_post_received",
      from_status: "cancelled (sent)",
      to_status: "cancelled",
      changed_by_role: "manager",
      actor: { name: "Ravshan Ortiqov", role: "manager" },
      note: "Canceled order received by branch manager",
      metadata: {
        canceled_post_id: "2107",
        destination_branch: "Urgut filiali (UR, ID: 12)",
        source_branch: "Urgut filiali (UR, ID: 12)",
        received_by_hq: false,
      },
    });
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("Menejer Ravshan Ortiqov bekor qilingan buyurtmani qabul qildi — Urgut filiali");
    expect(item).not.toHaveTextContent("ID: 12");
  });

  it("bekor pochtani HQ qabul qildi — HQ nomi kontekstdan, bo'lmasa avvalgi jumla", () => {
    const event = {
      ...base,
      action: "cancelled_post_received",
      from_status: "cancelled (sent)",
      to_status: "cancelled",
      old_value: { status: "cancelled (sent)" },
      new_value: { status: "cancelled" },
      changed_by_role: "registrator",
      actor: { name: "Bobur Xolmatov", role: "registrator" },
      note: "Canceled order received by HQ and held for market handover",
      metadata: { destination_branch: null, received_by_hq: true },
    } as TrackingEvent;
    const first = renderWithProviders(
      <ol>
        <TrackingTimelineItem event={event} isLast context={{ hqName: "Toshkent HQ" }} />
      </ol>,
    );
    expect(screen.getByTestId("tracking-event")).toHaveTextContent("bekor qilingan buyurtmani qabul qildi — Toshkent HQ");
    first.unmount();
    renderWithProviders(
      <ol>
        <TrackingTimelineItem event={event} isLast />
      </ol>,
    );
    expect(screen.getByTestId("tracking-event")).toHaveTextContent("marketga topshirish uchun HQ'da qabul qildi");
  });

  it("⭐ filial registratori o'z filialida qabul qildi (`received_by_hq: false`) — HQ nomi emas, filial", () => {
    const event = {
      ...base,
      action: "cancelled_post_received",
      from_status: "cancelled (sent)",
      to_status: "cancelled",
      changed_by_role: "registrator",
      actor: { name: "Dilshod Karimov", role: "registrator" },
      old_value: { status: "cancelled (sent)" },
      new_value: { status: "cancelled" },
      note: "Canceled order received by branch",
      metadata: { destination_branch: "Urgut filiali (UR, ID: 12)", received_by_hq: false },
    } as TrackingEvent;
    renderWithProviders(
      <ol>
        <TrackingTimelineItem event={event} isLast context={{ hqName: "Toshkent HQ" }} />
      </ol>,
    );
    const item = screen.getByTestId("tracking-event");
    expect(item).toHaveTextContent("bekor qilingan buyurtmani qabul qildi — Urgut filiali");
    expect(item).not.toHaveTextContent("Toshkent HQ");
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
    expect(item).toHaveTextContent("Izoh: Mijoz telefonni ko'tarmadi");
  });
});
