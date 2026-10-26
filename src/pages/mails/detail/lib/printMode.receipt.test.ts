import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostOrder } from "../../../../entities/mails";
import { printOrders } from "./printMode";

const order = (patch: Partial<PostOrder> = {}) =>
  ({
    id: "o1",
    customer_id: "c1",
    customer: { id: "c1", name: "Dilnoza", phone_number: "+998901112233" },
    market: { id: "m1", name: "Baraka Shop", phone_number: "+998712001122" },
    where_deliver: "address",
    total_price: 185_000,
    operator_phone: "+998712445566",
    secondary_operator_phone: null,
    ...patch,
  }) as unknown as PostOrder;

const captureThermal = async (orders: PostOrder[], context?: Parameters<typeof printOrders>[2]) => {
  const write = vi.fn();
  vi.spyOn(window, "open").mockReturnValue({
    document: { open: vi.fn(), write, close: vi.fn() },
  } as unknown as Window);
  await printOrders("thermal_80mm", orders, context);
  return String(write.mock.calls[0]?.[0] ?? "");
};

describe("printOrders thermal_80mm — 1mOjtOVC receipt fields", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints operator phone as «Muammo bo'lsa» and the post courier line", async () => {
    const html = await captureThermal([order()], {
      postCourier: { name: "Jasur Tursunov", phone_number: "+998905554433" },
    });
    expect(html).toContain("Muammo bo&#39;lsa");
    expect(html).toContain("+998 (71) 244-55-66");
    expect(html).not.toContain("+998 (71) 200-11-22");
    expect(html).toContain("Jasur Tursunov · +998 (90) 555-44-33");
  });

  it("falls back to market phone and omits the courier line when post courier is null", async () => {
    const html = await captureThermal([order({ operator_phone: null } as Partial<PostOrder>)], {
      postCourier: null,
    });
    expect(html).toContain("+998 (71) 200-11-22");
    expect(html).not.toContain("Kuryer<");
  });
});
