import { describe, expect, it } from "vitest";
import {
  CarrierUnreadableResponseError,
  readCarrierAccounts,
  readCreatedCarrier,
  readRotatedKey,
  readUpdatedCarrier,
} from "./carriers";

/** `admin/carriers` javoblari — gateway `successRes` o'rami (`{ statusCode, message, data }`). */
describe("Carrier API akkauntlari — javob o'quvchilari", () => {
  const row = {
    id: "3",
    name: "FastPost Logistics",
    courier_user_id: "55",
    ip_allowlist: ["203.0.113.10", "198.51.100.0/24"],
    is_active: true,
    createdAt: "2026-11-09T10:15:00.000Z",
    updatedAt: "2026-11-10T09:40:00.000Z",
  };

  it("ro'yxat o'ramdan ochiladi; ip_allowlist null — cheklov yo'q", () => {
    const list = readCarrierAccounts({
      statusCode: 200,
      message: "carrier accounts",
      data: [row, { ...row, id: "1", ip_allowlist: null, is_active: false }],
    });
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(row);
    expect(list[1]).toMatchObject({ id: "1", ip_allowlist: null, is_active: false });
  });

  it("kutilmagan shakl — xato (bo'sh ro'yxat «hali yo'q» deb yolg'on ko'rsatilmaydi)", () => {
    expect(() => readCarrierAccounts({ statusCode: 200, data: { items: [] } })).toThrow();
  });

  it("yaratish javobi kalit bilan; kalitsiz javob — xato", () => {
    const created = readCreatedCarrier({
      statusCode: 201,
      data: { ...row, courier_name: "FastPost kuryeri", api_key: "elc_abc" },
    });
    expect(created.api_key).toBe("elc_abc");
    expect(created.courier_name).toBe("FastPost kuryeri");
    // Kalitsiz 2xx — maxsus xato: amal bajarilgan, kalit yetmagan («natija noma'lum» yo'li).
    expect(() => readCreatedCarrier({ statusCode: 201, data: row })).toThrow(
      CarrierUnreadableResponseError,
    );
  });

  it("PATCH javobi — saqlangan akkaunt (ro'yxat qatori shakli); kutilmagan shakl — null", () => {
    expect(
      readUpdatedCarrier({ statusCode: 200, message: "carrier account updated", data: row }),
    ).toEqual(row);
    expect(readUpdatedCarrier({ statusCode: 200, data: [row] })).toBeNull();
    expect(readUpdatedCarrier({ statusCode: 200, data: { name: "id yo'q" } })).toBeNull();
  });

  it("rotatsiya javobi", () => {
    expect(readRotatedKey({ statusCode: 200, data: { id: "3", api_key: "elc_new" } })).toEqual({
      id: "3",
      api_key: "elc_new",
    });
    expect(() => readRotatedKey({ statusCode: 200, data: { id: "3" } })).toThrow(
      CarrierUnreadableResponseError,
    );
  });
});
