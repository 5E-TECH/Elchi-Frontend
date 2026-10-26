import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import DeliveryQualityCard from "./DeliveryQualityCard";

const kpi = (overrides: Record<string, unknown> = {}) => ({
  averageOrderValue: 0,
  averageFulfillmentHours: 0,
  onTimeRate: 0,
  cancellationRate: 0,
  courierEfficiency: 0,
  marketRating: [],
  ...overrides,
});

const render = (data: ReturnType<typeof kpi>, previous?: ReturnType<typeof kpi>) =>
  renderWithProviders(
    <DeliveryQualityCard description="Bugun" kpi={data} previous={previous} loading={false} accepted={0} cancelled={0} />,
  );

describe("DeliveryQualityCard — SLA (yrLt5oMi)", () => {
  it("davrda yetkazish yo'q — «—» va «O'lchanmagan», «0%» va delta emas", () => {
    render(kpi({ deliveryCount: 0 }), kpi({ onTimeRate: 80, deliveryCount: 10 }));

    expect(screen.getByText("O'lchanmagan — bu davrda yetkazish yo'q")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("24 soat ichida")).toBeNull();
  });

  it("yetkazish bor yoki backend son bermagan — avvalgidek foiz va izoh", () => {
    render(kpi({ onTimeRate: 82.6, deliveryCount: 14 }));
    expect(screen.getByText("82,6%")).toBeInTheDocument();
    expect(screen.getByText("24 soat ichida")).toBeInTheDocument();
    expect(screen.queryByText(/O'lchanmagan/)).toBeNull();
  });
});
