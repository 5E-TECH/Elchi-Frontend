import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";

/**
 * FCdwcvEv — `memo(DataTable)` `/orders` da ishlashi uchun OrdersTable unga barqaror `columns`, `renderCard` va
 * `getRowKey` berishi kerak. Ilgari `getOrderHref` sukut qiymati va `getRowKey` inline edi — OrdersTable har
 * qayta chizilganda (masalan sarlavha yoki `busy` o'zgarsa) ular yangi bo'lib, DataTable butun jadvalni qayta chizardi.
 */
const spy = vi.hoisted(() => ({ renders: 0, props: [] as Array<Record<string, unknown>> }));

vi.mock("../../../shared/ui/primitives", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/ui/primitives")>();
  const { createElement, memo } = await import("react");
  const Original = original.DataTable as unknown as (props: Record<string, unknown>) => ReturnType<typeof createElement>;
  const SpyTable = memo((props: Record<string, unknown>) => {
    spy.renders += 1;
    spy.props.push(props);
    return createElement(Original, props);
  });
  return { ...original, DataTable: SpyTable };
});

import OrdersTable from "./OrdersTable";

const orders = [
  {
    id: "o-1",
    customer: { name: "Ali", phone_number: "+998901234567" },
    district: { name: "Yunusobod", region: { name: "Toshkent" } },
    market: { name: "Fresh Market" },
    status: "sold",
    where_deliver: "center",
    total_price: 250000,
    createdAt: "2026-04-06T10:00:00.000Z",
  },
];

const onRowClick = vi.fn();

const Harness = () => {
  const [label, setLabel] = useState("Buyurtmalar A");
  return (
    <>
      <button type="button" onClick={() => setLabel("Buyurtmalar B")}>
        sarlavha
      </button>
      <OrdersTable data={orders as never} isLoading={false} label={label} onRowClick={onRowClick} />
    </>
  );
};

describe("OrdersTable — memo(DataTable) uchun barqaror proplar (FCdwcvEv)", () => {
  it("⭐ OrdersTable qayta chizilsa ham columns, renderCard va getRowKey o'sha (sukut getOrderHref bilan)", async () => {
    const user = userEvent.setup();
    spy.renders = 0;
    spy.props = [];
    renderWithProviders(<Harness />);
    expect(await screen.findByText("Ali")).toBeInTheDocument();
    const before = spy.props.at(-1)!;

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "sarlavha" }));
    });

    const after = spy.props.at(-1)!;
    expect(after.label).toBe("Buyurtmalar B");
    expect(after.columns).toBe(before.columns);
    expect(after.renderCard).toBe(before.renderCard);
    expect(after.getRowKey).toBe(before.getRowKey);
    expect(after.onRowClick).toBe(before.onRowClick);
  });
});
