import { describe, expect, it } from "vitest";
import {
  canInitiateReturn,
  canMarkReturnedToMarket,
  extractMarketQrToken,
  readHandoverAuthorization,
} from "./orderReturnRules";

describe("canInitiateReturn — POST orders/:id/initiate-return", () => {
  it("⭐ superadmin / admin / registrator — waiting va waiting_customer da", () => {
    for (const role of ["superadmin", "admin", "registrator"]) {
      expect(canInitiateReturn(role, { status: "waiting" }), role).toBe(true);
      expect(canInitiateReturn(role, { status: "waiting_customer" }), role).toBe(true);
      expect(canInitiateReturn(role, { status: " WAITING " }), role).toBe(true);
    }
  });

  it("boshqa rollar — yo'q (backend 403)", () => {
    for (const role of ["manager", "courier", "market", "operator", "", null, undefined]) {
      expect(canInitiateReturn(role, { status: "waiting" }), String(role)).toBe(false);
    }
  });

  it("boshqa statuslar — yo'q", () => {
    for (const status of ["new", "received", "on the road", "sold", "paid", "cancelled", "returned_to_market"]) {
      expect(canInitiateReturn("admin", { status }), status).toBe(false);
    }
  });

  it("allaqachon so'ralgan bo'lsa — tugma takrorlanmaydi", () => {
    expect(canInitiateReturn("admin", { status: "waiting", return_requested: true })).toBe(false);
    expect(canInitiateReturn("admin", { status: "waiting", return_requested: false })).toBe(true);
    expect(canInitiateReturn("admin", null)).toBe(false);
  });
});

describe("canMarkReturnedToMarket — POST orders/:id/mark-returned-to-market", () => {
  const requested = { status: "waiting", return_requested: true };

  it("⭐ filial roli (manager, registrator) + return_requested === true", () => {
    expect(canMarkReturnedToMarket("manager", requested)).toBe(true);
    expect(canMarkReturnedToMarket("registrator", requested)).toBe(true);
    expect(canMarkReturnedToMarket("manager", { ...requested, status: "waiting_customer" })).toBe(true);
  });

  it("return_requested yo'q / false / \"true\" satr — yo'q", () => {
    expect(canMarkReturnedToMarket("manager", { status: "waiting" })).toBe(false);
    expect(canMarkReturnedToMarket("manager", { status: "waiting", return_requested: false })).toBe(false);
    expect(canMarkReturnedToMarket("manager", { status: "waiting", return_requested: "true" })).toBe(false);
  });

  it("filial bo'lmagan rollar — yo'q", () => {
    for (const role of ["superadmin", "admin", "courier", "market", "operator"]) {
      expect(canMarkReturnedToMarket(role, requested), role).toBe(false);
    }
  });

  it("sotilgan / to'langan / allaqachon qaytarilgan — yo'q (backend rad etadi)", () => {
    for (const status of ["sold", "paid", "partly_paid", "returned_to_market"]) {
      expect(canMarkReturnedToMarket("manager", { status, return_requested: true }), status).toBe(false);
    }
  });
});

describe("market QR va ruxsat", () => {
  it("⭐ MCR- token registri SAQLANADI (base64url — backend hash'i registrga sezgir)", () => {
    expect(extractMarketQrToken("  MCR-AbC_xYz-09  ")).toBe("MCR-AbC_xYz-09");
    expect(extractMarketQrToken("https://elchi.uz/scan/MCR-AbC_xYz")).toBe("MCR-AbC_xYz");
  });

  it("market QR bo'lmasa — bo'sh", () => {
    expect(extractMarketQrToken("ORD-123")).toBe("");
    expect(extractMarketQrToken("MHA-abc")).toBe("");
    expect(extractMarketQrToken("")).toBe("");
  });

  it("scan/market-cancelled javobidan authorization_token", () => {
    expect(readHandoverAuthorization({ type: "market_cancelled_handover", data: { authorization_token: "MHA-x" } })).toBe(
      "MHA-x",
    );
    expect(readHandoverAuthorization({ data: { data: { authorization_token: "MHA-y" } } })).toBe("MHA-y");
    expect(readHandoverAuthorization({ data: {} })).toBe("");
    expect(readHandoverAuthorization(null)).toBe("");
  });
});
