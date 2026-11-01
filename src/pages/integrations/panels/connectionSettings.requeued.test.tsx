import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import type { ConnectionField } from "../connections";
import type { Connection } from "../useConnections";

/**
 * `webhook_url` qo'yilganda backend kutib turgan hodisalarni navbatga qaytaradi — bu son jim o'tmasin.
 * Ilgari xabar faqat o'chirilgan `/integrations/partners` sahifasida edi (Dj70iDbD).
 */

const mocks = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, patch: mocks.patch, get: vi.fn(() => Promise.resolve({ data: {} })) } };
});

import ConnectionSettings from "./ConnectionSettings";

const fields: ConnectionField[] = [{ key: "webhook_url", labelKey: "fWebhookUrlLabel", type: "url" }];

const partner = {
  uid: "partner:2",
  kind: "partner",
  id: "2",
  name: "TEST Partner",
  is_active: true,
  subtitle: "",
  raw: { id: "2", webhook_url: "" },
} as unknown as Connection;

const saveNewUrl = (onSaved = vi.fn()) => {
  renderWithProviders(<ConnectionSettings connection={partner} fields={fields} onSaved={onSaved} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://partner.example.com/hook" } });
  fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
};

describe("ConnectionSettings — navbatga qaytgan hodisalar", () => {
  beforeEach(() => mocks.patch.mockReset());

  it("⭐ backend hodisalarni qaytarsa soni xabarda aytiladi", async () => {
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: { requeued_webhooks: 3 } } });
    saveNewUrl();

    expect(await screen.findByText("Hamkor sozlamalari saqlandi — kutib turgan 3 ta hodisa navbatga qaytarildi")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.patch).toHaveBeenCalledWith("admin/partners/2", expect.objectContaining({ webhook_url: "https://partner.example.com/hook" })),
    );
  });

  it("qaytgan hodisa bo'lmasa — oddiy «Saqlandi»", async () => {
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, data: {} } });
    saveNewUrl();

    expect(await screen.findByText("Saqlandi")).toBeInTheDocument();
  });
});
