import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MailItem } from "../../../entities/mails";
import i18n from "../../../i18n";
import { expectNoRawBackendText, mockRejection } from "../../../test/mockEnvelope";
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
  useDispatchBranchNames: vi.fn(),
}));

vi.mock("../../../entities/branch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../entities/branch")>()),
  useDispatchBranchNames: mocks.useDispatchBranchNames,
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
const APPROVE_DIALOG = { name: "Qaytarish so'rovlarini tasdiqlang" };
const REJECT_DIALOG = { name: "Qaytarish so'rovlarini rad eting" };
/** Oynadagi kuryer guruhlari (ichki buyurtma ro'yxatisiz) — matni bilan. */
const topGroups = (dialog: HTMLElement) => {
  const groups = within(dialog).getByRole("list", { name: "Kuryerlar bo'yicha" });
  return within(groups)
    .getAllByRole("listitem")
    .filter((item) => item.parentElement === groups)
    .map((item) => item.textContent);
};

describe("ReturnMails (Pochta → Qaytarish)", () => {
  beforeEach(() => {
    mocks.useDispatchBranchNames.mockReset().mockReturnValue(new Map());
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
      within(region).getByText("Tasdiqlangan buyurtmalar omborga qaytadi, rad etilganlari joyida qoladi (kuryerda yoki filial pochtasida)"),
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

/**
 * u5HTJtqK — «Tasdiqlash» / «Rad etish» faqat tasdiq oynasi orqali (maket `superadmin-ops-logistics-approve-dialog`,
 * Ops'dagi «Qaytarish so'rovlari» nusxasidan ko'chgan — OS-3 testlari shu yerga ko'chirildi). Oyna va xabar haqiqiy
 * UI orqali (`renderWithProviders` — `ConfirmHost` + `Toaster`), mock emas.
 */
describe("ReturnMails — tasdiq oynasi va natija (u5HTJtqK)", () => {
  /** 7 ta: Jasur — 5 (aralash holat), Sherzod — 1, kuryersiz — 1; HQ doirasi (`action: center`). */
  const order = (id: string, courier: MailItem["courier"], status: string) =>
    request({
      id,
      request_id: id,
      order_id: id,
      courier,
      courier_id: courier?.id ?? "",
      status,
      action: "center",
      customer: { id: `c${id}`, name: `Mijoz ${id}`, phone_number: "+998901112233", extra_number: null },
    });
  const jasur = { id: "56", name: "Jasur Tursunov", phone_number: "+998901112233" };
  const sherzod = { id: "57", name: "Sherzod Komilov", phone_number: "+998901112244" };
  const SEVEN = [
    order("9001", jasur, "waiting"),
    order("9002", jasur, "on the road"),
    order("9003", jasur, "waiting"),
    order("9004", jasur, "on the road"),
    order("9005", jasur, "waiting"),
    order("9007", null, "waiting"),
    order("9006", sherzod, "waiting"),
  ];
  const ALL_IDS = ["9001", "9002", "9003", "9004", "9005", "9007", "9006"];

  const openDialog = async (user: ReturnType<typeof userEvent.setup>, action: "approve" | "reject" = "approve") => {
    await user.click(screen.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }));
    await user.click(
      within(selectionRegion()).getByRole("button", { name: action === "approve" ? "Tasdiqlash" : "Rad etish" }),
    );
    return screen.findByRole("alertdialog", action === "approve" ? APPROVE_DIALOG : REJECT_DIALOG);
  };

  beforeEach(() => {
    mocks.useDispatchBranchNames.mockReset().mockReturnValue(new Map());
    mocks.useGetReturnMails.mockReturnValue(listResult(SEVEN));
    mocks.approveMutateAsync.mockReset().mockResolvedValue({
      statusCode: 200,
      message: "Qaytarish so'rovlari tasdiqlandi — buyurtmalar omborga qaytarildi",
      data: { approved: 7, order_ids: ALL_IDS, skipped_order_ids: [] },
    });
    mocks.rejectMutateAsync.mockReset().mockResolvedValue({ statusCode: 200, data: { rejected: 7, skipped_order_ids: [] } });
  });

  afterEach(async () => {
    await i18n.changeLanguage("uz");
  });

  it("⭐ oynasiz so'rov ketmaydi: HQ ombori, buyurtma va kuryer soni, kuryersiz qator, guruhlar, eslatma; «Bekor qilish» — tanlov saqlanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    expect(mocks.approveMutateAsync).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent(
      "7 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi. Holati «Kutilmoqda» bo'ladi, kuryer va pochtadan ajratiladi.",
    );
    expect(within(dialog).getByText("Buyurtmalar").nextSibling).toHaveTextContent("7 ta");
    expect(within(dialog).getByText("Kuryerlar").nextSibling).toHaveTextContent("2 ta");
    expect(within(dialog).getByText("+ 1 ta buyurtma kuryersiz")).toBeInTheDocument();
    // Ro'yxat tartibida, kuryersiz guruh — oxirida («Kuryer biriktirilmagan», jadvaldagi «Kuryer» emas).
    expect(topGroups(dialog)).toEqual([
      expect.stringContaining("Jasur Tursunov5 ta"),
      expect.stringContaining("Sherzod Komilov1 ta"),
      expect.stringContaining("Kuryer biriktirilmagan1 ta"),
    ]);
    const groups = within(dialog).getByRole("list", { name: "Kuryerlar bo'yicha" });
    const jasurGroup = within(groups).getByText("Jasur Tursunov").closest("li")!;
    // Har kuryerda birinchi 3 buyurtma, qolgani «+ yana N ta»; avatar — bosh harflar.
    expect(within(jasurGroup).getByText("№9001")).toBeInTheDocument();
    expect(within(jasurGroup).queryByText("№9004")).not.toBeInTheDocument();
    expect(within(jasurGroup).getByText("+ yana 2 ta")).toBeInTheDocument();
    expect(within(jasurGroup).getByText("JT")).toBeInTheDocument();
    // Holat — jadval badge'i matni (`on the road` → «Kuryer qabul qilmagan»), xom qiymat emas.
    expect(within(jasurGroup).getByText("Kuryer qabul qilmagan")).toBeInTheDocument();
    expect(within(jasurGroup).getAllByText("Kuryer qo'lida")).toHaveLength(2);
    expect(dialog).not.toHaveTextContent("on the road");
    // Telefonda guruhlar ro'yxati 30dvh bilan cheklanadi — xato bloki pastki tugmalar ortida qolmaydi.
    expect(groups.className).toContain("max-md:max-h-[min(340px,30dvh)]");
    expect(
      within(dialog).getByText(
        "Bu amalni bekor qilib bo'lmaydi. Shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan buyurtma o'tkazib yuboriladi va natijada ko'rsatiladi.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", APPROVE_DIALOG)).not.toBeInTheDocument());
    expect(mocks.approveMutateAsync).not.toHaveBeenCalled();
    expect(within(selectionRegion()).getByText("7 ta so'rov tanlandi")).toBeInTheDocument();
  });

  it("filial doirasida (`action: branch`) — «filial omboriga qaytariladi»", async () => {
    const user = userEvent.setup();
    mocks.useGetReturnMails.mockReturnValue(listResult(SEVEN.map((item) => ({ ...item, action: "branch" }))));
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    expect(dialog).toHaveTextContent("7 ta buyurtma kuryerlardan olinadi va filial omboriga qaytariladi.");
  });

  it("⭐ hammasi tasdiqlansa — `{ order_ids }` oynadan, muvaffaqiyat xabari, oyna yopiladi, tanlov tozalanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ALL_IDS });
    expect(mocks.rejectMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("7 ta tasdiqlandi")).toBeInTheDocument();
    expect(screen.getByText("7 ta buyurtma omborga qaytarildi.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog", APPROVE_DIALOG)).not.toBeInTheDocument());
    expect(within(selectionRegion()).getByText("Hech biri tanlanmagan")).toBeInTheDocument();
    expect(within(selectionRegion()).getByRole("button", { name: "Tasdiqlash" })).toBeDisabled();
  });

  it("qisman: «N ta tasdiqlandi, M tasi o'tkazib yuborildi» ogohlantirishi va o'tkazilgan buyurtma raqami", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 6, order_ids: [], skipped_order_ids: ["9004"] } });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("6 ta tasdiqlandi, 1 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "6 ta buyurtma omborga qaytarildi. №9004 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.",
      ),
    ).toBeInTheDocument();
  });

  it("ko'p o'tkazib yuborilsa — 3 tasi raqami bilan, qolgani «va yana N ta»", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({
      statusCode: 200,
      data: { approved: 2, skipped_order_ids: ["9001", "9002", "9003", "9004", "9005"] },
    });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("2 ta tasdiqlandi, 5 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 ta buyurtma omborga qaytarildi. №9001, №9002, №9003 va yana 2 tasini shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.",
      ),
    ).toBeInTheDocument();
  });

  it("hech biri tasdiqlanmasa — «0 ta buyurtma omborga qaytarildi» yozilmaydi", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 0, skipped_order_ids: ["9004"] } });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("0 ta tasdiqlandi, 1 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(screen.getByText("№9004 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.")).toBeInTheDocument();
    expect(screen.queryByText(/omborga qaytarildi/)).not.toBeInTheDocument();
  });

  it("javobda son bo'lmasa — yuborilganlar soni (o'tkazilganlarsiz)", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: null });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await screen.findByText("7 ta tasdiqlandi")).toBeInTheDocument();
    expect(screen.queryByText(/o'tkazib yuborildi/)).not.toBeInTheDocument();
  });

  it("⭐ 409 (hammasi shu orada ko'rib chiqilgan) — «Tanlov eskirgan» oynada, xom backend matni yo'q, tanlov saqlanadi", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockRejectedValue(mockRejection(409));
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tanlov eskirgan: tanlangan so'rovlar shu orada ko'rib chiqilgan yoki holati o'zgargan. Ro'yxat yangilandi — oynani yoping va qayta tanlang.",
    );
    expectNoRawBackendText();
    expect(screen.getByRole("alertdialog", APPROVE_DIALOG)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", APPROVE_DIALOG)).not.toBeInTheDocument());
    expect(within(selectionRegion()).getByText("7 ta so'rov tanlandi")).toBeInTheDocument();
  });

  it("404 (eski backend) — o'sha «Tanlov eskirgan» matni", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockRejectedValue({
      response: { status: 404, data: { message: "Tanlangan buyurtmalarda ko'rib chiqilmagan qaytarish so'rovi topilmadi" } },
    });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/^Tanlov eskirgan:/);
    expect(screen.queryByText(/ko'rib chiqilmagan qaytarish so'rovi topilmadi/)).not.toBeInTheDocument();
  });

  it("403 — boshqa filial kuryeri: i18n sabab (backendning o'zbekcha matni emas), oyna ochiq", async () => {
    const user = userEvent.setup();
    const backendMessage = "Siz faqat o'z filialingiz kuryerlarining qaytarish so'rovlarini ko'rib chiqa olasiz";
    mocks.approveMutateAsync.mockRejectedValue({ response: { status: 403, data: { statusCode: 403, message: backendMessage } } });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ayrim buyurtmalar boshqa filial kuryerida — ularni o'sha filial ko'rib chiqadi. Ro'yxat yangilandi — oynani yoping va qayta tanlang.",
    );
    expect(screen.queryByText(backendMessage)).not.toBeInTheDocument();
    expect(screen.getByRole("alertdialog", APPROVE_DIALOG)).toBeInTheDocument();
  });

  it("5xx — «ayrimlari qaytgan bo'lishi mumkin», qayta urinish oynaning o'zidan", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockRejectedValueOnce(mockRejection(500));
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Tasdiqlashda xato yuz berdi. Ayrim buyurtmalar omborga qaytgan bo'lishi mumkin — ro'yxat yangilandi, tekshirib qayta urinib ko'ring.",
    );
    expectNoRawBackendText();

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await screen.findByText("7 ta tasdiqlandi")).toBeInTheDocument();
    expect(mocks.approveMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("vaqt chegarasi (timeout) — 5xx kabi matn, xom xato matni yo'q", async () => {
    const user = userEvent.setup();
    mocks.approveMutateAsync.mockRejectedValueOnce({ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 20000ms exceeded" });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/^Tasdiqlashda xato yuz berdi\./);
    expect(screen.queryByText(/timeout of/)).not.toBeInTheDocument();
  });

  it("xato chiqqanda oyna tanasi xato blokiga suriladi (telefonda pastda qolmasin)", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      mocks.approveMutateAsync.mockRejectedValueOnce(mockRejection(403));
      renderWithProviders(<ReturnMails layout="card" />);
      const dialog = await openDialog(user);
      await user.click(within(dialog).getByRole("button", { name: "7 tasini tasdiqlash" }));

      const alert = await within(dialog).findByRole("alert");
      await waitFor(() => expect(scrollIntoView.mock.contexts).toContain(alert));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("⭐ «Rad etish» — oyna (son, guruhlar), «Bekor qilish» so'rovsiz; tasdiqlansa — `reject { order_ids }` va xabar", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);
    let dialog = await openDialog(user, "reject");

    expect(dialog).toHaveTextContent(
      "7 ta so'rov rad etiladi: buyurtmalar omborga qaytmaydi, kuryerda (yoki filial pochtasida) qoladi.",
    );
    expect(within(dialog).getByText("Jasur Tursunov")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog", REJECT_DIALOG)).not.toBeInTheDocument());
    expect(mocks.rejectMutateAsync).not.toHaveBeenCalled();

    await user.click(within(selectionRegion()).getByRole("button", { name: "Rad etish" }));
    dialog = await screen.findByRole("alertdialog", REJECT_DIALOG);
    await user.click(within(dialog).getByRole("button", { name: "7 tasini rad etish" }));

    expect(mocks.rejectMutateAsync).toHaveBeenCalledWith({ order_ids: ALL_IDS });
    expect(mocks.approveMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("7 ta so'rov rad etildi")).toBeInTheDocument();
    expect(screen.getByText("Buyurtmalar kuryerda yoki filial pochtasida qoldi.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog", REJECT_DIALOG)).not.toBeInTheDocument());
    expect(within(selectionRegion()).getByRole("button", { name: "Rad etish" })).toBeDisabled();
  });

  it("rad etish qisman: «6 ta rad etildi, 1 tasi o'tkazib yuborildi» va raqam", async () => {
    const user = userEvent.setup();
    mocks.rejectMutateAsync.mockResolvedValue({ statusCode: 200, data: { rejected: 6, skipped_order_ids: ["9004"] } });
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user, "reject");

    await user.click(within(dialog).getByRole("button", { name: "7 tasini rad etish" }));

    expect(await screen.findByText("6 ta rad etildi, 1 tasi o'tkazib yuborildi")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Buyurtmalar kuryerda yoki filial pochtasida qoldi. №9004 ni shu orada boshqa xodim ko'rib chiqqan yoki holati o'zgargan.",
      ),
    ).toBeInTheDocument();
  });

  it("rad etish 409 va 5xx — oynada i18n matn", async () => {
    const user = userEvent.setup();
    mocks.rejectMutateAsync.mockRejectedValueOnce(mockRejection(409)).mockRejectedValueOnce(mockRejection(502));
    renderWithProviders(<ReturnMails layout="card" />);
    const dialog = await openDialog(user, "reject");

    await user.click(within(dialog).getByRole("button", { name: "7 tasini rad etish" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/^Tanlov eskirgan:/);
    await user.click(within(dialog).getByRole("button", { name: "7 tasini rad etish" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Rad etishda xato yuz berdi. Ayrim so'rovlar rad etilgan bo'lishi mumkin",
      ),
    );
    expectNoRawBackendText();
  });

  it("en: ko'p o'tkazilgan — ko'plikda («them»), 3 tadan ko'p — «and N more»", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    mocks.approveMutateAsync
      .mockResolvedValueOnce({ statusCode: 200, data: { approved: 5, skipped_order_ids: ["9001", "9002"] } })
      .mockResolvedValueOnce({ statusCode: 200, data: { approved: 2, skipped_order_ids: ["9001", "9002", "9003", "9004", "9005"] } });
    renderWithProviders(<ReturnMails layout="card" />);
    const approveAll = async () => {
      await user.click(screen.getByRole("checkbox", { name: "Select all requests" }));
      await user.click(within(screen.getByRole("region", { name: "Selected requests" })).getByRole("button", { name: "Approve" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Confirm return requests" });
      await user.click(within(dialog).getByRole("button", { name: "Approve 7" }));
    };

    await approveAll();
    expect(
      await screen.findByText(
        "Returned to the warehouse: 5. №9001, №9002: another employee reviewed them meanwhile or their status changed.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await approveAll();
    expect(
      await screen.findByText(
        "Returned to the warehouse: 2. №9001, №9002, №9003 and 2 more: another employee reviewed them meanwhile or their status changed.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["ru", "Выбрать все запросы", "Выбранные запросы", "Подтвердить", "Подтвердите запросы на возврат", "Подтвердить 7", "Заказы (7) будут изъяты у курьеров и возвращены на склад HQ."],
    ["ru", "Выбрать все запросы", "Выбранные запросы", "Отклонить", "Отклоните запросы на возврат", "Отклонить 7", "Запросы (7) будут отклонены"],
    ["en", "Select all requests", "Selected requests", "Reject", "Reject return requests", "Reject 7", "Requests (7) will be rejected"],
  ] as const)("%s: «%s» → «%s» — oyna tanlangan tilda", async (language, selectAll, region, button, title, confirmLabel, description) => {
    await i18n.changeLanguage(language);
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />);
    await user.click(screen.getByRole("checkbox", { name: selectAll }));
    await user.click(within(screen.getByRole("region", { name: region })).getByRole("button", { name: button }));
    const dialog = await screen.findByRole("alertdialog", { name: title });
    expect(dialog).toHaveTextContent(description);
    expect(within(dialog).getByRole("button", { name: confirmLabel })).toBeInTheDocument();
    // Oyna global (`ConfirmHost`) — keyingi testga ochiq qolmasin.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

describe("ReturnMails — filial o'tkazmasi so'rovlari (menejer «kelmagan», HQ doirasi)", () => {
  /** Backend `{ courier: null, courier_id: null, source: 'branch_transfer', branch_id }` guruhidan kelgan qator. */
  const transfer = (id: string, branchId: string, customer: string, branchName = "") =>
    request({
      id,
      request_id: id,
      order_id: id,
      courier_id: "",
      courier: null,
      action: "center",
      customer: { id: `c${id}`, name: customer, phone_number: "+998901112233", extra_number: null },
      return_source: "branch_transfer",
      return_branch: { id: branchId, name: branchName },
    });
  const items = [
    request({ action: "center" }),
    transfer("201", "15", "Guli"),
    transfer("202", "16", "Nodir"),
    transfer("203", "15", "Olim"),
  ];
  const roleState = (role: string) => ({ role: { id: "1", role, region: null, name: role } }) as never;

  beforeEach(() => {
    mocks.useDispatchBranchNames.mockReset().mockReturnValue(
      new Map([
        ["15", "Guliston"],
        ["16", "Urgut"],
      ]),
    );
    mocks.useGetReturnMails.mockReturnValue(listResult(items));
    mocks.approveMutateAsync.mockResolvedValue({ statusCode: 200, data: { approved: 2 } });
  });

  it("har manzil filial — alohida guruh, filial nomi bilan; «Kuryer» guruhiga qo'shilmaydi, kuryer sanalmaydi", () => {
    renderWithProviders(<ReturnMails layout="card" />, { preloadedState: roleState("superadmin") });

    // Nomlar so'raladi (superadmin, nomsiz filial guruhi bor).
    expect(mocks.useDispatchBranchNames).toHaveBeenLastCalledWith(true);
    const table = screen.getByRole("table", { name: "Qaytarish so'rovlari" });
    expect(within(table).getByText("Ali")).toBeInTheDocument();
    expect(within(table).getByText("Filial: Guliston — kelmagan")).toBeInTheDocument();
    expect(within(table).getByText("Filial: Urgut — kelmagan")).toBeInTheDocument();
    expect(within(table).queryByText("Kuryer")).not.toBeInTheDocument();
    // Guliston guruhida ikkala buyurtma (201, 203), telefonsiz.
    expect(within(table).getByText("2 ta buyurtma qaytarish so'rovi")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Filial: Guliston — kelmagan: barchasini tanlash" })).toBeInTheDocument();
    // Holat chipi: filial qatorlarida «Filialga kelmagan», kuryer qatorida — avvalgidek.
    expect(within(table).getAllByText("Filialga kelmagan")).toHaveLength(3);
    expect(within(table).getAllByText("Kuryer qabul qilmagan")).toHaveLength(1);
    // Xulosa: 1 ta kuryer (filial guruhlari kuryer emas), 2 ta filial.
    expect(
      screen.getByText((_, node) => node?.textContent === "1 ta kuryer, 2 ta filial, 4 ta buyurtma"),
    ).toBeInTheDocument();
  });

  it("filial guruhini tanlab tasdiqlash — faqat shu filial buyurtmalari", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />, { preloadedState: roleState("superadmin") });

    await user.click(screen.getByRole("checkbox", { name: "Filial: Guliston — kelmagan: barchasini tanlash" }));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));
    const dialog = await screen.findByRole("alertdialog", APPROVE_DIALOG);
    await user.click(within(dialog).getByRole("button", { name: "2 tasini tasdiqlash" }));

    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["201", "203"] });
  });

  it("oynada: filial guruhlari kuryer sanalmaydi — «+ N ta buyurtma kuryersiz», kuryerlardan keyin, «Filialga kelmagan»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReturnMails layout="card" />, { preloadedState: roleState("superadmin") });

    await user.click(screen.getByRole("checkbox", { name: "Barcha so'rovlarni tanlash" }));
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));
    const dialog = await screen.findByRole("alertdialog", APPROVE_DIALOG);

    // HQ doirasi (`action: center`) — «HQ omboriga».
    expect(dialog).toHaveTextContent("4 ta buyurtma kuryerlardan olinadi va HQ omboriga qaytariladi.");
    expect(within(dialog).getByText("Kuryerlar").nextSibling).toHaveTextContent("1 ta");
    expect(within(dialog).getByText("+ 3 ta buyurtma kuryersiz")).toBeInTheDocument();
    expect(topGroups(dialog)).toEqual([
      expect.stringContaining("Ali1 ta"),
      expect.stringContaining("Filial: Guliston — kelmagan2 ta"),
      expect.stringContaining("Filial: Urgut — kelmagan1 ta"),
    ]);
    expect(within(dialog).getAllByText("Filialga kelmagan")).toHaveLength(3);
  });

  it("nom olinmasa (HQ menejeri — `dispatch-destinations` yopiq) — so'ralmaydi, «Filial o'tkazmasi», guruhlar baribir alohida", () => {
    mocks.useDispatchBranchNames.mockReturnValue(new Map());
    renderWithProviders(<ReturnMails layout="card" />, { preloadedState: roleState("manager") });

    expect(mocks.useDispatchBranchNames).toHaveBeenLastCalledWith(false);
    const table = screen.getByRole("table", { name: "Qaytarish so'rovlari" });
    expect(within(table).getAllByText("Filial o'tkazmasi — kelmagan")).toHaveLength(2);
    expect(within(table).queryByText("Kuryer")).not.toBeInTheDocument();
  });

  it("backend filial nomini bersa — o'sha, nomlar so'ralmaydi", () => {
    mocks.useGetReturnMails.mockReturnValue(listResult([transfer("201", "15", "Guli", "Sirdaryo filiali")]));
    renderWithProviders(<ReturnMails layout="card" />, { preloadedState: roleState("superadmin") });

    expect(mocks.useDispatchBranchNames).toHaveBeenLastCalledWith(false);
    expect(screen.getByText("Filial: Sirdaryo filiali — kelmagan")).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === "0 ta kuryer, 1 ta filial, 1 ta buyurtma"),
    ).toBeInTheDocument();
  });
});

