import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BatchDetail } from "../../../entities/batch";
import { renderWithProviders } from "../../../test/test-utils";
import BatchPrintSheet from "./BatchPrintSheet";

const batch = (patch: Partial<BatchDetail> = {}): BatchDetail =>
  ({
    id: "172",
    token: "BTB-abc",
    from_branch: { id: "1", name: "Toshkent HQ", code: "1" },
    to_branch: { id: "2", name: "Samarqand filiali", region: "Samarqand" },
    direction: "forward",
    orders_count: 3,
    total_price: 840_000,
    status: "sent",
    created_at: "2026-10-23T09:15:00.000Z",
    orders: [],
    history: [],
    ...patch,
  }) as BatchDetail;

describe("BatchPrintSheet — 1mOjtOVC driver / vehicle lines", () => {
  it("prints driver name · phone and vehicle plate when the batch was sent with them", () => {
    renderWithProviders(
      <BatchPrintSheet
        batch={batch({ driver: "Aziz Rahimov", driver_phone: "+998901234567", vehicle_plate: "30 A 456 BC" })}
      />,
    );
    expect(screen.getByText("HAYDOVCHI:")).toBeInTheDocument();
    expect(screen.getByText(/^Aziz Rahimov · /)).toBeInTheDocument();
    expect(screen.getByText("AVTOMOBIL:")).toBeInTheDocument();
    expect(screen.getByText("30 A 456 BC")).toBeInTheDocument();
  });

  it("omits the lines when driver / vehicle are null (before dispatch)", () => {
    renderWithProviders(<BatchPrintSheet batch={batch()} />);
    expect(screen.getByText("JAMI:")).toBeInTheDocument();
    expect(screen.queryByText("HAYDOVCHI:")).not.toBeInTheDocument();
    expect(screen.queryByText("AVTOMOBIL:")).not.toBeInTheDocument();
  });
});
