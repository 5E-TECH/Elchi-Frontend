import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SellModal from "./SellModal";
import CancelModal from "./CancelModal";
import RollbackOrderDialog from "./RollbackOrderDialog";
import { notifyOrderActionDone } from "./orderActionModel";
import { renderWithProviders } from "../../../../../test/test-utils";

/**
 * Dizayn v2 amal oynalari: menejer varianti (`manager-orders-*-dialog`), dalil fayli,
 * qaytarish tasdig'i (`*-rollback-*`) va bajarilgan amal xabari.
 */

const order = {
  id: "10297",
  status: "waiting",
  total_price: 360000,
  where_deliver: "center",
  market: { name: "Baraka Shop" },
  customer: { name: "Farrux Yo'ldoshev", phone_number: "+998915072364" },
  district: { name: "Urgut tumani" },
  items: [
    { id: "i1", quantity: 2, product: { id: "1", name: "Simsiz quloqchin" } },
    { id: "i2", quantity: 1, product: { id: "2", name: "Tez zaryadlovchi qurilma" } },
  ],
};

const file = (name: string, sizeMb: number, type = "image/jpeg") => {
  const blob = new File(["x"], name, { type });
  Object.defineProperty(blob, "size", { value: sizeMb * 1024 * 1024 });
  return blob;
};

describe("SellModal — menejer varianti (manager-orders-sell-dialog)", () => {
  const renderManagerSell = (props: Partial<Parameters<typeof SellModal>[0]> = {}) =>
    renderWithProviders(
      <SellModal order={order} open variant="manager" onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} {...props} />,
    );

  it("sarlavha «Buyurtmani sotish», izoh «№ · market · yetkazish», mijoz bloki formatlangan", () => {
    renderManagerSell();
    const dialog = screen.getByRole("dialog", { name: "Buyurtmani sotish" });
    expect(dialog).toHaveTextContent("№10297 · Baraka Shop · Markazgacha");
    const customer = within(dialog).getByRole("group", { name: "Mijoz" });
    expect(customer).toHaveTextContent("Farrux Yo'ldoshev");
    expect(customer).toHaveTextContent("+998 91 507 23 64");
    expect(customer).toHaveTextContent("Urgut tumani");
    expect(customer).toHaveTextContent(/Jami summa\s*360\D000 so'm/);
    // Xarajat maydoni ostida qisqa eslatma (summa yozilmaguncha).
    expect(screen.getByText("Kiritilsa, market tasdig'idan o'tadi")).toBeInTheDocument();
  });

  it("qisman sotishda summa yorlig'i «To'langan summa», sarlavha o'zgarmaydi; yuborish avvalgidek", async () => {
    const user = userEvent.setup();
    const onPartlySell = vi.fn();
    renderManagerSell({ onPartlySell });

    await user.click(screen.getByRole("switch", { name: /Qisman sotish/ }));
    expect(screen.getByRole("dialog", { name: "Buyurtmani sotish" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Simsiz quloqchin soni" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Simsiz quloqchin sonini kamaytirish" }));
    await user.type(screen.getByLabelText(/^To'langan summa/), "240000");
    expect(screen.getByLabelText(/^To'langan summa/)).toHaveValue("240 000");
    expect(screen.getByText(/360\D000 so'mdan oshmasin/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    expect(onPartlySell).toHaveBeenCalledWith("10297", {
      order_item_info: [
        { order_item_id: "i1", product_id: "1", quantity: 1 },
        { order_item_id: "i2", product_id: "2", quantity: 1 },
      ],
      totalPrice: 240000,
      extraCost: 0,
      comment: "",
    });
  });

  it("yozilgan xarajat — eslatma o'rnida to'liq ogohlantirish", async () => {
    const user = userEvent.setup();
    renderManagerSell();
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "20000");
    expect(screen.queryByText("Kiritilsa, market tasdig'idan o'tadi")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/market tasdig'idan o'tadi/);
  });

  it("tanlangan dalil fayli: nom, hajm, tur; «Faylni olib tashlash» uni bo'shatadi", async () => {
    const user = userEvent.setup();
    const { container } = renderManagerSell({
      order: { ...order, market: { name: "Zamon", expense_proof_conditions: ["sell_any"] } },
    });
    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(screen.getByRole("button", { name: /^Sotish$/ })).toBeDisabled();

    await user.upload(input, file("IMG_2041.jpg", 2.4));
    expect(screen.getByText("IMG_2041.jpg")).toBeInTheDocument();
    expect(screen.getByText(/2,4 MB · rasm/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sotish$/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Faylni olib tashlash" }));
    expect(screen.queryByText("IMG_2041.jpg")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sotish$/ })).toBeDisabled();
  });
});

describe("SellModal — kuryer dalil fayli", () => {
  it("10 MB dan katta fayl rad etiladi va sababi maydon ostida", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} />,
    );
    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, file("video.mp4", 12, "video/mp4"));
    expect(screen.getByText("Fayl hajmi 10 MB dan oshmasin")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("tanlangan fayl: «2,4 MB · 10 MB gacha» va «Almashtirish»", async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(
      <SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} />,
    );
    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, file("IMG_4127.jpg", 2.4));
    expect(screen.getByText("IMG_4127.jpg")).toBeInTheDocument();
    expect(screen.getByText("2,4 MB · 10 MB gacha")).toBeInTheDocument();
    expect(screen.getByText("Almashtirish")).toBeInTheDocument();
  });

  it("so'rov ketayotganda «Sotish» yuklanishda va qayta yuborilmaydi", async () => {
    const user = userEvent.setup();
    const onSell = vi.fn();
    renderWithProviders(
      <SellModal order={order} open isLoading onClose={vi.fn()} onSell={onSell} onPartlySell={vi.fn()} />,
    );
    const submit = screen.getByRole("button", { name: /^Sotish$/ });
    expect(submit).toHaveAttribute("aria-busy", "true");
    await user.click(submit);
    expect(onSell).not.toHaveBeenCalled();
  });
});

