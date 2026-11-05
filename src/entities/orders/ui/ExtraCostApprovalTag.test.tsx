import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { clearPendingExtraCostApproval, recordPendingExtraCostApproval } from "../extraCostApproval";
import { ExtraCostApprovalTag } from "./ExtraCostApprovalTag";

/**
 * GykuOz8f — ro'yxatdagi «Tasdiqqa yuborilgan» belgisi (`OrdersTable`): manba — buyurtmaning
 * `pending_extra_cost_approval` maydoni (server yutadi), maydon kelmagan eski javobda — shu qurilmadagi ishora.
 */

const SERVER = {
  id: "ap-1",
  action: "partly_sell",
  amount: 12000,
  created_at: "2026-11-05T09:15:00.000Z",
  auto_approve_at: null,
};

describe("ExtraCostApprovalTag (GykuOz8f)", () => {
  afterEach(() => clearPendingExtraCostApproval("o-1"));

  it("⭐ server obyekti — belgi va maslahatda amal, summa", () => {
    renderWithProviders(
      <ExtraCostApprovalTag order={{ id: "o-1", status: "waiting", pending_extra_cost_approval: SERVER }} />,
    );
    const badge = screen.getByText("Tasdiqqa yuborilgan");
    expect(badge.closest("[title]")).toHaveAttribute("title", expect.stringMatching(/^Qisman sotish: 12\D000 so'm/));
  });

  it("⭐ server `null` — shu qurilmadagi ishora bo'lsa ham belgi yo'q", () => {
    recordPendingExtraCostApproval({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: new Date().toISOString(),
      orderStatus: "waiting",
    });
    renderWithProviders(<ExtraCostApprovalTag order={{ id: "o-1", status: "waiting", pending_extra_cost_approval: null }} />);
    expect(screen.queryByText("Tasdiqqa yuborilgan")).not.toBeInTheDocument();
  });

  it("maydon kelmagan eski javob — ishora (holat o'zgarmagan bo'lsa)", () => {
    recordPendingExtraCostApproval({
      orderId: "o-1",
      action: "sell",
      amount: 5000,
      requestedAt: new Date().toISOString(),
      orderStatus: "waiting",
    });
    const view = renderWithProviders(<ExtraCostApprovalTag order={{ id: "o-1", status: "waiting" }} />);
    expect(screen.getByText("Tasdiqqa yuborilgan")).toBeInTheDocument();
    view.unmount();

    renderWithProviders(<ExtraCostApprovalTag order={{ id: "o-1", status: "sold" }} />);
    expect(screen.queryByText("Tasdiqqa yuborilgan")).not.toBeInTheDocument();
  });
});
