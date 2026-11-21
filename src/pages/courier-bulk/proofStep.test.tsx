import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourierBulkPage from "./index";
import { renderWithProviders } from "../../test/test-utils";

/**
 * j9KFyqlS — `/courier-bulk` isbot yuboradi. Market isbot talab qilsa (`expense_proof_conditions`)
 * backend isbotsiz sotish/bekor qilishni 400 bilan rad etadi; ilgari ommaviy yopish isbot
 * yubormasdi va bunday marketda doim yiqilardi.
 *
 * Tekshiriladi: isbot qadami faqat isbot kerak bo'lgan buyurtmalar uchun, isbotsiz «Yakunlash»
 * o'chiq, fayl sotish so'roviga boradi (yakka so'rov, ko'pi bilan 2 tadan parallel), isbotsizlar
 * BULK so'rov bilan (20 tadan bo'lak, ketma-ket), xato berganlar sababi bilan ro'yxatda, har
 * so'rovda `X-Request-Source: courier-bulk`.
 *
 * BeePost modeli (ega 2026-11-21): belgilanmagan qator — sukut «sotildi». U isbot talab qilsa isbot
 * qadamiga kiradi; tasdiq oynasida belgilanmaganlar sotilishi belgilash katagi bilan tasdiqlanadi.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), sell: vi.fn(), cancel: vi.fn(), bulk: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
    BulkOrderAction: { mutateAsync: mocks.bulk, isPending: false },
  }),
}));

/** Isbotli (yakka) so'rov: har amal + buyurtma uchun barqaror kalit (qayta yuborishda o'zgarmaydi). */
const BULK_HEADERS = {
  "X-Request-Source": "courier-bulk",
  "Idempotency-Key": expect.stringMatching(/^courier-bulk:[^:]+:(sold|cancel):\d+$/),
};

/** Isbotsizlar (bulk so'rov): bitta yakunlash kaliti — barcha bo'laklarga ayni. */
const PLAIN_HEADERS = {
  "X-Request-Source": "courier-bulk",
  "Idempotency-Key": expect.stringMatching(/^courier-bulk:[^:]+$/),
};

const SOLD_COMMENT = "Kuryer tezkor amal orqali sotildi deb yakunladi";

type BulkCall = { action: "sold" | "cancel"; orderIds: string[]; comment?: string; headers?: Record<string, string> };
type BulkFailure = { order_id: string; status_code: number; message: string };

const bulkCalls = () => mocks.bulk.mock.calls.map(([call]) => call as BulkCall);

/** Server javobi: berilgan `failed` dan tashqari hammasi bajarildi. */
const bulkBody = ({ action, orderIds }: BulkCall, failed: BulkFailure[] = []) => {
  const failedIds = new Set(failed.map((failure) => failure.order_id));
  return {
    statusCode: 200,
    data: {
      action,
      total: orderIds.length,
      succeeded: orderIds.filter((orderId) => !failedIds.has(orderId)),
      failed: failed.filter((failure) => orderIds.includes(failure.order_id)),
    },
  };
};

type Conditions = string[] | null;

const order = (id: string, name: string, conditions: Conditions = null) => ({
  id,
  status: "waiting",
  total_price: 100000,
  qr_code_token: `TOKEN-${id}`,
  customer: { name, phone_number: "+998901112233" },
  district: { id: "d1", name: "Chilonzor tumani" },
  market: { id: `m-${id}`, name: "Baraka Shop", expense_proof_conditions: conditions },
});

const serve = (orders: ReturnType<typeof order>[]) =>
  mocks.get.mockResolvedValue({
    data: { statusCode: 200, data: { data: orders, total: orders.length } },
  });

const image = (name: string) => new File(["x"], name, { type: "image/jpeg" });

/** USB skaner: tez kiritilgan belgilar + Enter (boshlang'ich skanerlash rejimi — «Bekor qilish»). */
const scan = (value: string) => {
  for (const key of value) fireEvent.keyDown(window, { key });
  fireEvent.keyDown(window, { key: "Enter" });
};

/** Qatordagi natija tanlovi. */
const markAs = async (user: ReturnType<typeof userEvent.setup>, name: string, label: "Bekor" | "Ertaga") => {
  const group = await screen.findByRole("radiogroup", { name: `${name}: natija` });
  await user.click(within(group).getByRole("radio", { name: label }));
  expect(within(group).getByRole("radio", { name: label })).toBeChecked();
};