describe("ReturnMails — telefon (< 768): guruh sarlavhasi va kartalar", () => {
  const original = window.matchMedia;
  beforeEach(() => {
    mocks.useDispatchBranchNames.mockReset().mockReturnValue(new Map());
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
    const dialog = await screen.findByRole("alertdialog", APPROVE_DIALOG);
    expect(mocks.approveMutateAsync).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "1 tasini tasdiqlash" }));
    expect(mocks.approveMutateAsync).toHaveBeenCalledWith({ order_ids: ["101"] });
  });
});

describe("mails locales — Qaytarish keys", () => {
  const KEYS = [
    "returnDestinationBranch",
    "returnStateNotReceived",
    "returnStateWithCourier",
    "returnStateNotArrived",
    "returnBranchGroup",
    "returnBranchGroupFallback",
  ] as const;
  const dictionaries = { uz, ru, en } as Record<string, Record<string, unknown>>;

  it.each(Object.keys(dictionaries))("%s has every new key with a non-empty text", (lang) => {
    KEYS.forEach((key) => {
      const value = dictionaries[lang][key];
      expect(typeof value === "string" && value.trim().length > 0).toBe(true);
    });
  });

  it("keeps the {{branch}} placeholder in the branch group name", () => {
    Object.values(dictionaries).forEach((dict) => {
      expect(dict.returnBranchGroup).toContain("{{branch}}");
    });
  });

  // u5HTJtqK: bir qatorli xabar (`apiRequest`) o'rnini tasdiq oynasi va `notify` (mailsArchive `return.*`) oldi.
  it.each(["returnApproveSuccess", "returnRejectSuccess", "returnActionError", "returnSkippedNote"])(
    "old one-line toast key %s is gone from every locale",
    (key) => {
      Object.values(dictionaries).forEach((dict) => expect(dict[key]).toBeUndefined());
    },
  );
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
      "Tasdiqlangan buyurtmalar omborga qaytadi, rad etilganlari joyida qoladi (kuryerda yoki filial pochtasida)",
    );
    expect(archiveUz.return.clearSelection).toBe("Tanlovni bekor qilish");
    expect(archiveUz.old.export).toBe("Excelga yuklash");
    expect(archiveUz.old.viewBatches).toBe("Filial paketlari");
  });
});
