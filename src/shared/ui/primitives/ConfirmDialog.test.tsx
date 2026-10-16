import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarClock, Trash2 } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { ConfirmDialog, ConfirmDialogPanel, type ConfirmDialogProps } from "./ConfirmDialog";

/**
 * ConfirmDialog — taxta `tizim-feedback` 06 «Tasdiqlash oynalari» va `tizim-motion` 03: `alertdialog`,
 * fokus xavfsiz «Bekor qilish» da, aniq fe'l, ton → tugma rangi, mazmun bloklari (ob'ekt, summa,
 * qatorlar, oqibatlar, «qaytarib bo'lmaydi»), va'da paytida qulf, xato oyna ichida.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

type HarnessProps = Partial<ConfirmDialogProps>;

const Harness = (props: HarnessProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mahsulotni o'chirish
      </button>
      <ConfirmDialog
        open={open}
        tone="danger"
        title="O'chirishni tasdiqlang"
        description="Mahsulot katalogdan butunlay o'chiriladi."
        confirmLabel="O'chirish"
        confirmIcon={Trash2}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
        {...props}
      />
    </>
  );
};

const openConfirm = async (props: HarnessProps = {}) => {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  const opener = screen.getByRole("button", { name: "Mahsulotni o'chirish" });
  await user.click(opener);
  return { user, opener, dialog: screen.getByRole("alertdialog", { name: "O'chirishni tasdiqlang" }) };
};

describe("ConfirmDialog — tuzilma", () => {
  it("alertdialog: nom, izoh; fokus «Bekor qilish» da (xavfsiz tugma)", async () => {
    const { dialog } = await openConfirm();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Mahsulot katalogdan butunlay o'chiriladi.");
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toHaveFocus();
  });

  it("ton → tugma: danger qizil, success yashil, primary (sukut) ko'k", () => {
    const { rerender } = render(<ConfirmDialogPanel title="A" confirmLabel="O'chirish" tone="danger" />);
    expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-variant", "danger");
    rerender(<ConfirmDialogPanel title="A" confirmLabel="Tasdiqlash" tone="success" />);
    expect(screen.getByRole("button", { name: "Tasdiqlash" })).toHaveAttribute("data-variant", "success");
    rerender(<ConfirmDialogPanel title="A" confirmLabel="Yoqish" />);
    expect(screen.getByRole("button", { name: "Yoqish" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveAttribute("data-variant", "secondary");
  });

  it("danger — qizil doira ikonka; sarlavhada «Yopish» sukut bo'yicha yo'q", async () => {
    const { dialog } = await openConfirm();
    const icon = dialog.querySelector("[aria-hidden='true'].size-10.rounded-full");
    expect(icon).toHaveClass("bg-danger-soft", "text-danger-fg");
    expect(within(dialog).queryByRole("button", { name: "Yopish" })).not.toBeInTheDocument();
  });

  it("mazmun: ob'ekt, summa (formatMoney), qatorlar, oqibatlar, eslatma, «qaytarib bo'lmaydi»", () => {
    render(
      <ConfirmDialogPanel
        title="To'lovni tasdiqlang"
        confirmLabel="Tasdiqlash"
        tone="success"
        details={<span>Simsiz quloqchin Pro</span>}
        amount={{ value: 1250000, badge: <span>Naqd</span> }}
        rows={[
          { label: "Qayerdan", value: "Kuryer kassasi" },
          { label: "Qayerga", value: "Asosiy kassa" },
        ]}
        consequences={[
          { text: "4 ta sotilgan deb belgilanadi", tone: "success" },
          { text: "2 tasi ertaga qoladi", tone: "warning", icon: CalendarClock },
        ]}
        note="Hisobni vaqtincha to'xtatish kerak bo'lsa, nofaol qiling."
        irreversible
      />,
    );
    expect(screen.getByText("Simsiz quloqchin Pro")).toBeInTheDocument();
    expect(screen.getByText("Summa")).toBeInTheDocument();
    expect(screen.getByText("1 250 000")).toBeInTheDocument();
    expect(screen.getByText("so'm")).toBeInTheDocument();
    expect(screen.getByText("Naqd")).toBeInTheDocument();
    const terms = screen.getAllByRole("term").map((node) => node.textContent);
    expect(terms).toEqual(["Qayerdan", "Qayerga"]);
    const items = screen.getAllByRole("listitem").map((node) => node.textContent);
    expect(items).toEqual(["4 ta sotilgan deb belgilanadi", "2 tasi ertaga qoladi"]);
    expect(screen.getByText("Hisobni vaqtincha to'xtatish kerak bo'lsa, nofaol qiling.")).toBeInTheDocument();
    expect(screen.getByText("Bu amalni qaytarib bo'lmaydi.")).toHaveClass("min-w-0");
  });

  it("pul o'tkazmasi: qayerdan → qayerga (sukut yorliqlar), izoh ustma-ust, badge pastga tekislangan", () => {
    render(
      <ConfirmDialogPanel
        title="To'lovni tasdiqlang"
        confirmLabel="Tasdiqlash"
        tone="success"
        amount={{ value: 1250000, badge: <span>Naqd</span> }}
        transfer={{
          from: { title: "Kuryer kassasi", meta: "Jasur Tursunov" },
          to: { title: "Asosiy kassa", meta: "Toshkent HQ", label: "Kassaga" },
        }}
        rows={[{ label: "Izoh", value: "Kunlik topshiriq, 08.10.2026", stacked: true }]}
      />,
    );
    expect(screen.getByText("Qayerdan")).toBeInTheDocument();
    expect(screen.getByText("Kassaga")).toBeInTheDocument();
    expect(screen.queryByText("Qayerga")).not.toBeInTheDocument();
    expect(screen.getByText("Jasur Tursunov")).toHaveClass("text-text-muted");
    expect(screen.getByText("Toshkent HQ")).toBeInTheDocument();
    const note = screen.getByRole("term");
    expect(note).toHaveTextContent("Izoh");
    expect(note.parentElement).toHaveClass("flex-col");
    expect(screen.getByRole("definition")).toHaveTextContent("Kunlik topshiriq, 08.10.2026");
    expect(screen.getByText("Naqd").parentElement?.parentElement).toHaveClass("items-end");
  });

  it("oqibat `hint` bilan — ikonka ton qutisida, ikkinchi qator", () => {
    render(
      <ConfirmDialogPanel
        title="Kunni yakunlashni tasdiqlang"
        confirmLabel="Tasdiqlash"
        consequences={[
          { text: "4 ta sotilgan deb belgilanadi", hint: "2 tasi belgilanmagan, sukut bo'yicha", tone: "success" },
          { text: "1 ta bekor qilinadi", tone: "danger" },
        ]}
      />,
    );
    const [rich, plain] = screen.getAllByRole("listitem");
    expect(within(rich).getByText("2 tasi belgilanmagan, sukut bo'yicha")).toHaveClass("text-text-muted");
    expect(rich.querySelector("[aria-hidden='true'].size-9")).toHaveClass("bg-success-soft", "text-success-fg");
    expect(plain.querySelector(".size-9")).toBeNull();
  });

  it("«OK» / «Ha» yolg'iz — konsolda ogohlantirish (aniq fe'l kerak)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ConfirmDialogPanel title="A" confirmLabel="Ha" />);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("aniq fe'l"));
  });

  it("izohsiz oynada ob'ekt kartasi tavsif bo'ladi", async () => {
    const { dialog } = await openConfirm({ description: undefined, details: "Baraka Shop · Market" });
    expect(dialog).toHaveAccessibleDescription("Baraka Shop · Market");
  });
});

describe("ConfirmDialog — xatti-harakat", () => {
  it("«Bekor qilish», Esc va fon — onCancel; fokus ochgan tugmaga qaytadi", async () => {
    const onCancel = vi.fn();
    const { user, opener, dialog } = await openConfirm({ onCancel });
    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await user.keyboard("{Escape}");
    await user.click(dialog.closest<HTMLElement>("[data-dialog-root]")!);
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(opener).not.toHaveFocus();
  });

  it("tasdiqlash — onConfirm; oyna yopilgach fokus ochgan tugmaga qaytadi", async () => {
    const { user, opener, dialog } = await openConfirm();
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("va'da paytida: tugma yuklanishda, «Bekor qilish» o'chiq, Esc va fon yopmaydi", async () => {
    let resolve!: () => void;
    const onCancel = vi.fn();
    const onConfirm = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    const { user, dialog } = await openConfirm({ onConfirm, onCancel, loadingLabel: "O'chirilmoqda…" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    const busy = within(dialog).getByRole("button", { name: "O'chirilmoqda…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Bekor qilish" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(dialog.closest<HTMLElement>("[data-dialog-root]")!);
    await user.click(busy);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolve();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "O'chirish" })).not.toHaveAttribute("aria-busy"));
  });

  it("xato: oyna ochiq qoladi, xato matni ichida (`role=alert`), qayta urinish mumkin", async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(undefined);
    const { user, dialog } = await openConfirm({ onConfirm });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));

    const alert = await within(dialog).findByRole("alert");
    // Ichki inglizcha matn emas — umumiy o'zbekcha xabar.
    expect(alert).toHaveTextContent("Amalni bajarib bo'lmadi. Qayta urinib ko'ring.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("backend xato matni ko'rsatiladi; `errorMessage` bilan o'z matni", async () => {
    const backend = Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 400, data: { message: "Mahsulot faol buyurtmada bor" } },
    });
    const { user, dialog } = await openConfirm({ onConfirm: () => Promise.reject(backend) });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Mahsulot faol buyurtmada bor");
  });

  it("`errorMessage` — chaqiruvchi matni; sinxron xato ham ushlanadi", async () => {
    const { user, dialog } = await openConfirm({
      onConfirm: () => {
        throw new Error("boom");
      },
      errorMessage: () => "Kassa yopiq — avval smenani oching",
    });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Kassa yopiq — avval smenani oching");
  });

  it("tashqi `loading` — tugmalar qulf; qayta ochilganda eski xato yo'q", async () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        title="A"
        confirmLabel="O'chirish"
        loading
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Bekor qilish" })).toBeDisabled();

    rerender(
      <ConfirmDialog open title="A" confirmLabel="O'chirish" error="Xato" onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Xato");
  });
});
