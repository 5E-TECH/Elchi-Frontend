import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import type { BranchTelegramStatus } from "../model/types";
import { BranchTelegramCard } from "./BranchTelegramCard";

/**
 * «Kassa hisoboti · Telegram» — filial kassasi yopilganda hisobot guruhga yoki menejerlarning shaxsiy chatiga.
 * Tarmoqqa chiqilmaydi (API funksiyalari mock).
 */

const mocks = vi.hoisted(() => ({
  getBranchTelegram: vi.fn(),
  requestBranchGroupLinkCode: vi.fn(),
  setBranchReportTarget: vi.fn(),
  unlinkBranchGroup: vi.fn(),
}));

vi.mock("../api/branchTelegramApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/branchTelegramApi")>()),
  getBranchTelegram: (id: string) => mocks.getBranchTelegram(id),
  requestBranchGroupLinkCode: (id: string) => mocks.requestBranchGroupLinkCode(id),
  setBranchReportTarget: (input: unknown) => mocks.setBranchReportTarget(input),
  unlinkBranchGroup: (id: string) => mocks.unlinkBranchGroup(id),
}));

const status = (patch: Partial<BranchTelegramStatus> = {}): BranchTelegramStatus => ({
  branchId: "12",
  reportTarget: "group",
  group: null,
  canManage: true,
  ...patch,
});

const ACTIVE_GROUP = {
  chatId: "-1001",
  title: "Chilonzor kassa",
  isActive: true,
  inactiveReason: null,
  inactiveAt: null,
  linkedAt: "2026-11-20T09:00:00.000Z",
};

const renderCard = () => renderWithProviders(<BranchTelegramCard branchId="12" branchName="Chilonzor" />);

describe("BranchTelegramCard", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("ulanmagan: «Ulanmagan», «Ulash», guruh tanlangan-u ulanmagan — ogohlantirish", async () => {
    mocks.getBranchTelegram.mockResolvedValue(status());
    renderCard();
    expect(await screen.findByText("Ulanmagan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ulash" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uzish" })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("hisobot hech kimga yuborilmaydi");
  });

  it("«Ulash» — bir martalik havola oynasi; bot ulasa oyna yopiladi va «Ulangan»", async () => {
    const user = userEvent.setup();
    mocks.getBranchTelegram.mockResolvedValueOnce(status()).mockResolvedValue(status({ group: ACTIVE_GROUP }));
    mocks.requestBranchGroupLinkCode.mockResolvedValue({
      token: "c0de",
      purpose: "branch_group",
      group_type: "create",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      deep_link: "https://t.me/elchi_bot?startgroup=c0de",
      command: "/start c0de",
    });
    renderCard();
    await user.click(await screen.findByRole("button", { name: "Ulash" }));
    expect(mocks.requestBranchGroupLinkCode).toHaveBeenCalledWith("12");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Chilonzor · Kassa hisoboti guruhi")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Telegram/ })).toHaveAttribute(
      "href",
      "https://t.me/elchi_bot?startgroup=c0de",
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), { timeout: 6_000 });
    expect(await screen.findByText("Guruh ulandi")).toBeInTheDocument();
    expect(screen.getByText("Ulangan")).toBeInTheDocument();
    expect(screen.getByText(/«Chilonzor kassa»/)).toBeInTheDocument();
  }, 10_000);

  it("«Shaxsiy chatga» — hisobot manzili saqlanadi", async () => {
    const user = userEvent.setup();
    mocks.getBranchTelegram.mockResolvedValue(status({ group: ACTIVE_GROUP }));
    mocks.setBranchReportTarget.mockResolvedValue(status({ group: ACTIVE_GROUP, reportTarget: "private" }));
    renderCard();
    await user.click(await screen.findByRole("radio", { name: "Shaxsiy chatga" }));
    expect(mocks.setBranchReportTarget).toHaveBeenCalledWith({ branchId: "12", reportTarget: "private" });
    expect(await screen.findByRole("radio", { name: "Shaxsiy chatga" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/menejerlarining shaxsiy Telegram chatiga/)).toBeInTheDocument();
  });

  it("«Uzish» — tasdiq oynasi bilan", async () => {
    const user = userEvent.setup();
    mocks.getBranchTelegram.mockResolvedValue(status({ group: ACTIVE_GROUP }));
    mocks.unlinkBranchGroup.mockResolvedValue(undefined);
    renderCard();
    await user.click(await screen.findByRole("button", { name: "Uzish" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "Guruhni uzasizmi?" });
    expect(mocks.unlinkBranchGroup).not.toHaveBeenCalled();
    await user.click(within(confirmDialog).getByRole("button", { name: "Uzish" }));
    await waitFor(() => expect(mocks.unlinkBranchGroup).toHaveBeenCalledWith("12"));
  });

  it("nofaol guruh — sabab va «Qayta ulash»", async () => {
    mocks.getBranchTelegram.mockResolvedValue(
      status({ group: { ...ACTIVE_GROUP, isActive: false, inactiveReason: "kicked" } }),
    );
    renderCard();
    expect(await screen.findByText("Nofaol")).toBeInTheDocument();
    expect(screen.getByText(/Bot guruhdan chiqarilgan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qayta ulash" })).toBeInTheDocument();
  });

  it("`can_manage: false` (HQ, admin) — faqat ko'rish", async () => {
    mocks.getBranchTelegram.mockResolvedValue(status({ group: ACTIVE_GROUP, canManage: false }));
    renderCard();
    expect(await screen.findByText("Ulangan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Almashtirish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Uzish" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Shaxsiy chatga" })).toBeDisabled();
  });
});
