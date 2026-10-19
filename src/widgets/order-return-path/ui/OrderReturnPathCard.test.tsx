import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { ReturnPath, ReturnPathStep } from "../model/returnPath";
import { OrderReturnPathCard } from "./OrderReturnPathCard";

/** «Qaytarish yo'li» kartasi — maketlar `superadmin|manager|market-orders-detail-cancelled`. */

const step = (fields: Partial<ReturnPathStep> & Pick<ReturnPathStep, "kind">): ReturnPathStep => ({
  id: fields.kind,
  at: "2026-10-06T16:40:00+05:00",
  actor: null,
  role: null,
  place: null,
  to: null,
  postId: null,
  reason: null,
  market: null,
  handover: null,
  ...fields,
});

const CLOSED: ReturnPath = {
  stage: "market",
  closed: true,
  pending: null,
  currentPlace: null,
  market: "Baraka Shop",
  steps: [
    step({
      kind: "cancelled",
      actor: "Akmal Rahimov",
      role: "courier",
      place: "Chilonzor tumani",
      reason: "CUSTOMER_NO_ANSWER",
    }),
    step({
      kind: "sent",
      actor: "Akmal Rahimov",
      role: "courier",
      to: "Toshkent HQ",
      postId: "2098",
    }),
    step({ kind: "received", actor: "Bobur Xolmatov", role: "registrator", place: "Toshkent HQ" }),
    step({
      kind: "handed",
      actor: "Bobur Xolmatov",
      role: "registrator",
      place: "Toshkent HQ",
      market: "Baraka Shop",
      handover: { method: "qr", reason: null },
    }),
  ],
};

describe("OrderReturnPathCard", () => {
  it("yopilgan zanjir: 4 qadam, maketdagi matnlar, usul belgisi; kutilayotgan qadam yo'q", () => {
    renderWithProviders(<OrderReturnPathCard path={CLOSED} />);
    const card = screen.getByTestId("order-return-path");
    expect(within(card).getByRole("heading", { name: "Qaytarish yo'li" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Zanjir yopildi — posilka marketga qaytdi");

    const steps = within(card).getAllByTestId("return-path-step");
    expect(steps.map((item) => item.getAttribute("data-kind"))).toEqual([
      "cancelled",
      "sent",
      "received",
      "handed",
    ]);
    expect(steps[0]).toHaveTextContent("Bekor qilindi");
    expect(steps[0]).toHaveTextContent("Kuryer Akmal Rahimov · Chilonzor tumani");
    expect(steps[0]).toHaveTextContent("Sabab: Mijoz javob bermadi");
    expect(steps[1]).toHaveTextContent("Kuryer Akmal Rahimov → Toshkent HQ");
    expect(within(steps[1]).getByText("Pochta №2098")).toBeInTheDocument();
    expect(steps[2]).toHaveTextContent("Toshkent HQ · Ro'yxatchi Bobur Xolmatov");
    expect(steps[3]).toHaveTextContent("Toshkent HQ · Ro'yxatchi Bobur Xolmatov → Baraka Shop");
    expect(within(steps[3]).getByTestId("return-path-method")).toHaveTextContent("QR orqali");
    expect(screen.getByRole("img", { name: "Marketga topshirildi" })).toBeInTheDocument();
    expect(within(card).queryByTestId("return-path-pending")).toBeNull();
    expect(within(card).queryByRole("link", { name: "QR kodni ochish" })).toBeNull();
  });

  it("ochiq zanjir: «Marketga topshirish» kutilmoqda, filialda — «yoki HQ'ga jo'natilishi»", () => {
    renderWithProviders(
      <OrderReturnPathCard
        path={{
          stage: "branch",
          closed: false,
          market: "Nur Elektronika",
          currentPlace: "Samarqand filiali",
          pending: { kind: "handover", place: "Samarqand filiali", days: 2, atBranch: true },
          steps: [step({ kind: "cancelled", actor: "Jasur Tursunov", role: "courier" })],
        }}
      />,
    );
    const card = screen.getByTestId("order-return-path");
    expect(card).toHaveTextContent("Kuryerdan marketgacha — oxirgi qadam kutilmoqda");
    const pending = within(card).getByTestId("return-path-pending");
    expect(pending).toHaveAttribute("aria-current", "step");
    expect(pending).toHaveTextContent("Marketga topshirish");
    expect(pending).toHaveTextContent(
      "Nur Elektronika olib ketishi yoki HQ'ga jo'natilishi kutilmoqda · Samarqand filiali · 2 kun",
    );
  });

  it("market ko'rinishi: «Posilka hozir: …», «Olib ketishingiz kutilmoqda», QR havolasi", () => {
    renderWithProviders(
      <OrderReturnPathCard
        marketView
        qrHref="/new-orders/cancelled/m7"
        path={{
          stage: "hq",
          closed: false,
          market: "Baraka Shop",
          currentPlace: "Toshkent HQ",
          pending: { kind: "handover", place: "Toshkent HQ", days: 3, atBranch: false },
          steps: [],
        }}
      />,
    );
    const card = screen.getByTestId("order-return-path");
    expect(card).toHaveTextContent("Posilka hozir: Toshkent HQ — olib ketishingiz mumkin");
    expect(within(card).getByTestId("return-path-pending")).toHaveTextContent(
      "Olib ketishingiz kutilmoqda · Toshkent HQ · 3 kun",
    );
    expect(card).toHaveTextContent("Olib ketishda xodimga QR kodni ko'rsating.");
    expect(within(card).getByRole("link", { name: "QR kodni ochish" })).toHaveAttribute(
      "href",
      "/new-orders/cancelled/m7",
    );
  });

  it("tarix yuklanmasa — xato matni va «Qayta urinish», bosqich qadami baribir", () => {
    renderWithProviders(
      <OrderReturnPathCard
        isError
        onRetry={() => undefined}
        path={{
          stage: "in_transit",
          closed: false,
          market: null,
          currentPlace: null,
          pending: { kind: "receive", place: "Toshkent HQ", days: null, atBranch: false },
          steps: [],
        }}
      />,
    );
    expect(screen.getByText("Qaytarish yo'lini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta urinish" })).toBeInTheDocument();
    expect(screen.getByTestId("return-path-pending")).toHaveTextContent(
      "Toshkent HQ qabul qilishi kutilmoqda",
    );
  });
});
