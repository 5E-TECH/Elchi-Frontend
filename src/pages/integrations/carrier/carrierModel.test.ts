import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  CarrierUnreadableResponseError,
  type CarrierAccount,
} from "../../../entities/integrations/carriers";
import {
  accountState,
  classifyCarrierError,
  courierEligibility,
  initialsOf,
  keyBlocked,
  toCarrierCourier,
  type CarrierCourier,
} from "./carrierModel";
import { readCourierReceivable } from "./useCarrierCouriers";

const account = (patch: Partial<CarrierAccount> = {}): CarrierAccount => ({
  id: "3",
  name: "FastPost Logistics",
  courier_user_id: "55",
  ip_allowlist: null,
  is_active: true,
  createdAt: "2026-11-09T10:15:00.000Z",
  updatedAt: "2026-11-10T09:40:00.000Z",
  ...patch,
});

const courier = (patch: Partial<CarrierCourier> = {}): CarrierCourier => ({
  id: "55",
  name: "FastPost kuryeri",
  phone: "+998909774040",
  status: "active",
  branch: { id: "1", name: "Toshkent HQ" },
  tariffHome: 30000,
  tariffCenter: 25000,
  ...patch,
});

const httpError = (status: number | undefined, message?: string) => {
  const error = new AxiosError("fail");
  if (status) {
    error.response = {
      status,
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: message ? { statusCode: status, message } : {},
    };
  }
  return error;
};

describe("accountState — maketdagi holatlar", () => {
  it("faol akkaunt + faol kuryer → «Faol»", () => {
    expect(accountState(account(), { state: "ready", courier: courier() })).toBe("active");
  });

  it("is_active false → «To'xtatilgan»", () => {
    expect(
      accountState(account({ is_active: false }), { state: "ready", courier: courier() }),
    ).toBe("stopped");
  });

  it("faol akkaunt, kuryer bloklangan → «Kuryer nofaol» va kalit ishlamaydi", () => {
    const state = accountState(account(), {
      state: "ready",
      courier: courier({ status: "blocked" }),
    });
    expect(state).toBe("courierInactive");
    expect(keyBlocked(state)).toBe(true);
  });

  it("kuryer o'chirilgan (404) → «Kuryer topilmadi» (to'xtatilgan bo'lsa ham)", () => {
    expect(accountState(account(), { state: "missing" })).toBe("courierMissing");
    expect(accountState(account({ is_active: false }), { state: "missing" })).toBe(
      "courierMissing",
    );
  });

  it("kuryer ma'lumoti hali kelmagan yoki xato — faqat akkaunt holati", () => {
    expect(accountState(account(), { state: "loading" })).toBe("active");
    expect(accountState(account(), { state: "error" })).toBe("active");
    expect(accountState(account(), undefined)).toBe("active");
  });
});

describe("courierEligibility — frontend biladigan qoidalar", () => {
  const accounts = [
    account(),
    account({ id: "1", name: "Vodiy Kargo", courier_user_id: "77", is_active: false }),
  ];

  it("bog'lanmagan faol kuryer — tanlash mumkin (HQ bo'lmasa ham)", () => {
    expect(
      courierEligibility(
        courier({ id: "90", branch: { id: "9", name: "Samarqand filiali" } }),
        accounts,
      ),
    ).toEqual({ ok: true });
  });

  it("yoqiq akkauntga bog'langan kuryer — o'chirilgan, akkaunt bilan", () => {
    expect(courierEligibility(courier(), accounts)).toEqual({
      ok: false,
      reason: "bound",
      account: accounts[0],
    });
  });

  it("to'xtatilgan akkauntga bog'langan kuryer ham bo'shamaydi", () => {
    const result = courierEligibility(courier({ id: "77" }), accounts);
    expect(result).toMatchObject({ ok: false, reason: "bound" });
  });

  it("nofaol kuryer — «Nofaol»", () => {
    expect(courierEligibility(courier({ id: "91", status: "inactive" }), accounts)).toEqual({
      ok: false,
      reason: "inactive",
    });
  });
});

