import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailItem } from "../../../entities/mails";
import { renderWithProviders } from "../../../test/test-utils";
import uz from "../../../locales/uz/mails.json";
import ru from "../../../locales/ru/mails.json";
import en from "../../../locales/en/mails.json";
import archiveUz from "../../../locales/uz/mailsArchive.json";
import archiveRu from "../../../locales/ru/mailsArchive.json";
import archiveEn from "../../../locales/en/mailsArchive.json";
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
  refetch: vi.fn(),
});

const checkboxOfCustomer = (name: string) => screen.getByRole("checkbox", { name: `${name} so'rovini tanlash` });
const selectionRegion = () => screen.getByRole("region", { name: "Tanlangan so'rovlar" });

describe("ReturnMails (Pochta → Qaytarish)", () => {
  beforeEach(() => {
    mocks.useGetReturnMails.mockReturnValue(listResult(branchRequests));
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 1 } });
    mocks.rejectMutateAsync.mockResolvedValue({ statusCode: 200, data: { rejected: 2 } });
  });

  it("shows the courier group, the per-order state chips and the branch destination without a pager", () => {
    renderWithProviders(<ReturnMails layout="card" />);

    expect(mocks.useGetReturnMails).toHaveBeenCalledWith();
    expect(screen.getByText("Ali")).toBeInTheDocument();
    expect(screen.getByText("Kuryer qabul qilmagan")).toBeInTheDocument();
    expect(screen.getByText("Kuryer qo'lida")).toBeInTheDocument();
    // Planshet nusxasi (Holati ostida) + «Qayerga» ustuni — har so'rovda ikkitadan.
    expect(screen.getAllByText("Filialga")).toHaveLength(4);
    expect(screen.queryByText("Markazga")).not.toBeInTheDocument();
    // Pagination olib tashlangan: backend sahifalamaydi.
    expect(screen.queryByRole("navigation", { name: "Sahifalar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/ko'rsatilmoqda/)).not.toBeInTheDocument();
  });

  it("renders the summary and the grouped table with exact mockup texts", () => {
    renderWithProviders(<ReturnMails layout="card" />);

    expect(screen.getByRole("heading", { name: "Jami qaytarish so'rovlari" })).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "1 ta kuryer, 2 ta buyurtma")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Qaytarish so'rovlari" });
    for (const header of ["Mijoz", "Tuman / viloyat", "Holati", "Qayerga", "Summa"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    // Guruh qatori: kuryer, «N ta buyurtma qaytarish so'rovi · telefon», jami summa.
    expect(within(table).getByText("2 ta buyurtma qaytarish so'rovi · +998 90 300 90 03")).toBeInTheDocument();
    expect(within(table).getByText("240 000 so'm")).toBeInTheDocument();
    // So'rov qatori: telefon formatlangan, tuman va viloyat alohida.
    expect(within(table).getByText("+998 90 111 22 33")).toBeInTheDocument();
    expect(within(table).getAllByText("Chilonzor")).toHaveLength(2);
  });

  it("keeps the selection panel visible: idle with disabled actions until something is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);

    const region = selectionRegion();
    expect(within(region).getByText("Hech biri tanlanmagan")).toBeInTheDocument();
    expect(
      within(region).getByText("Tasdiqlangan buyurtmalar omborga qaytadi, rad etilganlari kuryerda qoladi"),
    ).toBeInTheDocument();
    for (const name of ["Tasdiqlash", "Rad etish", "Tanlovni bekor qilish"]) {
      expect(within(region).getByRole("button", { name })).toBeDisabled();
    }

    await user.click(checkboxOfCustomer("Vali"));
    expect(within(region).getByText("1 ta so'rov tanlandi")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Tasdiqlash" })).toBeEnabled();

    await user.click(within(region).getByRole("button", { name: "Tanlovni bekor qilish" }));
    expect(checkboxOfCustomer("Vali")).not.toBeChecked();
    expect(within(region).getByText("Hech biri tanlanmagan")).toBeInTheDocument();
    expect(mocks.approveMutateAsync).not.toHaveBeenCalled();
    expect(mocks.rejectMutateAsync).not.toHaveBeenCalled();
  });

  it("selects every request from the header checkbox and the group checkbox follows", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(screen.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }));
    expect(checkboxOfCustomer("Vali")).toBeChecked();
    expect(checkboxOfCustomer("Soli")).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ali: barchasini tanlash" })).toBeChecked();
    expect(within(selectionRegion()).getByText("2 ta so'rov tanlandi")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }));
    expect(checkboxOfCustomer("Vali")).not.toBeChecked();
  });

  it("approves the checked order with exactly { order_ids } and clears the selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["101"] });
    expect(mocks.rejectMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("1 ta buyurtma omborga qaytarildi")).toBeInTheDocument();
    expect(checkboxOfCustomer("Vali")).not.toBeChecked();
  });

  it("rejects the whole courier group", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);

    // Guruh belgisi — faqat shu kuryerning so'rovlari.
    await user.click(screen.getByRole("checkbox", { name: "Ali: barchasini tanlash" }));
    await user.click(screen.getByRole("button", { name: "Rad etish" }));

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
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

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
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(screen.getByRole("checkbox", { name: "Ali: barchasini tanlash" }));
    await user.click(screen.getByRole("button", { name: "Rad etish" }));

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
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

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
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(checkboxOfCustomer("Vali"));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));

    expect(await screen.findByText(backendMessage)).toBeInTheDocument();
    expect(checkboxOfCustomer("Vali")).toBeChecked();
    expect(within(selectionRegion()).getByText("1 ta so'rov tanlandi")).toBeInTheDocument();
  });

  it("falls back to the translated error when the backend sends no message", async () => {
    const user = userEvent.setup();
    mocks.rejectMutateAsync.mockRejectedValue({ response: { status: 500, data: {} } });
    renderWithProviders(<ReturnMails layout="card" />);

    await user.click(checkboxOfCustomer("Soli"));
    await user.click(screen.getByRole("button", { name: "Rad etish" }));

    expect(await screen.findByText("Qaytarish so'rovini bajarib bo'lmadi")).toBeInTheDocument();
  });

  it("labels HQ-scope requests as going to the center", () => {
    mocks.useGetReturnMails.mockReturnValue(listResult([request({ action: "center" })]));
    renderWithProviders(<ReturnMails layout="card" />);

    expect(screen.getAllByText("Markazga").length).toBeGreaterThan(0);
    expect(screen.queryByText("Filialga")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no requests", () => {
    mocks.useGetReturnMails.mockReturnValue(listResult([]));
    renderWithProviders(<ReturnMails layout="card" />);

    expect(screen.getByText("Qaytarish so'rovlari yo'q")).toBeInTheDocument();
    expect(screen.getByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tanlangan so'rovlar" })).not.toBeInTheDocument();
  });

  it("shows an error state with retry instead of the empty state when loading fails", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useGetReturnMails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { response: { status: 500, data: {} } },
      refetch,
    });
    renderWithProviders(<ReturnMails layout="card" />);

    expect(screen.queryByText("Hozircha kurierlardan qaytarish so'rovi kelmagan")).not.toBeInTheDocument();
    expect(screen.getByText("Qaytarish so'rovlarini yuklab bo'lmadi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Qayta urinish" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("ReturnMails — telefon (< 768): guruh sarlavhasi va kartalar", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    mocks.useGetReturnMails.mockReturnValue(listResult(branchRequests));
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 1 } });
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it("renders label cards instead of the table and approves through them", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Qaytarish so'rovlari" });
    expect(within(list).getByText("2 ta so'rov · +998 90 300 90 03")).toBeInTheDocument();
    expect(within(list).getByText("+998 90 111 22 33 · Chilonzor, Toshkent")).toBeInTheDocument();
    // Har so'rov kartasida bitta «Qayerga» badge'i.
    expect(within(list).getAllByText("Filialga")).toHaveLength(2);

    // Karta — `label`: matnni bosish belgini almashtiradi.
    await user.click(within(list).getByText("Vali"));
    expect(checkboxOfCustomer("Vali")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));
    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["101"] });
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

describe("mailsArchive locales — uz/ru/en parity", () => {
  // Plural qo'shimchalari (_one, _few …) tilga qarab farq qiladi — asosiy kalit bo'yicha solishtiriladi.
  const flatten = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
          flatten(child, prefix ? `${prefix}.${key}` : key),
        )
      : [prefix.replace(/_(zero|one|two|few|many|other)$/, "")];
  const keysOf = (dict: unknown) => [...new Set(flatten(dict))].sort();

  it("ru and en carry the same keys as uz", () => {
    expect(keysOf(archiveRu)).toEqual(keysOf(archiveUz));
    expect(keysOf(archiveEn)).toEqual(keysOf(archiveUz));
  });

  it("uses exact mockup texts in uz", () => {
    expect(archiveUz.return.selectionHint).toBe(
      "Tasdiqlangan buyurtmalar omborga qaytadi, rad etilganlari kuryerda qoladi",
    );
    expect(archiveUz.return.clearSelection).toBe("Tanlovni bekor qilish");
    expect(archiveUz.old.export).toBe("Excelga yuklash");
    expect(archiveUz.old.viewBatches).toBe("Filial paketlari");
  });
});
