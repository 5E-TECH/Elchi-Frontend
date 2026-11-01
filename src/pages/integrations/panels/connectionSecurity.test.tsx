import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import type { Connection } from "../useConnections";

/**
 * Kirish huquqini o'zgartiradigan amallar faqat tasdiq oynasi orqali (DESIGN_SYSTEM §8). Ilgari buni o'chirilgan
 * `/integrations/partners` sahifasi testi qo'riqlardi — amallar endi faqat shu panelda (Dj70iDbD).
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("../../../shared/api/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../shared/api/api")>();
  return { ...original, api: { ...original.api, post: mocks.post, get: vi.fn(() => Promise.resolve({ data: {} })) } };
});

import ConnectionSecurity from "./ConnectionSecurity";

const partner = {
  uid: "partner:1",
  kind: "partner",
  id: "1",
  name: "BeePost",
  is_active: true,
  subtitle: "",
  raw: { id: "1", name: "BeePost", is_active: true },
} as unknown as Connection;

describe("ConnectionSecurity — kirish amallari tasdiq bilan", () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ data: { statusCode: 200, data: { id: "1", api_key: "elc_new" } } });
  });

  it("⭐ kalit faqat «Ha, yangilash» dan keyin yangilanadi, «Bekor qilish» hech narsa yubormaydi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSecurity connection={partner} fields={[]} onSaved={vi.fn()} />);
    const rotate = screen.getByRole("button", { name: /Kalitni yangilash/ });

    await user.click(rotate);
    const dialog = await screen.findByRole("alertdialog", { name: "Kalitni yangilash" });
    expect(dialog).toHaveTextContent("BeePost");

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.post).not.toHaveBeenCalled();

    await user.click(rotate);
    await user.click(await screen.findByRole("button", { name: "Ha, yangilash" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("admin/partners/1/rotate-key"));
  });

  it("⭐ hamkorni to'xtatish xavfli tasdiqdan o'tadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSecurity connection={partner} fields={[]} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "To'xtatish" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Ulanishni to'xtatish" });
    expect(mocks.post).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "To'xtatish" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("admin/partners/1/status", { is_active: false }));
  });
});
