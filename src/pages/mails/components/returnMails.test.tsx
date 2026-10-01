import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MailItem } from "../../../entities/mails";
import { renderWithProviders } from "../../../test/test-utils";
import uz from "../../../locales/uz/mails.json";
import ru from "../../../locales/ru/mails.json";
import en from "../../../locales/en/mails.json";
import ReturnMails from "./returnMails";

const mocks = vi.hoisted(() => ({
  useGetReturnMails: vi.fn(),
  approveMutateAsync: vi.fn(),
  rejectMutateAsync: vi.fn(),
}));

vi.mock("../../../entities/mails", () => ({
  useMails: () => ({
    useGetReturnMails: mocks.useGetReturnMails,
    approveReturnRequests: { mutateAsync: mocks.approveMutateAsync, isPending: false },
    rejectReturnRequests: { mutateAsync: mocks.rejectMutateAsync, isPending: false },
  }),
}));

const request = (overrides: Partial<MailItem> = {}): MailItem => ({
  id: "101",
  request_id: "101",
  order_id: "101",
  post_id: "55",
  createdAt: "2026-10-01T05:00:00.000Z",
  updatedAt: "2026-10-01T05:00:00.000Z",
  courier_id: "209",
  post_total_price: 120000,
  order_quantity: 1,
  qr_code_token: "",
  region_id: "1",
  region: { id: "1", name: "Toshkent", sato_code: "" },
  courier: { id: "209", name: "Ali", phone_number: "+998903009003" },
  customer: { id: "5", name: "Vali", phone_number: "+998901112233", extra_number: null },
  district: { id: "3", name: "Chilonzor" },
  action: "branch",
  status: "on the road",
  ...overrides,
});

const branchRequests = [
  request(),
  request({
    id: "102",
    request_id: "102",
    order_id: "102",
    status: "waiting",
    customer: { id: "6", name: "Soli", phone_number: "+998901112244", extra_number: null },
  }),
];

const listResult = (items: MailItem[]) => ({
  data: {
    statusCode: 200,
    message: "ok",
    data: { data: items, total: items.length, page: 1, totalPages: 1, limit: items.length },
  },
  isLoading: false,
  isError: false,
});

const checkboxOfCustomer = (name: string) => {
  const row = screen.getByText(name).closest("label");
  if (!row) throw new Error(`row for ${name} not found`);
  return within(row).getByRole("checkbox");
};

