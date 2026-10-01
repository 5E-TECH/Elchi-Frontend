import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "../../../entities/branch";
import { renderWithProviders } from "../../../test/test-utils";
import BranchEditModal from "./BranchEditModal";

// PATCH /branches/:id — so'rov tanasini aynan serverga ketadigan ko'rinishda tekshiramiz.
const mocks = vi.hoisted(() => ({ patch: vi.fn(), get: vi.fn(), post: vi.fn() }));
vi.mock("../../../shared/api/instance", () => ({
  api: { patch: mocks.patch, get: mocks.get, post: mocks.post },
}));

// Yuqori filial tanlovi (GET /branches) — tarmoqsiz.
vi.mock("../../branch/lib/branchFormOptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../branch/lib/branchFormOptions")>()),
  useParentBranchOptions: () => ({
    data: {
      data: [
        { id: "1", name: "Bosh ofis", code: "HQ", type: "HQ", level: 0 },
        { id: "7", name: "Samarqand", code: "SAM", type: "REGIONAL", level: 1 },
        { id: "9", name: "Chilonzor PICKUP", code: "CHL", type: "PICKUP", level: 1 },
      ],
    },
    isLoading: false,
  }),
}));

const makeBranch = (overrides: Partial<Branch> = {}): Branch => ({
  id: "1",
  name: "Bosh ofis",
  type: "HQ",
  code: "HQ",
  phone_number: "+998901234567",
  address: "Toshkent sh., Chilonzor 1",
  parent: null,
  level: 0,
  region: { id: "10", name: "Toshkent" },
  district: { id: "100", name: "Chilonzor" },
  status: "active",
  employees_count: 4,
  created_at: "2026-01-10T09:00:00.000Z",
  ...overrides,
});

const hqBranch = makeBranch();
const regionalBranch = makeBranch({
  id: "7",
  name: "Samarqand",
  type: "REGIONAL",
  code: "SAM",
  parent_id: "1",
  parent: { id: "1", name: "Bosh ofis" },
  level: 1,
  address: "Samarqand sh., Registon 5",
});

const renderModal = (initialData: Branch) => {
  const onClose = vi.fn();
  renderWithProviders(<BranchEditModal open initialData={initialData} onClose={onClose} />);
  return { onClose };
};

describe("BranchEditModal — HQ (bosh ofis) tahriri", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, message: "Branch updated", data: {} } });
  });

  it("shows the type fixed as HQ and the parent picker disabled", async () => {
    renderModal(hqBranch);

    expect(await screen.findByRole("button", { name: "HQ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "HQ uchun yuqori filial kerak emas" })).toBeDisabled();
  });

  it("submits type HQ with no parent_id and closes on success", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(hqBranch);

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    const [url, payload] = mocks.patch.mock.calls[0];
    expect(url).toBe("branches/1");
    expect(payload).toEqual({
      name: "Bosh ofis",
      type: "HQ",
      code: "HQ",
      phone_number: "+998901234567",
      address: "Toshkent sh., Chilonzor 1",
    });
    expect(payload).not.toHaveProperty("parent_id");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("never sends a stale parent for HQ even if the record still carries one", async () => {
    const user = userEvent.setup();
    renderModal(makeBranch({ parent_id: "7", parent: { id: "7", name: "Samarqand" } }));

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0][1]).not.toHaveProperty("parent_id");
    expect(mocks.patch.mock.calls[0][1]).toMatchObject({ type: "HQ" });
  });
});

describe("BranchEditModal — oddiy filial (o'zgarmagan)", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, message: "Branch updated", data: {} } });
  });

  it("keeps the type and parent pickers editable", async () => {
    renderModal(regionalBranch);

    expect(await screen.findByRole("button", { name: "Viloyat" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bosh ofis (HQ) · HQ" })).toBeEnabled();
  });

  it("submits the selected type together with parent_id", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(regionalBranch);

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch).toHaveBeenCalledWith("branches/7", {
      name: "Samarqand",
      parent_id: "1",
      type: "REGIONAL",
      code: "SAM",
      phone_number: "+998901234567",
      address: "Samarqand sh., Registon 5",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("still requires a parent for a non-PICKUP branch", async () => {
    const user = userEvent.setup();
    renderModal(makeBranch({ ...regionalBranch, parent_id: undefined, parent: null }));

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() =>
      expect(
        screen
          .getAllByText("Yuqori filialni tanlang")
          .some((element) => element.classList.contains("ant-form-item-explain-error")),
      ).toBe(true),
    );
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

describe("BranchEditModal — server rad etishi jim qolmaydi", () => {
  beforeEach(() => {
    mocks.patch.mockReset();
  });

  it("shows an unmapped backend message and keeps the modal open", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 400",
      response: { status: 400, data: { statusCode: 400, message: "HQ filial turini o'zgartirib bo'lmaydi" } },
    });
    const { onClose } = renderModal(hqBranch);

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    expect(await screen.findByText("HQ filial turini o'zgartirib bo'lmaydi")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a non-HQ server rejection too (e.g. 403)", async () => {
    const user = userEvent.setup();
    mocks.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { statusCode: 403, message: "Forbidden resource" } },
    });
    const { onClose } = renderModal(regionalBranch);

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    expect(await screen.findByText("Forbidden resource")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("BranchEditModal — PICKUP tahriri (ilgari saqlanmasdi)", () => {
  const pickupBranch = makeBranch({
    id: "18",
    name: "Toshkent PICKUP",
    type: "PICKUP",
    code: "PCK",
    parent_id: "1",
    parent: { id: "1", name: "Bosh ofis" },
    level: 1,
    address: "Toshkent sh., Yunusobod",
  });

  beforeEach(() => {
    mocks.patch.mockReset();
    mocks.patch.mockResolvedValue({ data: { statusCode: 200, message: "Branch updated", data: {} } });
  });

  it("⭐ PICKUP saqlanganda tanlangan yuqori filial yuboriladi (ilgari '' ketardi → 400)", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(pickupBranch);

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() => expect(mocks.patch).toHaveBeenCalledTimes(1));
    expect(mocks.patch.mock.calls[0][0]).toBe("branches/18");
    expect(mocks.patch.mock.calls[0][1]).toMatchObject({ type: "PICKUP", parent_id: "1" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("PICKUP uchun yuqori filial tanlovi ochiq", async () => {
    renderModal(pickupBranch);

    expect(await screen.findByRole("button", { name: "Bosh ofis (HQ) · HQ" })).toBeEnabled();
  });

  it("yuqori filialsiz PICKUP saqlanmaydi", async () => {
    const user = userEvent.setup();
    renderModal(makeBranch({ ...pickupBranch, parent_id: undefined, parent: null }));

    await user.click(await screen.findByRole("button", { name: "Yangilash" }));

    await waitFor(() =>
      expect(
        screen
          .getAllByText("Yuqori filialni tanlang")
          .some((element) => element.classList.contains("ant-form-item-explain-error")),
      ).toBe(true),
    );
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});
