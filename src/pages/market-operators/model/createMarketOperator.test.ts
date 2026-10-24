import { describe, expect, it } from "vitest";
import { buildCreateMarketOperatorPayload, validateCreateOperator } from "./createMarketOperator";
import { joinOperatorNames, operatorsWithoutCommission } from "./unsetCommission";
import type { MarketOperator } from "../../../entities/market-operator";

describe("buildCreateMarketOperatorPayload", () => {
  it("normalizes operator data without accepting a client-controlled market id", () => {
    expect(
      buildCreateMarketOperatorPayload({
        name: "  Ali   Valiyev  ",
        phone_number: "+998 90 123 45 67",
        password: "secret123",
      }),
    ).toEqual({
      name: "Ali Valiyev",
      phone_number: "+998901234567",
      password: "secret123",
    });
  });
});

describe("validateCreateOperator", () => {
  const valid = { name: "Nodira Aliyeva", phone_number: "+998974551820", password: "nodira25" };

  it("to'g'ri forma — xatosiz", () => {
    expect(validateCreateOperator(valid)).toEqual({});
  });

  it("ism, telefon, parol chegaralari (backend DTO bilan bir xil)", () => {
    expect(validateCreateOperator({ ...valid, name: "   " }).name).toBe("nameRequired");
    expect(validateCreateOperator({ ...valid, name: "A" }).name).toBe("nameLength");
    expect(validateCreateOperator({ ...valid, name: "A".repeat(101) }).name).toBe("nameLength");
    expect(validateCreateOperator({ ...valid, phone_number: "+99897455" }).phone_number).toBe("phoneRequired");
    expect(validateCreateOperator({ ...valid, password: "" }).password).toBe("passwordRequired");
    expect(validateCreateOperator({ ...valid, password: "abc" }).password).toBe("passwordShort");
  });
});

describe("komissiya belgilanmagan operatorlar", () => {
  const op = (id: string, extra: Partial<MarketOperator>): MarketOperator => ({
    id,
    name: `Op ${id}`,
    phone_number: "+998900000000",
    status: "active",
    commission_type: null,
    commission_value: null,
    created_at: null,
    can_view_warehouse_stock: false,
    ...extra,
  });

  it("faqat faol va komissiyasiz operatorlar", () => {
    const items = [
      op("1", {}),
      op("2", { commission_type: "percent", commission_value: 5 }),
      op("3", { status: "inactive" }),
      op("4", { commission_type: "fixed", commission_value: 0 }),
    ];
    expect(operatorsWithoutCommission(items).map((item) => item.id)).toEqual(["1"]);
  });

  it("ismlar: 1, 2, 3 va ko'p", () => {
    const opts = { and: "va", more: (count: number) => `yana ${count} ta operator` };
    expect(joinOperatorNames(["A"], opts)).toBe("A");
    expect(joinOperatorNames(["A", "B"], opts)).toBe("A va B");
    expect(joinOperatorNames(["A", "B", "C"], opts)).toBe("A, B va C");
    expect(joinOperatorNames(["A", "B", "C", "D", "E"], opts)).toBe("A, B, C va yana 2 ta operator");
  });
});
