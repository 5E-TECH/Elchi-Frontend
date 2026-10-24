import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/test-utils";
import type { ConnectionField } from "../connections";
import type { Connection } from "../useConnections";

/**
 * jeU3eztP — hamkor webhooki: asosiy manzil bo'sh, sinov rejimi saqlangan (yoqiq + manzili bor) bo'lsa ham
 * «Sinash» ishlaydi — so'rov manzilsiz ketadi va backend sinov manziliga, sinov sekreti bilan yuboradi; natijada
 * qaysi manzilga ketgani ko'rinadi. Ilgari tugma o'chiq turardi va sandbox'ni UI'dan sinab bo'lmasdi.
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, post: mocks.post, get: vi.fn(() => Promise.resolve({ data: {} })) } };
});

import ConnectionSettings from "./ConnectionSettings";

const fields: ConnectionField[] = [
  { key: "webhook_url", labelKey: "fWebhookUrlLabel", type: "url" },
  { key: "sandbox_enabled", labelKey: "fSandboxEnabledLabel", type: "switch", group: "sandbox" },
  { key: "sandbox_webhook_url", labelKey: "fSandboxWebhookUrlLabel", type: "url", group: "sandbox" },
];

const partner = (raw: Record<string, unknown>) =>
  ({
    uid: "partner:2",
    kind: "partner",
    id: "2",
    name: "TEST Partner",
    is_active: true,
    subtitle: "",
    raw: { id: "2", ...raw },
  }) as unknown as Connection;

const SANDBOX = "https://dev.partner.example.com/elchi/webhook";

const sinash = () => screen.getByRole("button", { name: "Sinash" });

describe("ConnectionSettings — sandbox webhookini sinash (jeU3eztP)", () => {
  beforeEach(() => mocks.post.mockReset());

  it("⭐ asosiy manzil bo'sh, sinov rejimi saqlangan — «Sinash» faol, manzilsiz ketadi, natijada sinov manzili", async () => {
    mocks.post.mockResolvedValue({
      data: {
        statusCode: 200,
        data: {
          ok: true,
          url: SANDBOX,
          target: "sandbox",
          secret_used: "sandbox",
          used_saved_url: true,
          http_status: 200,
          duration_ms: 84,
          response_body: null,
          error: null,
          signature_sent: "sha256=abc",
          secret_configured: true,
          event_id: "e1",
        },
      },
    });
    renderWithProviders(
      <ConnectionSettings
        connection={partner({ webhook_url: "", sandbox_enabled: true, sandbox_webhook_url: SANDBOX })}
        fields={fields}
        onSaved={vi.fn()}
      />,
    );

    expect(sinash()).toBeEnabled();
    fireEvent.click(sinash());

    expect(await screen.findByText("Yetdi — HTTP 200 (84 ms)")).toBeInTheDocument();
    expect(screen.getByText(`Sinov manziliga sinov sekreti bilan yuborildi: ${SANDBOX}`)).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith("admin/partners/2/webhook-test", { url: undefined });
  });

  it("asosiy manzil ham, saqlangan sinov rejimi ham yo'q — «Sinash» o'chiq (avvalgidek)", () => {
    renderWithProviders(
      <ConnectionSettings
        connection={partner({ webhook_url: "", sandbox_enabled: false, sandbox_webhook_url: SANDBOX })}
        fields={fields}
        onSaved={vi.fn()}
      />,
    );
    expect(sinash()).toBeDisabled();
  });

  it("asosiy manzil bor — u yuboriladi; asosiy manzilga ketgan natijada sinov qatori yo'q", async () => {
    mocks.post.mockResolvedValue({
      data: { statusCode: 200, data: { ok: true, url: "https://partner.example.com/hook", target: "primary", http_status: 200, duration_ms: 50, secret_configured: true } },
    });
    renderWithProviders(
      <ConnectionSettings
        connection={partner({ webhook_url: "https://partner.example.com/hook", sandbox_enabled: true, sandbox_webhook_url: SANDBOX })}
        fields={fields}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(sinash());
    expect(await screen.findByText("Yetdi — HTTP 200 (50 ms)")).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith("admin/partners/2/webhook-test", { url: "https://partner.example.com/hook" });
    expect(screen.queryByText(/Sinov manziliga/)).not.toBeInTheDocument();
  });
});
