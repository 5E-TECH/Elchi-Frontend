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
 * o'chiq, fayl sotish so'roviga boradi, qolganlari avvalgidek, isbotlilar ko'pi bilan 2 tadan
 * parallel, xato berganlar sababi bilan ro'yxatda, har so'rovda `X-Request-Source: courier-bulk`.
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), sell: vi.fn(), cancel: vi.fn() }));

vi.mock("../../shared/api/api", () => ({ api: { get: mocks.get } }));

vi.mock("../../entities/orders", () => ({
  useOrders: () => ({
    SellOrder: { mutateAsync: mocks.sell, isPending: false },
    CancelOrder: { mutateAsync: mocks.cancel, isPending: false },
  }),
}));

const BULK_HEADERS = { "X-Request-Source": "courier-bulk" };

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

/** USB skaner: tez kiritilgan belgilar + Enter (sukut rejim — «Bekor qilish»). */
const scan = (value: string) => {
  for (const key of value) fireEvent.keyDown(window, { key });
  fireEvent.keyDown(window, { key: "Enter" });
};

const confirmFinalize = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Kunni yakunlash/ }));
  const dialog = await screen.findByRole("alertdialog", { name: "Kunni yakunlashni tasdiqlang" });
  await user.click(within(dialog).getByRole("button", { name: "Tasdiqlash" }));
};

const proofInput = (group: HTMLElement) => group.querySelector<HTMLInputElement>('input[type="file"]')!;

describe("CourierBulkPage — isbot qadami (j9KFyqlS)", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.sell.mockReset().mockResolvedValue({});
    mocks.cancel.mockReset().mockResolvedValue({});
  });

  it("isbot kerak bo'lmasa — qo'shimcha qadamsiz yakunlanadi, so'rovda X-Request-Source", async () => {
    serve([order("10", "Ali"), order("11", "Vali", ["cancel_any"])]);
    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);

    await confirmFinalize(user);

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument();
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: "Kuryer tezkor amal orqali sotildi deb yakunladi", extraCost: 0 },
      headers: BULK_HEADERS,
    });
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
    // Isbot tanlanmaguncha hech narsa yuborilmaydi.
    expect(mocks.sell).not.toHaveBeenCalled();

    // «Orqaga» — hech narsa yuborilmaydi, belgilar joyida.
    await user.click(within(dialog).getByRole("button", { name: "Orqaga" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument());
    expect(mocks.sell).not.toHaveBeenCalled();
  });

  it("isbot tanlangach sotish so'roviga fayl boradi; isbotsiz buyurtma avvalgidek", async () => {
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

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "10",
      data: { comment: "Kuryer tezkor amal orqali sotildi deb yakunladi", extraCost: 0, proof },
      headers: BULK_HEADERS,
    });
    expect(mocks.sell).toHaveBeenCalledWith({
      orderId: "11",
      data: { comment: "Kuryer tezkor amal orqali sotildi deb yakunladi", extraCost: 0 },
      headers: BULK_HEADERS,
    });
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Isbot yuklang" })).not.toBeInTheDocument());
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

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(2));
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.cancel).toHaveBeenCalledWith({
      orderId: "11",
      data: { comment: "Kuryer tezkor amal orqali bekor qildi", extraCost: 0, proof: cancelProof },
      headers: BULK_HEADERS,
    });
    expect(mocks.sell).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "12", data: expect.objectContaining({ proof: sellProof }) }),
    );
    expect(mocks.sell).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "10", data: expect.not.objectContaining({ proof: expect.anything() }) }),
    );
  });

  it("isbotli buyurtmalarda parallellik 2 dan oshmaydi, isbotsizlar avvalgidek 6 tagacha", async () => {
    const proofOrders = ["20", "21", "22", "23", "24"].map((id) => order(id, `Mijoz ${id}`, ["sell_any"]));
    const plainOrders = ["30", "31", "32", "33", "34", "35", "36", "37"].map((id) => order(id, `Oddiy ${id}`));
    serve([...proofOrders, ...plainOrders]);

    const inFlight = { proof: 0, plain: 0 };
    const peak = { proof: 0, plain: 0 };
    mocks.sell.mockImplementation(async ({ data }: { data: { proof?: File } }) => {
      const kind = data.proof ? "proof" : "plain";
      inFlight[kind] += 1;
      peak[kind] = Math.max(peak[kind], inFlight[kind]);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inFlight[kind] -= 1;
      return {};
    });

    const user = userEvent.setup();
    renderWithProviders(<CourierBulkPage />);
    await confirmFinalize(user);

    const dialog = await screen.findByRole("dialog", { name: "Isbot yuklang" });
    for (const { id } of proofOrders) {
      const group = within(dialog).getByRole("group", { name: `№${id} · Mijoz ${id}` });
      await user.upload(proofInput(group), image(`isbot_${id}.jpg`));
    }
    await user.click(within(dialog).getByRole("button", { name: "Yakunlash" }));

    await waitFor(() => expect(mocks.sell).toHaveBeenCalledTimes(13));
    expect(await screen.findByText("Kun yakunlandi")).toBeInTheDocument();
    expect(peak.proof).toBe(2);
    expect(peak.plain).toBeGreaterThan(2);
    expect(peak.plain).toBeLessThanOrEqual(6);
  });

  it("xato berganlar ro'yxati — har buyurtma backend sababi bilan, sahifadagi tartibda; bajarilganlar soni", async () => {
    // #11 — isbotli (alohida navbatda), #12 — isbotsiz: ro'yxat baribir sahifa tartibida.
    serve([order("10", "Ali"), order("11", "Vali", ["sell_any"]), order("12", "Gani")]);
    mocks.sell.mockImplementation(async ({ orderId }: { orderId: string }) => {
      if (orderId === "11") {
        throw { response: { data: { message: "Buyurtma holati sotishga mos emas" } } };
      }
      if (orderId === "12") throw {};
      return {};
    });
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

    await user.click(within(dialog).getByRole("button", { name: "Tushunarli" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Yakunlashda xatolik" })).not.toBeInTheDocument());
  });
});
