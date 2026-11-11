import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import { ExtraCostRequestTag } from "./ExtraCostRequestTag";

/**
 * SPEC v2 — holat yonidagi «Xarajat kutilmoqda · 20 000 so'm» belgisi: buyurtma allaqachon sotilgan / bekor
 * qilingan, qo'shimcha xarajat alohida so'rov (`extra_cost_request`, `mode: "deferred"`). Ro'yxatda faqat
 * kutilayotgani, tafsilot va skanerda (`showDecided`) tasdiqlangan / rad etilgani ham; maslahatda — qaysi tovar uchun.
 */

const REQUEST = {
  id: "xc-1",
  status: "pending",
  mode: "deferred",
  action: "sell",
  amount: 20000,
  items: [
    { order_item_id: "i-1", product_id: "p-1", product_name: "Telefon g'ilofi", quantity: 1 },
    { order_item_id: "i-2", product_id: "p-2", product_name: "Zaryadka", quantity: 2 },
  ],
  auto_approve_at: null,
  created_at: "2026-11-12T09:00:00.000Z",
};

const tag = () => screen.queryByTestId("extra-cost-request-tag");

describe("ExtraCostRequestTag (SPEC v2)", () => {
  it("⭐ kutilayotgan kechiktirilgan xarajat — summa bilan, maslahatda tovarlar", () => {
    renderWithProviders(
      <ExtraCostRequestTag order={{ id: "o-1", status: "sold", extra_cost_request: REQUEST }} />,
    );
    expect(tag()).toHaveTextContent(/^Xarajat kutilmoqda · 20\D000 so'm$/);
    expect(tag()).toHaveAttribute("data-kind", "pending");
    expect(tag()).toHaveAttribute("title", "Qaysi mahsulot uchun: Telefon g'ilofi ×1, Zaryadka ×2");
  });

  it("ro'yxatda tasdiqlangan / rad etilgan — belgisiz; tafsilotda (`showDecided`) — bor", () => {
    const approved = { ...REQUEST, status: "approved" };
    const { unmount } = renderWithProviders(
      <ExtraCostRequestTag order={{ extra_cost_request: approved }} />,
    );
    expect(tag()).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <ExtraCostRequestTag order={{ extra_cost_request: approved }} showDecided />,
    );
    expect(tag()).toHaveTextContent(/^Xarajat tasdiqlangan · 20\D000 so'm$/);
  });

  it("⭐ tasdiqsiz market (`immediate: true`) — tafsilotda ham «Xarajat tasdiqlangan» belgisi yo'q", () => {
    renderWithProviders(
      <ExtraCostRequestTag
        order={{ status: "sold", extra_cost_request: { ...REQUEST, status: "approved", immediate: true } }}
        showDecided
      />,
    );
    expect(tag()).not.toBeInTheDocument();
    expect(screen.queryByText(/Xarajat tasdiqlangan/)).not.toBeInTheDocument();
  });

  it("rad etilgan (tafsilot) — «Xarajat rad etildi»", () => {
    renderWithProviders(
      <ExtraCostRequestTag
        order={{ extra_cost_request: { ...REQUEST, status: "rejected" } }}
        showDecided
      />,
    );
    expect(tag()).toHaveTextContent("Xarajat rad etildi");
    expect(tag()).toHaveAttribute("data-kind", "rejected");
  });

  it("⭐ eski (replay) kutilayotgan so'rov — belgisiz («Tasdiqqa yuborilgan» bor)", () => {
    renderWithProviders(
      <ExtraCostRequestTag
        order={{
          status: "waiting",
          extra_cost_request: { ...REQUEST, mode: "replay" },
          pending_extra_cost_approval: {
            id: "xc-1",
            action: "sell",
            amount: 20000,
            created_at: "",
            auto_approve_at: null,
          },
        }}
        showDecided
      />,
    );
    expect(tag()).not.toBeInTheDocument();
  });

  it("maydon yo'q yoki `null` — hech narsa", () => {
    renderWithProviders(
      <>
        <ExtraCostRequestTag order={{ id: "o-1" }} />
        <ExtraCostRequestTag order={{ id: "o-2", extra_cost_request: null }} showDecided />
        <ExtraCostRequestTag order={null} />
      </>,
    );
    expect(tag()).not.toBeInTheDocument();
  });
});