describe("classifyCarrierError — backend kod bermaydi, status + matn", () => {
  it("409 → kuryer band", () => {
    expect(
      classifyCarrierError(
        httpError(409, 'Bu kurier allaqachon "X" carrier akkauntiga bog\'langan'),
      ),
    ).toBe("busy");
  });

  it("400 / 404 kuryer matni → kuryer tekshiruvi", () => {
    expect(classifyCarrierError(httpError(400, "Kurier faol emas"))).toBe("courier");
    expect(classifyCarrierError(httpError(400, "Bu foydalanuvchi kurier emas"))).toBe("courier");
    expect(classifyCarrierError(httpError(404, "Kurier topilmadi"))).toBe("courier");
  });

  it("404 akkaunt topilmadi va boshqa 400 — umumiy xato", () => {
    expect(classifyCarrierError(httpError(404, "Carrier akkaunt topilmadi"))).toBe("other");
    expect(classifyCarrierError(httpError(400, "ip_allowlist da tushunilmagan yozuv: x"))).toBe(
      "other",
    );
  });

  it("503 — identity javob bermadi", () => {
    expect(
      classifyCarrierError(
        httpError(503, "Kurierni tekshirib bo'lmadi — identity xizmati javob bermadi"),
      ),
    ).toBe("unavailable");
  });

  it("javob yo'q (tarmoq / vaqt) va 502 / 504 — natija noma'lum", () => {
    expect(classifyCarrierError(httpError(undefined))).toBe("unknown");
    expect(classifyCarrierError(httpError(504))).toBe("unknown");
    expect(classifyCarrierError(httpError(502))).toBe("unknown");
  });

  it("axios bo'lmagan xato — umumiy", () => {
    expect(classifyCarrierError(new Error("x"))).toBe("other");
  });

  it("2xx javobda kalit yo'q — natija noma'lum (akkaunt yaratilgan / kalit almashgan)", () => {
    expect(classifyCarrierError(new CarrierUnreadableResponseError())).toBe("unknown");
  });

  it("500 — faqat yaratish va kalitni yangilashda noma'lum (yozib bo'lgach yiqilishi mumkin)", () => {
    expect(classifyCarrierError(httpError(500, "Internal"))).toBe("other");
    expect(classifyCarrierError(httpError(500, "Internal"), { serverErrorUnknown: true })).toBe(
      "unknown",
    );
  });
});

describe("toCarrierCourier / initialsOf", () => {
  it("GET users/:id qatori → kuryer (filial, tariflar)", () => {
    expect(
      toCarrierCourier({
        id: 55,
        name: "FastPost kuryeri",
        phone_number: "+998909774040",
        status: "ACTIVE",
        branch: { id: 1, name: "Toshkent HQ" },
        tariff_home: "30000",
        tariff_center: null,
      }),
    ).toEqual(courier({ tariffCenter: null }));
  });

  it("filialsiz kuryer — branch null; id'siz — null", () => {
    expect(
      toCarrierCourier({ id: "5", name: "A", status: "active", branch: null })?.branch,
    ).toBeNull();
    expect(toCarrierCourier({ name: "A" })).toBeNull();
  });

  it("bosh harflar", () => {
    expect(initialsOf("FastPost kuryeri")).toBe("FK");
    expect(initialsOf("")).toBe("?");
  });
});

describe("readCourierReceivable — «Qabul qilinishi kerak» kuryer kassasidan", () => {
  it("olinishi_kerak — «Kuryer kassasi» sahifasidagi son (HQ emas yoki savdo kutilmoqda — 0)", () => {
    expect(
      readCourierReceivable({
        statusCode: 200,
        data: { cashbox: { balance: 500000 }, olinishi_kerak: 0, can_receive: false },
      }),
    ).toBe(0);
    expect(
      readCourierReceivable({ data: { cashbox: { balance: 2340000 }, olinishi_kerak: "2340000" } }),
    ).toBe(2340000);
  });

  it("olinishi_kerak yo'q (C3 maydonlarisiz javob) — null «—»: balans «qabul qilinadigan» deb ko'rsatilmaydi", () => {
    // `with_history` siz backend kassaning o'zini qaytaradi — HQ emas kuryerning 500 000 balansi superadminniki emas.
    expect(readCourierReceivable({ data: { id: "c99", balance: 500000 } })).toBeNull();
    expect(readCourierReceivable({ data: { cashbox: { balance: 120000 } } })).toBeNull();
    expect(readCourierReceivable({ data: null })).toBeNull();
    expect(readCourierReceivable({ data: { cashbox: {} } })).toBeNull();
  });
});
