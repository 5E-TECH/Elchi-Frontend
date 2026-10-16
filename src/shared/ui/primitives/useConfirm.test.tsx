import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { ConfirmHost } from "./ConfirmHost";
import { confirm, useConfirm, type ConfirmOptions } from "./useConfirm";

/**
 * `useConfirm()` / `confirm()` + `ConfirmHost`: va'da `true`/`false`, `onConfirm` yuklanishi va xatosi,
 * navbat (bir vaqtda bitta oyna), ikkinchi host chizmaydi, host yo'q — `false`, «Orqaga» bekor qiladi.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const DELETE: ConfirmOptions = {
  tone: "danger",
  title: "Foydalanuvchini o'chirish",
  description: "«Baraka Shop» foydalanuvchisini o'chirishni tasdiqlaysizmi?",
  confirmLabel: "O'chirish",
};

const Page = ({ options = DELETE, onResult }: { options?: ConfirmOptions; onResult: (ok: boolean) => void }) => {
  const ask = useConfirm();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        onResult(await ask(options));
        setBusy(false);
      }}
    >
      Foydalanuvchini o'chirish
    </button>
  );
};

const setup = (options?: ConfirmOptions) => {
  const user = userEvent.setup();
  const onResult = vi.fn();
  render(
    <>
      <ConfirmHost />
      <Page options={options} onResult={onResult} />
    </>,
  );
  return { user, onResult, opener: screen.getByRole("button", { name: "Foydalanuvchini o'chirish" }) };
};

describe("useConfirm", () => {
  it("tasdiqlansa `true`, oyna yopiladi", async () => {
    const { user, onResult, opener } = setup();
    await user.click(opener);
    const dialog = screen.getByRole("alertdialog", { name: "Foydalanuvchini o'chirish" });
    await user.click(within(dialog).getByRole("button", { name: "O'chirish" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("«Bekor qilish» va Esc — `false`", async () => {
    const { user, onResult, opener } = setup();
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));

    await user.click(opener);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult).toHaveBeenLastCalledWith(false);
  });

  it("`onConfirm` va'dasi: tugaguncha oyna ochiq va qulf; muvaffaqiyat — `true`", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user, onResult, opener } = setup({ ...DELETE, onConfirm, loadingLabel: "O'chirilmoqda…" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "O'chirish" }));

    expect(screen.getByRole("button", { name: "O'chirilmoqda…" })).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();

    await act(async () => finish());
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("`onConfirm` xatosi: oyna ochiq, xato ichida; keyin bekor qilinsa — `false`", async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error("500")));
    const { user, onResult, opener } = setup({ ...DELETE, onConfirm });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "O'chirish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Amalni bajarib bo'lmadi");
    expect(onResult).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("navbat: ikkinchi so'rov birinchisi yopilgach ochiladi", async () => {
    render(<ConfirmHost />);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirm({ title: "Birinchi", confirmLabel: "Tasdiqlash" });
      second = confirm({ title: "Ikkinchi", confirmLabel: "Yuborish" });
    });
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(screen.getByRole("alertdialog", { name: "Birinchi" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Tasdiqlash" }));
    await expect(first).resolves.toBe(true);
    const next = await screen.findByRole("alertdialog", { name: "Ikkinchi" });
    await user.click(within(next).getByRole("button", { name: "Bekor qilish" }));
    await expect(second).resolves.toBe(false);
  });

  it("ikkinchi `ConfirmHost` hech narsa chizmaydi (oyna ikki marta chiqmaydi)", async () => {
    render(
      <>
        <ConfirmHost />
        <ConfirmHost />
      </>,
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = confirm({ title: "Bitta oyna", confirmLabel: "Tasdiqlash" });
    });
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Bekor qilish" }));
    await expect(pending).resolves.toBe(false);
  });

  it("`ConfirmHost` yo'q — `false` va konsolda xato (tasdiqsiz amal bajarilmaydi)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(confirm({ title: "A", confirmLabel: "O'chirish" })).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("ConfirmHost"));
  });

  it("brauzerda «Orqaga» (popstate) — ochiq so'rov bekor qilinadi", async () => {
    render(<ConfirmHost />);
    let pending!: Promise<boolean>;
    act(() => {
      pending = confirm({ title: "Sahifadan chiqish", confirmLabel: "Tasdiqlash" });
    });
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(pending).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