describe("CancelModal — menejer varianti (manager-orders-cancel-dialog)", () => {
  it("sarlavha va izoh maketdagidek, mijoz bloki ikonkali", () => {
    renderWithProviders(
      <CancelModal order={{ ...order, where_deliver: "address" }} open variant="manager" onClose={vi.fn()} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Buyurtmani bekor qilish" });
    expect(dialog).toHaveTextContent("№10297 · Baraka Shop · Uygacha");
    expect(within(dialog).getByRole("group", { name: "Mijoz" })).toHaveTextContent("+998 91 507 23 64");
    expect(within(dialog).getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)).toBeDisabled();
  });
});

describe("RollbackOrderDialog", () => {
  const soldOrder = {
    id: "10237",
    status: "sold",
    total_price: 365000,
    where_deliver: "address",
    market: { name: "Chilonzor Market" },
    customer: { name: "Aziz Rahimov", phone_number: "+998905521708" },
    district: { name: "Jomboy tumani" },
  };

  it("kuryer (courier-orders-rollback-confirm): «Holatni qayta tiklash», holat o'zgarishi, fokus «Orqaga» da", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<RollbackOrderDialog order={soldOrder} onConfirm={onConfirm} onCancel={onCancel} />);

    const dialog = screen.getByRole("alertdialog", { name: "Holatni qayta tiklash" });
    expect(dialog).toHaveAccessibleDescription("Ushbu buyurtmani kutilayotgan holatga qayta tiklaysizmi?");
    expect(dialog).toHaveTextContent("Aziz Rahimov");
    expect(dialog).toHaveTextContent("№10237");
    expect(dialog).toHaveTextContent("+998 90 552 17 08");
    expect(dialog).toHaveTextContent(/365\D000 so'm/);
    expect(within(dialog).getByText("Sotilgan holatidan Kutilmoqda holatiga")).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Orqaga" })).toHaveFocus());

    await user.click(screen.getByRole("button", { name: "Ha, qayta tiklash" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Orqaga" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("menejer (manager-orders-rollback-dialog): «Buyurtmani qaytarish», savol, «Ha, qaytarish»", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <RollbackOrderDialog order={soldOrder} variant="manager" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Buyurtmani qaytarish" });
    expect(dialog).toHaveAccessibleDescription(
      "№10237 · Chilonzor Market · Uygacha Buyurtma «Kutilmoqda» holatiga qaytariladi. Davom etasizmi?",
    );
    expect(within(dialog).getByRole("group", { name: "Mijoz" })).toHaveTextContent(/Jami summa\s*365\D000 so'm/);
    await user.click(screen.getByRole("button", { name: "Ha, qaytarish" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("so'rov ketayotganda Esc va «Orqaga» yopmaydi, tasdiq tugmasi yuklanishda", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<RollbackOrderDialog order={soldOrder} loading onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByRole("button", { name: "Orqaga" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ha, qayta tiklash" })).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Ha, qayta tiklash" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("`order={null}` — oyna yo'q", () => {
    renderWithProviders(<RollbackOrderDialog order={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("notifyOrderActionDone — bajarilgan amal xabari", () => {
  it.each([
    ["sell", "Buyurtma sotildi"],
    ["partly_sell", "Buyurtma qisman sotildi"],
    ["cancel", "Buyurtma bekor qilindi"],
    ["rollback", "Buyurtma qayta tiklandi"],
  ] as const)("%s → «%s» + «№ · mijoz»", async (kind, title) => {
    renderWithProviders(<div />);
    act(() => notifyOrderActionDone(kind, { id: "10239", customer: { name: "Laylo Hasanova" } }));
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText("№10239 · Laylo Hasanova")).toBeInTheDocument();
  });
});

describe("Amal oynalari — fokus va e'lonlar (a11y)", () => {
  // Sahifadagidek: so'rov javobi «tasdiq kerak» bo'lsa sahifa `awaitingApproval` ni yoqadi (oyna o'sha).
  // (`renderWithProviders().rerender` provayderlarsiz chizadi — oyna qaytadan o'rnatilib, holat yo'qolardi.)
  const SellHarness = () => {
    const [awaiting, setAwaiting] = useState(false);
    return (
      <SellModal
        order={order}
        open
        awaitingApproval={awaiting}
        onClose={vi.fn()}
        onSell={() => setAwaiting(true)}
        onPartlySell={vi.fn()}
      />
    );
  };
  const CancelHarness = () => {
    const [awaiting, setAwaiting] = useState(false);
    return <CancelModal order={order} open awaitingApproval={awaiting} onClose={vi.fn()} onCancel={() => setAwaiting(true)} />;
  };

  it("market tasdig'iga tushgach fokus «Yopish» da (bosilgan «Sotish» yo'qoladi, fokus body'ga tushmaydi)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SellHarness />);
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "20000");
    await user.click(screen.getByRole("button", { name: /^Sotish$/ }));

    const dialog = screen.getByRole("dialog", { name: "Market tasdig'i kutilmoqda" });
    expect(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)).toHaveFocus();
  });

  it("bekor qilish ham: tasdiqqa tushgach fokus «Yopish» da", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CancelHarness />);
    await user.type(screen.getByLabelText("Qo'shimcha xarajat"), "15000");
    await user.click(screen.getByRole("combobox", { name: /^Sabab/ }));
    await user.click(await screen.findByRole("option", { name: "Mijoz rad etdi" }));
    await user.click(screen.getAllByRole("button", { name: /^Bekor qilish$/ }).at(-1)!);

    const dialog = screen.getByRole("dialog", { name: "Market tasdig'i kutilmoqda" });
    expect(within(dialog).getAllByRole("button", { name: "Yopish" }).at(-1)).toHaveFocus();
  });

  it("qisman sotish: «−» o'zi o'chsa fokus shu qatordagi «+» ga o'tadi; chegara xatosi e'lon qilinadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} />);
    await user.click(screen.getByRole("switch", { name: /Qisman sotish/ }));

    // 2 + 1 dona: zaryadlovchini 0 ga tushirish — uning «−» si o'chadi.
    await user.click(screen.getByRole("button", { name: "Tez zaryadlovchi qurilma sonini kamaytirish" }));
    expect(screen.getByRole("button", { name: "Tez zaryadlovchi qurilma sonini kamaytirish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tez zaryadlovchi qurilma sonini oshirish" })).toHaveFocus();

    // Quloqchin 2 → 1: jami 1 dona — «−» o'chadi, xato `alert` bilan.
    await user.click(screen.getByRole("button", { name: "Simsiz quloqchin sonini kamaytirish" }));
    expect(screen.getByRole("button", { name: "Simsiz quloqchin sonini oshirish" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Kamida 1 ta mahsulot qolishi kerak");
  });

  it("dalil maydoni matni maketdagidek: kuryer «Rasm/video yuklash», menejer «Rasm yoki video yuklash»", () => {
    const { unmount } = renderWithProviders(
      <SellModal order={order} open onClose={vi.fn()} onSell={vi.fn()} onPartlySell={vi.fn()} />,
    );
    expect(screen.getByText("Rasm/video yuklash")).toBeInTheDocument();
    unmount();
    renderWithProviders(
      <CancelModal order={order} open variant="manager" onClose={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("Rasm yoki video yuklash")).toBeInTheDocument();
  });

  it("menejer qaytarish oynasi: mijoz qatori «telefon · tuman»", () => {
    renderWithProviders(
      <RollbackOrderDialog order={{ ...order, status: "sold" }} variant="manager" onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: "Mijoz" })).toHaveTextContent(/\+998 91 507 23 64\s*·\s*Urgut tumani/);
  });
});
