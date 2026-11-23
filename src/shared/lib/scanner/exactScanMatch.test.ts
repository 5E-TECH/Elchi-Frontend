import { describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import {
  findExactScannedRow,
  isScanLookupNotFound,
  scanLookupFailureReason,
  scannedOrderId,
  scannedOrderKeys,
  unwrapScannedOrder,
} from "./exactScanMatch";

const t = i18n.getFixedT("uz");

/** Skan auditi 2026-11-23 (#46, #54, #48, #56): skan faqat AYNAN o'sha buyurtmaga; qidiruv xatosi «topilmadi» emas. */
describe("findExactScannedRow — faqat aniq moslik", () => {
  const rowA = { id: "101", qr_code_token: "aaaaaaaaaaaaaaaaaaaaaa01", customer: { id: "c-1", name: "Ali" }, market: { id: "m-1" } };
  const rowB = { id: "102", qr_code_token: "aaaaaaaaaaaaaaaaaaaaaa02", customer: { id: "c-1", name: "Ali" }, market: { id: "m-1" } };

  it("id yoki QR token (katta-kichik harf farqsiz) bo'yicha", () => {
    expect(findExactScannedRow([rowA, rowB], scannedOrderKeys({ id: "102" }))).toBe(rowB);
    expect(findExactScannedRow([rowA, rowB], scannedOrderKeys({ qr_code_token: "AAAAAAAAAAAAAAAAAAAAAA01" }))).toBe(rowA);
    expect(findExactScannedRow([rowA, rowB], scannedOrderKeys({}, ["aaaaaaaaaaaaaaaaaaaaaa02"]))).toBe(rowB);
  });

  it("bir xil mijoz + market, lekin boshqa buyurtma — TANLANMAYDI (o'xshash moslik yo'q)", () => {
    const scanned = { id: "999", customer: { id: "c-1", name: "Ali" }, market: { id: "m-1" } };
    expect(findExactScannedRow([rowA], scannedOrderKeys(scanned))).toBeUndefined();
  });

  it("qator skanerlangan buyurtmadan ajralgan (ota id) — o'sha qator; ikkita bo'lsa noaniq — hech biri", () => {
    const child = { id: "201", parent_order_id: "200" };
    const courierChild = { id: "202", partial_parent_order_id: "300" };
    expect(findExactScannedRow([rowA, child], scannedOrderKeys({ id: "200" }))).toBe(child);
    expect(findExactScannedRow([courierChild], scannedOrderKeys({ id: "300" }))).toBe(courierChild);
    expect(findExactScannedRow([child, { id: "203", parent_order_id: "200" }], scannedOrderKeys({ id: "200" }))).toBeUndefined();
  });

  it("aka-uka (bir otaning boshqa bolasi) — tanlanmaydi", () => {
    const sibling = { id: "201", parent_order_id: "200" };
    expect(findExactScannedRow([sibling], scannedOrderKeys({ id: "205", parent_order_id: "200" }))).toBeUndefined();
  });

  it("unwrapScannedOrder / scannedOrderId — global o'ram va ichki `order`", () => {
    expect(unwrapScannedOrder({ statusCode: 200, data: { id: "5", status: "cancelled" } })).toEqual({ id: "5", status: "cancelled" });
    expect(unwrapScannedOrder({ data: { data: { order: { id: 6 } } } })).toEqual({ id: 6 });
    expect(scannedOrderId({ id: 6 })).toBe("6");
    expect(scannedOrderId({})).toBe("");
  });
});

describe("scanLookupFailureReason — «topilmadi» emas", () => {
  const texts = { tooMany: "So'rovlar juda ko'p" };

  it("404 — haqiqiy «topilmadi»; boshqasi — yo'q", () => {
    expect(isScanLookupNotFound({ response: { status: 404 } })).toBe(true);
    expect(isScanLookupNotFound({ response: { status: 502 } })).toBe(false);
  });

  it("tarmoq, vaqt, 5xx, 429 — sabab matni", () => {
    expect(scanLookupFailureReason(t, { isAxiosError: true, code: "ERR_NETWORK", request: {} }, texts)).toBe("Internet aloqasi yo'q");
    expect(scanLookupFailureReason(t, { code: "ECONNABORTED", message: "timeout of 20000ms exceeded" }, texts)).toBe(
      "Server javob bermadi. Birozdan keyin qayta urinib ko'ring.",
    );
    expect(scanLookupFailureReason(t, { response: { status: 502, data: {} } }, texts)).toBe(
      "Server xatosi (502). Birozdan keyin qayta urinib ko'ring.",
    );
    expect(scanLookupFailureReason(t, { response: { status: 429, data: { message: "ThrottlerException" } } }, texts)).toBe(
      "So'rovlar juda ko'p",
    );
    expect(scanLookupFailureReason(t, { response: { status: 400, data: { message: "Token noto'g'ri" } } }, texts)).toBe(
      "Token noto'g'ri",
    );
  });
});