describe("ReturnMails (Pochta → Qaytarish)", () => {
  beforeEach(() => {
    mocks.useGetReturnMails.mockReturnValue(listResult(branchRequests));
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 1 } });
    mocks.rejectMutateAsync.mockResolvedValue({ statusCode: 200, data: { rejected: 2 } });
  });

  it("shows the courier group, the per-order state chips and the branch destination without a pager", () => {
    renderWithProviders(<ReturnMails />);

    expect(mocks.useGetReturnMails).toHaveBeenCalledWith();
    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("Kuryer qabul qilmagan")).toBeInTheDocument();
    expect(screen.getByText("Kuryer qo'lida")).toBeInTheDocument();
    expect(screen.getAllByText("Filialga")).toHaveLength(2);
    expect(screen.queryByText("Markazga")).not.toBeInTheDocument();
    // Pagination olib tashlangan: backend sahifalamaydi.
    expect(screen.queryByRole("button", { name: "Oldingi" })).not.toBeInTheDocument();
    expect(screen.queryByText(/ko'rsatilmoqda/)).not.toBeInTheDocument();
  });

  it("approves the checked order with exactly { order_ids } and clears the selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(screen.getAllByRole("button", { name: /Tasdiqlash/ })[0]);

    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["101"] });
    expect(mocks.rejectMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("1 ta buyurtma omborga qaytarildi")).toBeInTheDocument();
    expect(checkboxOfCustomer("Vali")).not.toBeChecked();
  });

  it("rejects the whole courier group", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails />);

    // Guruh ostidagi "Barchasini tanlash" (birinchisi) — faqat shu guruh.
    await user.click(screen.getAllByRole("checkbox", { name: /Barchasini tanlash/ })[0]);
    await user.click(screen.getAllByRole("button", { name: /Rad etish/ })[0]);

    expect(mocks.rejectMutateAsync).toHaveBeenCalledWith({ order_ids: ["101", "102"] });
    expect(
      await screen.findByText("2 ta so'rov rad etildi — buyurtmalar kuryerda qoldi"),
    ).toBeInTheDocument();
  });

  // F1: toast backend haqiqatda bajarganini aytadi, tanlanganlar sonini emas.
  it("counts what the backend approved and notes the skipped stale requests", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({
      statusCode: 200,
      message: "Qaytarish so'rovlari tasdiqlandi — buyurtmalar omborga qaytarildi",
      data: { approved: 1, order_ids: ["101"], skipped_order_ids: ["102"] },
    });
    renderWithProviders(<ReturnMails />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getAllByRole("button", { name: /Tasdiqlash/ })[0]);

    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["101", "102"] });
    expect(
      await screen.findByText(
        "1 ta buyurtma omborga qaytarildi · 1 ta so'rov allaqachon ko'rib chiqilgan — o'tkazib yuborildi",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2 ta buyurtma omborga qaytarildi/)).not.toBeInTheDocument();
  });

  it("counts what the backend rejected and notes the skipped stale requests", async () => {
    const user = userEvent.setup();
    mocks.rejectMutateAsync.mockResolvedValue({
      statusCode: 200,
      data: { rejected: 1, order_ids: ["102"], skipped_order_ids: ["101"] },
    });
    renderWithProviders(<ReturnMails />);

    await user.click(screen.getAllByRole("checkbox", { name: /Barchasini tanlash/ })[0]);
    await user.click(screen.getAllByRole("button", { name: /Rad etish/ })[0]);

    expect(mocks.rejectMutateAsync).toHaveBeenCalledWith({ order_ids: ["101", "102"] });
    expect(
      await screen.findByText(
        "1 ta so'rov rad etildi — buyurtmalar kuryerda qoldi · 1 ta so'rov allaqachon ko'rib chiqilgan — o'tkazib yuborildi",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the number of selected requests when the response has no count", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: null });
    renderWithProviders(<ReturnMails />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getAllByRole("button", { name: /Tasdiqlash/ })[0]);

    // Son yo'q va skipped yo'q — tanlanganlar soni, izohsiz.
    expect(await screen.findByText("2 ta buyurtma omborga qaytarildi")).toBeInTheDocument();
    expect(screen.queryByText(/allaqachon ko'rib chiqilgan/)).not.toBeInTheDocument();
  });

  it("shows the backend reason verbatim when the action is refused and keeps the selection", async () => {
    const user = userEvent.setup();
    const backendMessage =
      "Siz faqat o'z filialingiz kuryerlarining qaytarish so'rovlarini ko'rib chiqa olasiz";
    mocks.approveMutateAsync.mockRejectedValue({
      response: { status: 403, data: { statusCode: 403, message: backendMessage } },
    });
    renderWithProviders(<ReturnMails />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(screen.getAllByRole("button", { name: /Tasdiqlash/ })[0]);

    expect(await screen.findByText(backendMessage)).toBeInTheDocument();
    expect(checkboxOfCustomer("Vali")).toBeChecked();
  });

  it("falls back to the translated error when the backend sends no message", async () => {
    const user = userEvent.setup();
    mocks.rejectMutateAsync.mockRejectedValue({ response: { status: 500, data: {} } });
    renderWithProviders(<ReturnMails />);

    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getAllByRole("button", { name: /Rad etish/ })[0]);

    expect(await screen.findByText("Qaytarish so'rovini bajarib bo'lmadi")).toBeInTheDocument();
  });

  it("labels HQ-scope requests as going to the center", () => {
    mocks.useGetReturnMails.mockReturnValue(listResult([request({ action: "center" })]));
    renderWithProviders(<ReturnMails />);

    expect(screen.getByText("Markazga")).toBeInTheDocument();
    expect(screen.queryByText("Filialga")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no requests", () => {
    mocks.useGetReturnMails.mockReturnValue(listResult([]));
    renderWithProviders(<ReturnMails />);

    expect(screen.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toBeInTheDocument();
  });
});

describe("mails locales — Qaytarish keys", () => {
  const KEYS = [
    "returnDestinationBranch",
    "returnStateNotReceived",
    "returnStateWithCourier",
    "returnApproveSuccess",
    "returnRejectSuccess",
    "returnActionError",
    "returnSkippedNote",
  ] as const;
  const dictionaries = { uz, ru, en } as Record<string, Record<string, unknown>>;

  it.each(Object.keys(dictionaries))("%s has every new key with a non-empty text", (lang) => {
    KEYS.forEach((key) => {
      const value = dictionaries[lang][key];
      expect(typeof value === "string" && value.trim().length > 0).toBe(true);
    });
  });

  it("keeps the {{count}} placeholder in the count messages", () => {
    Object.values(dictionaries).forEach((dict) => {
      expect(dict.returnApproveSuccess).toContain("{{count}}");
      expect(dict.returnRejectSuccess).toContain("{{count}}");
      expect(dict.returnSkippedNote).toContain("{{count}}");
    });
  });
});
