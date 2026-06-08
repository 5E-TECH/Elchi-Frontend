import { describe, expect, it } from "vitest";
import {
  cleanAnalyticsParams,
  normalizeDashboardResponse,
  normalizeKpiResponse,
} from "./index";

describe("dashboard response normalization", () => {
  it("does not send empty date filters to analytics endpoints", () => {
    expect(cleanAnalyticsParams({ start_day: "", end_day: "" })).toBeUndefined();
    expect(cleanAnalyticsParams({ period: "daily", start_day: "" })).toEqual({
      period: "daily",
    });
  });

  it("normalizes numeric strings and snake_case dashboard fields", () => {
    const result = normalizeDashboardResponse({
      statusCode: 200,
      data: {
        orders: {
          accepted_count: "12",
          sold_and_paid: "5",
          cancelled_count: "2",
          profit: "480000",
        },
        top_markets: [
          {
            market_id: 7,
            market_name: "Market",
            total_orders: "10",
            successful_orders: "8",
            success_rate: "80",
          },
        ],
      },
    });

    expect(result.data.orders).toMatchObject({
      acceptedCount: 12,
      soldAndPaid: 5,
      cancelled: 2,
      profit: 480000,
    });
    expect(result.data.topMarkets?.[0]).toMatchObject({
      market_id: "7",
      total_orders: 10,
      successful_orders: 8,
      success_rate: 80,
    });
  });

  it("normalizes KPI fields", () => {
    const result = normalizeKpiResponse({
      data: {
        average_order_value: "96000",
        average_fulfillment_hours: "24.5",
        on_time_rate: "80",
      },
    });

    expect(result.data).toMatchObject({
      averageOrderValue: 96000,
      averageFulfillmentHours: 24.5,
      onTimeRate: 80,
    });
  });
});
