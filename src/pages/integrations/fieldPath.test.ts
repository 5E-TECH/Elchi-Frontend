import { describe, expect, it } from "vitest";
import { getPath, nestPayload, setPath } from "./fieldPath";

describe("getPath", () => {
  it("tekis kalit", () => {
    expect(getPath({ a: 1 }, "a")).toBe(1);
  });

  it("ichma-ich kalit", () => {
    expect(getPath({ a: { b: { c: 3 } } }, "a.b.c")).toBe(3);
  });

  it("yo'q yo'l — undefined, yiqilmaydi", () => {
    expect(getPath({}, "a.b.c")).toBeUndefined();
    expect(getPath(null, "a.b")).toBeUndefined();
  });
});

describe("setPath", () => {
  it("⭐ MAVJUD qiymatlar saqlanadi", () => {
    /**
     * `dispatch_config.endpoint` yozilganda `body_template` YO'QOLMASLIGI
     * kerak — aks holda bitta maydonni tahrirlash qolganini o'chirardi.
     */
    const before = {
      dispatch_config: { endpoint: "/old", body_template: { a: "1" } },
    };
    const after = setPath(before, "dispatch_config.endpoint", "/new");
    expect(after.dispatch_config).toEqual({
      endpoint: "/new",
      body_template: { a: "1" },
    });
  });

  it("yo'q shoxni yaratadi", () => {
    expect(setPath({}, "a.b.c", 7)).toEqual({ a: { b: { c: 7 } } });
  });

  it("⭐ asl obyektni O'ZGARTIRMAYDI (immutable)", () => {
    // React state'ida mutatsiya qayta chizishni buzardi.
    const before = { a: { b: 1 } };
    const after = setPath(before, "a.b", 2);
    expect(before.a.b).toBe(1);
    expect((after.a as Record<string, unknown>).b).toBe(2);
  });

  it("obyekt bo'lmagan shox ustiga yozilsa almashtiriladi", () => {
    expect(setPath({ a: "salom" }, "a.b", 1)).toEqual({ a: { b: 1 } });
  });
});

describe("nestPayload", () => {
  it("⭐ nuqtali kalitlar ichma-ich obyektga yig'iladi", () => {
    expect(
      nestPayload({
        name: "LDG",
        "dispatch_config.endpoint": "/v1/orders",
        "dispatch_config.method": "POST",
      }),
    ).toEqual({
      name: "LDG",
      dispatch_config: { endpoint: "/v1/orders", method: "POST" },
    });
  });

  it("bir nechta ichma-ich guruh", () => {
    expect(
      nestPayload({
        "dispatch_config.endpoint": "/a",
        "webhook_payload_paths.order_id": "data.id",
      }),
    ).toEqual({
      dispatch_config: { endpoint: "/a" },
      webhook_payload_paths: { order_id: "data.id" },
    });
  });

  it("bo'sh kirish — bo'sh chiqish", () => {
    expect(nestPayload({})).toEqual({});
  });
});
