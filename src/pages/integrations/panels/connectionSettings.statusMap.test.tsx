import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import type { ConnectionField } from "../connections";
import type { Connection } from "../useConnections";

/**
 * REGRESSIYA (JnHK6bgV, lokal E2E ushladi): saqlangan status xaritasi
 * formaga OBYEKT bo'lib yuklanadi. Ilgari `String(obj)` → "[object Object]"
 * bo'lib, jadval bo'sh ko'rinardi va bitta katak tahrirlab saqlansa mavjud
 * xaritaning qolgani o'chib ketardi.
 */

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve({})) }));

vi.mock("../../../entities/integrations/statusCatalog", () => ({
  useStatusCatalog: () => ({
    isLoading: false,
    data: {
      shipment: [
        { code: "sold", key: "sold", meaning_uz: "Yetkazildi" },
        { code: "on the road", key: "on_the_road", meaning_uz: "Yo'lda" },
        { code: "cancelled", key: "cancelled", meaning_uz: "Bekor" },
      ],
      payment: [],
      inbound_default_action: { sold: "sell", cancelled: "cancel" },
    },
  }),
}));
vi.mock("../../../entities/integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/integrations")>()),
  useUpdateIntegration: () => ({ mutate: mocks.mutate, mutateAsync: mocks.mutateAsync, isPending: false }),
}));

import ConnectionSettings from "./ConnectionSettings";

const fields: ConnectionField[] = [
  { key: "inbound_status_mapping", labelKey: "fInboundStatusMappingLabel", type: "status-map", statusMapKind: "inbound" },
  { key: "status_mapping", labelKey: "fStatusMappingLabel", type: "status-map", statusMapKind: "outbound" },
];

const connection = {
  uid: "integration:1",
  kind: "integration",
  id: "1",
  name: "Lokal Kargo",
  role: "carrier",
  category: "cargo",
  is_active: true,
  subtitle: "",
  raw: {
    id: "1",
    slug: "lokal-kargo",
    inbound_status_mapping: { DELIVERED: { status: "sold", action: "sell" }, LEGACY_X: { status: "eski" } },
    status_mapping: { sold: "7", sell: "DONE" },
  },
} as unknown as Connection;

const payloadOf = () => {
  const call = mocks.mutateAsync.mock.calls.at(-1) ?? mocks.mutate.mock.calls.at(-1);
  return (call?.[0] as { payload: Record<string, unknown> }).payload;
};

describe("ConnectionSettings — status xaritasi (regressiya)", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.mutateAsync.mockClear();
  });

  it("saqlangan xarita jadvalga yuklanadi (bo'sh emas)", () => {
    renderWithProviders(<ConnectionSettings connection={connection} fields={fields} onSaved={vi.fn()} />);
    const [inbound, outbound] = screen.getAllByTestId("status-map-row-sold");
    expect((within(inbound).getByRole("textbox") as HTMLInputElement).value).toBe("DELIVERED");
    expect((within(outbound).getByRole("textbox") as HTMLInputElement).value).toBe("7");
    const tags = screen.getAllByTestId("status-map-matched").map((el) => el.textContent);
    expect(tags).toEqual(["moslangan: 1 / 3", "moslangan: 1 / 3"]);
  });

  it("⭐ bitta katak tahrirlanib saqlansa QOLGAN yozuvlar (va action) yo'qolmaydi", async () => {
    renderWithProviders(<ConnectionSettings connection={connection} fields={fields} onSaved={vi.fn()} />);
    const inbound = screen.getAllByTestId("status-map-row-cancelled")[0];
    fireEvent.change(within(inbound).getByRole("textbox"), { target: { value: "CANCELED" } });
    fireEvent.click(screen.getByRole("button", { name: /saqlash/i }));

    await waitFor(() => expect(mocks.mutateAsync.mock.calls.length + mocks.mutate.mock.calls.length).toBeGreaterThan(0));
    expect(payloadOf().inbound_status_mapping).toEqual({
      DELIVERED: { status: "sold", action: "sell" },
      LEGACY_X: { status: "eski" },
      CANCELED: { status: "cancelled", action: "cancel" },
    });
    // Tahrirlanmagan chiquvchi xarita umuman yuborilmaydi.
    expect(payloadOf()).not.toHaveProperty("status_mapping");
  });
});
