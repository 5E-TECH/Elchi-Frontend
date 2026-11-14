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
    rollback_enabled: false,
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

  it("rollback_enabled: boolean — o'zi; maydon yo'q yoki boshqa tur (eski backend) — null (kalit o'chirilgan)", () => {
    const list = readCarrierAccounts({
      statusCode: 200,
      data: [
        { ...row, rollback_enabled: true },
        { ...row, id: "2", rollback_enabled: false },
        { ...row, id: "1", rollback_enabled: undefined },
        { ...row, id: "0", rollback_enabled: "true" },
      ],
    });
    expect(list.map((account) => account.rollback_enabled)).toEqual([true, false, null, null]);
    const { rollback_enabled: _omitted, ...withoutFlag } = row;
    void _omitted;
    expect(readUpdatedCarrier({ statusCode: 200, data: withoutFlag })?.rollback_enabled).toBeNull();
    expect(
      readUpdatedCarrier({ statusCode: 200, data: { ...row, rollback_enabled: true } })
        ?.rollback_enabled,
    ).toBe(true);
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