/** Belgilanmagan qator: sukut «Sotildi» tanlangan ko'rinadi. */
const expectDefaultSold = (name: string) => {
  const group = screen.getByRole("radiogroup", { name: `${name}: natija` });
  expect(within(group).getByRole("radio", { name: "Sotildi" })).toBeChecked();
  expect(within(group).getByRole("radio", { name: "Bekor" })).not.toBeChecked();
  expect(within(group).getByRole("radio", { name: "Ertaga" })).not.toBeChecked();
};

const openConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Kunni yakunlash/ }));
  return screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
};

/** Belgilanmaganlar sotilishini tasdiqlash katagi (bo'lsa) belgilanadi, keyin «Tasdiqlash». */
const confirmDialog = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) => {
  const acknowledge = within(dialog).queryByRole("checkbox", { name: /SOTILISHINI tushunaman/ });
  if (acknowledge) await user.click(acknowledge);
  await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
};

const confirmFinalize = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await openConfirm(user);
  await confirmDialog(user, dialog);
};

const proofInput = (group: HTMLElement) => group.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("CourierBulkPage — isbot qadami (j9KFyqlS)", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.get.mockReset();
    mocks.sell.mockReset().mockResolvedValue({});
    mocks.cancel.mockReset().mockResolvedValue({});
    mocks.bulk.mockReset().mockImplementation((call: BulkCall) => Promise.resolve(bulkBody(call)));
  });

  it("isbot kerak bo'lmasa — qo'shimcha qadamsiz bulk so'rov bilan yakunlanadi, so'rovda X-Request-Source", async () => {
    serve([order("10", "Ali"), order("11", "Vali", ["cancel_any"])]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    expectDefaultSold("Ali");
    expectDefaultSold("Vali");
    await confirmFinalize(user);

    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument();
    // #11 — market faqat bekor qilishda isbot so'raydi, sotishda yo'q → isbotsiz.
    expect(mocks.bulk).toHaveBeenCalledWith({
      action: "sold",
      orderIds: ["10", "11"],
      comment: SOLD_COMMENT,
      headers: PLAIN_HEADERS,
    });
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
  });

  it("isbot qadami faqat isbot talab qilinadigan buyurtmalar uchun; isbotsiz «Yakunlash» o'chiq", async () => {
    serve([order("10", "Ali", ["sell_any"]), order("11", "Vali")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await confirmFinalize(user);

    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    expect(dialog).toHaveTextContent("1 ta buyurtma uchun market rasm yoki video isbot talab qiladi");
    expect(within(dialog).getByRole("group", { name: "№10 · Ali" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "№11 · Vali" })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("Qolgan 1 ta buyurtma isbotsiz yakunlanadi.");
    expect(within(dialog).getByRole("button", { name: "Yakunlash" })).toBeDisabled();
    // Isbot tanlanmaguncha hech narsa yuborilmaydi (isbotsizlar ham).
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.bulk).not.toHaveBeenCalled();

    // «Orqaga» — hech narsa yuborilmaydi, natijalar joyida (sukut «Sotildi»).
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument());
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.bulk).not.toHaveBeenCalled();
    for (const name of ["Ali", "Vali"]) expectDefaultSold(name);
  });

  it("isbot tanlangach sotish so'roviga fayl boradi (yakka so'rov); isbotsiz buyurtma bulk bilan", async () => {
    serve([order("10", "Ali", ["sell_any"]), order("11", "Vali")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await confirmFinalize(user);
    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    const group = within(dialog).getByRole("group", { name: "№10 · Ali" });
    const proof = image("isbot_10.jpg");
    await user.upload(proofInput(group), proof);

    expect(within(group).getByText("isbot_10.jpg")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Isbot tanlandi: 1 / 1");
    const submit = within(dialog).getByRole("button", { name: "Yakunlash" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: SOLD_COMMENT, extraCost: 0, proof },
      headers: BULK_HEADERS,
    });
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(mocks.bulk).toHaveBeenCalledWith({
      action: "sold",
      orderIds: ["11"],
      comment: SOLD_COMMENT,
      headers: PLAIN_HEADERS,
    });
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument());
  });

  it("belgilanmagan isbotli qator ham (sukut «sotildi») isbot qadamiga kiradi; «Ertaga» — so'rovsiz", async () => {
    // #10, #11 — market sotishda isbot so'raydi, belgilanmagan (sukut «sotildi»); #12 — «Ertaga»; #13 — belgisiz oddiy.
    serve([
      order("10", "Ali", ["sell_any"]),
      order("11", "Vali", ["sell_any"]),
      order("12", "Gani"),
      order("13", "Hasan"),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await markAs(user, "Gani", "Ertaga");
    for (const name of ["Ali", "Vali", "Hasan"]) expectDefaultSold(name);

    const confirm = await openConfirm(user);
    expect(confirm).toHaveTextContent("4 ta buyurtma: quyidagilar bajariladi");
    expect(confirm).toHaveTextContent("3 ta sotilgan deb belgilanadi");
    expect(confirm).toHaveTextContent("Sotilgan holatiga o'tadi — 3 tasi belgilanmagan (skanerlanmagan)");
    expect(confirm).toHaveTextContent("1 tasi ertaga qoladi");
    expect(confirm).not.toHaveTextContent("o'zgarmaydi");
    expect(within(confirm).getByRole("note")).toHaveTextContent("3 ta buyurtma holati darhol o'zgaradi.");
    // Belgilash katagisiz «Tasdiqlash» o'chiq.
    expect(within(confirm).getByRole("button", { name: "Tasdiqlash" })).toBeDisabled();
    expect(
      within(confirm).getByRole("checkbox", { name: "Belgilanmagan 3 ta buyurtma SOTILISHINI tushunaman" }),
    ).not.toBeChecked();
    await confirmDialog(user, confirm);

    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    expect(dialog).toHaveTextContent("2 ta buyurtma uchun market rasm yoki video isbot talab qiladi");
    expect(within(dialog).getByRole("group", { name: "№10 · Ali" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "№11 · Vali" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "№12 · Gani" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "№13 · Hasan" })).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("Qolgan 1 ta buyurtma isbotsiz yakunlanadi.");
    expect(dialog).toHaveTextContent("Isbot tanlandi: 0 / 2");

    const proof10 = image("isbot_10.jpg");
    const proof11 = image("isbot_11.jpg");
    await user.upload(proofInput(within(dialog).getByRole("group", { name: "№10 · Ali" })), proof10);
    expect(within(dialog).getByRole("button", { name: "Yakunlash" })).toBeDisabled();
    await user.upload(proofInput(within(dialog).getByRole("group", { name: "№11 · Vali" })), proof11);
    expect(dialog).toHaveTextContent("Isbot tanlandi: 2 / 2");
    await user.click(within(dialog).getByRole("button", { name: "Yakunlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: SOLD_COMMENT, extraCost: 0, proof: proof10 },
      headers: BULK_HEADERS,
    });
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "11",
      data: { comment: SOLD_COMMENT, extraCost: 0, proof: proof11 },
      headers: BULK_HEADERS,
    });
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toEqual({ action: "sold", orderIds: ["13"], comment: SOLD_COMMENT, headers: PLAIN_HEADERS });
    // «Ertaga» — hech qanday so'rov yo'q.
    expect(mocks.sell).not.toHaveBeenCalledWith(expect.objectContaining({ orderId: "12" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    expect(await screen.findByText(/1 ta buyurtma ertaga qoldirildi\./)).toBeInTheDocument();
    expect(screen.queryByText(/belgilanmagan buyurtma o'zgarmadi/)).not.toBeInTheDocument();
    // Yakunlangandan keyin ham kechikkan so'rov yo'q.
    expect(mocks.sell).toHaveBeenCalledTimes(2);
    expect(mocks.bulk).toHaveBeenCalledTimes(1);
  });

  it("sotish isboti kerak qator «Ertaga» qoldirilsa — isbot qadamisiz darhol yakunlanadi", async () => {
    // #10 — market sotishda isbot so'raydi, lekin «Ertaga»: isbot qadamini ochmaydi, so'rov ketmaydi;
    // #11 — belgisiz (sukut «sotildi»), isbotsiz darhol bulk bilan yakunlanadi.
    serve([order("10", "Ali", ["sell_any"]), order("11", "Vali")]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await markAs(user, "Ali", "Ertaga");
    expectDefaultSold("Vali");

    const confirm = await openConfirm(user);
    expect(confirm).toHaveTextContent("1 ta sotilgan deb belgilanadi");
    expect(confirm).toHaveTextContent("1 tasi ertaga qoladi");
    expect(within(confirm).getByRole("note")).toHaveTextContent("1 ta buyurtma holati darhol o'zgaradi.");
    await confirmDialog(user, confirm);

    // Isbot qadami ochilsa isbot tanlanmaguncha so'rov ketmasdi — so'rov ketgani qadam yo'qligini bildiradi.
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument();
    expect(mocks.bulk).toHaveBeenCalledWith({
      action: "sold",
      orderIds: ["11"],
      comment: SOLD_COMMENT,
      headers: PLAIN_HEADERS,
    });
    expect(mocks.sell).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    expect(await screen.findByText(/1 ta buyurtma ertaga qoldirildi\./)).toBeInTheDocument();
    expect(mocks.bulk).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument();
  });

  it("10 MB dan katta fayl rad etiladi — sababi maydon ostida, «Yakunlash» o'chiqligicha", async () => {
    serve([order("10", "Ali", ["sell_any"])]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await confirmFinalize(user);
    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    const group = within(dialog).getByRole("group", { name: "№10 · Ali" });
    const big = new File(["x"], "video.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 12 * 1024 * 1024 });
    await user.upload(proofInput(group), big);

    expect(within(group).getByText("Fayl hajmi 10 MB dan oshmasin")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Yakunlash" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Isbot tanlandi: 0 / 1");
  });

  it("aralash ro'yxat: bekor qilish isboti (cancel_any) bekor qilish so'roviga, sotishlar to'g'ri yakunlanadi", async () => {
    serve([
      order("10", "Ali", ["cancel_any"]),
      order("11", "Vali", ["cancel_any"]),
      order("12", "Gani", ["sell_any"]),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    expect(await screen.findByText("Vali")).toBeInTheDocument();
    scan("TOKEN-11");
    expect(await screen.findByText("Vali bekor qilishga belgilandi")).toBeInTheDocument();
    // Ali va Gani — belgisiz (sukut «sotildi»).

    await confirmFinalize(user);
    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    // #10 — sotiladi, market faqat bekor qilishda isbot so'raydi → isbotsiz.
    expect(within(dialog).queryByRole("group", { name: "№10 · Ali" })).not.toBeInTheDocument();
    const cancelGroup = within(dialog).getByRole("group", { name: "№11 · Vali" });
    const sellGroup = within(dialog).getByRole("group", { name: "№12 · Gani" });
    expect(cancelGroup).toHaveTextContent("Bekor qilish");
    expect(cancelGroup).toHaveTextContent("Market bekor qilishda isbot talab qiladi");
    expect(sellGroup).toHaveTextContent("Market sotishda isbot talab qiladi");

    const cancelProof = image("bekor_11.jpg");
    const sellProof = image("sotuv_12.jpg");
    await user.upload(proofInput(cancelGroup), cancelProof);
    expect(within(dialog).getByRole("button", { name: "Yakunlash" })).toBeDisabled();
    await user.upload(proofInput(sellGroup), sellProof);
    await user.click(within(dialog).getByRole("button", { name: "Yakunlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledTimes(1));
    expect(mocks.cancel).toHaveBeenCalledWith({
      orderId: "11",
      data: { comment: "Kuryer tezkor amal orqali bekor qildi", extraCost: 0, proof: cancelProof },
      headers: BULK_HEADERS,
    });
    expect(mocks.sell).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "12", data: expect.objectContaining({ proof: sellProof }) }),
    );
    // #10 — isbotsiz, bulk sotish so'rovida (fayl yo'q).
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(1));
    expect(bulkCalls()[0]).toEqual({ action: "sold", orderIds: ["10"], comment: SOLD_COMMENT, headers: PLAIN_HEADERS });
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
  });

  it("isbotlilar ko'pi bilan 2 tadan parallel; isbotsizlar 20 tadan bo'lak bilan, bo'laklar ketma-ket, bitta kalit", async () => {
    const proofOrders = ["20", "21", "22", "23", "24"].map((id) => order(id, `Mijoz ${id}`, ["sell_any"]));
    const plainOrders = Array.from({ length: 45 }, (_, index) => order(String(100 + index), `Oddiy ${100 + index}`));
    serve([...proofOrders, ...plainOrders]);

    const inFlight = { proof: 0, bulk: 0 };
    const peak = { proof: 0, bulk: 0 };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 15));
    mocks.sell.mockImplementation(async () => {
      inFlight.proof += 1;
      peak.proof = Math.max(peak.proof, inFlight.proof);
      await tick();
      inFlight.proof -= 1;
      return {};
    });
    mocks.bulk.mockImplementation(async (call: BulkCall) => {
      inFlight.bulk += 1;
      peak.bulk = Math.max(peak.bulk, inFlight.bulk);
      await tick();
      inFlight.bulk -= 1;
      return bulkBody(call);
    });

    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    expect(await screen.findByText("Oddiy 144")).toBeInTheDocument();
    await confirmFinalize(user);

    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    for (const { id } of proofOrders) {
      const group = within(dialog).getByRole("group", { name: `№${id} · Mijoz ${id}` });
      await user.upload(proofInput(group), image(`isbot_${id}.jpg`));
    }
    await user.click(within(dialog).getByRole("button", { name: "Yakunlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(5));
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    expect(screen.getByText(/50 ta buyurtma muvaffaqiyatli yakunlandi/)).toBeInTheDocument();
    expect(peak.proof).toBe(2);
    // 45 ta isbotsiz = 3 ta bulk so'rov (20 + 20 + 5), bir vaqtda faqat bittasi; hammasi sahifa tartibida.
    expect(peak.bulk).toBe(1);
    expect(bulkCalls().map((call) => call.orderIds.length)).toEqual([20, 20, 5]);
    expect(bulkCalls().flatMap((call) => call.orderIds)).toEqual(plainOrders.map(({ id }) => id));
    expect(bulkCalls().every((call) => call.action === "sold")).toBe(true);
    // Bitta yakunlashning barcha bo'laklari — ayni `Idempotency-Key`.
    const keys = new Set(bulkCalls().map((call) => call.headers?.["Idempotency-Key"]));
    expect(keys.size).toBe(1);
    expect([...keys][0]).toMatch(/^courier-bulk:[^:]+$/);
  }, 30_000);

  it("xato berganlar ro'yxati — har buyurtma backend sababi bilan, sahifadagi tartibda; bajarilganlar soni", async () => {
    // #11 — isbotli (yakka so'rov, alohida navbatda), #12 — isbotsiz (bulk javobidagi `failed`): ro'yxat baribir
    // sahifa tartibida.
    serve([order("10", "Ali"), order("11", "Vali", ["sell_any"]), order("12", "Gani")]);
    mocks.sell.mockImplementation(async ({ orderId }: { orderId: string }) => {
      if (orderId === "11") {
        throw { response: { data: { message: "Buyurtma holati sotishga mos emas" } } };
      }
      return {};
    });
    // #12 — server sababsiz rad etdi (biznes xatosi, qayta yuborilmaydi).
    mocks.bulk.mockImplementation(async (call: BulkCall) =>
      bulkBody(call, [{ order_id: "12", status_code: 400, message: "" }]),
    );
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await confirmFinalize(user);
    const proofDialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    await user.upload(proofInput(within(proofDialog).getByRole("group", { name: "№11 · Vali" })), image("isbot_11.jpg"));
    await user.click(within(proofDialog).getByRole("button", { name: "Yakunlash" }));

    const dialog = await screen.findByRole("dialog", { name: "Yakunlashda xatolik" });
    expect(dialog).toHaveTextContent("2 ta buyurtma yakunlanmadi");
    expect(dialog).toHaveTextContent("1 ta buyurtma muvaffaqiyatli yakunlandi");
    const list = within(dialog).getByRole("list", { name: "Yakunlanmagan buyurtmalar" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("№11 · Vali");
    expect(rows[0]).toHaveTextContent("Buyurtma holati sotishga mos emas");
    expect(rows[1]).toHaveTextContent("№12 · Gani");
    expect(rows[1]).toHaveTextContent("Server sababini ko'rsatmadi");
    expect(screen.queryByText("Kun yakunlandi")).not.toBeInTheDocument();
    // 400 — qayta yuborilmaydi: bitta bulk so'rov (#10, #12).
    expect(mocks.bulk).toHaveBeenCalledTimes(1);
    expect(bulkCalls()[0].orderIds).toEqual(["10", "12"]);

    await user.click(within(dialog).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument());
  });
});
