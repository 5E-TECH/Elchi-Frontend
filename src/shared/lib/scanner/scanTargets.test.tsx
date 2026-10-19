import { act, render, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveScanTarget,
  resetScanTargets,
  subscribeScanTargets,
  useActiveScanTarget,
  useScanTarget,
  type ScanTarget,
} from "./scanTargets";

/** Skan maqsadlari reyestri (Trello v1eLN2tV, 1-bosqich): stack, unmount, ref orqali yangilanish. */

const target = (id: string, overrides: Partial<ScanTarget> = {}): ScanTarget => ({
  id,
  title: `Maqsad ${id}`,
  onScan: vi.fn(),
  ...overrides,
});

const Register = ({ value }: { value: ScanTarget | null }) => {
  useScanTarget(value);
  return null;
};

afterEach(() => {
  resetScanTargets();
});

describe("scanTargets", () => {
  it("maqsad yo'q — null; mount bilan qo'shiladi, unmount bilan olinadi", () => {
    expect(getActiveScanTarget()).toBeNull();
    const { unmount } = render(<Register value={target("page")} />);
    expect(getActiveScanTarget()?.id).toBe("page");
    unmount();
    expect(getActiveScanTarget()).toBeNull();
  });

  it("stack: oxirgi ro'yxatdan o'tgan ustun; yuqoridagisi yopilsa pastdagisi qaytadi", () => {
    const page = render(<Register value={target("page")} />);
    const dialog = render(<Register value={target("dialog")} />);
    expect(getActiveScanTarget()?.id).toBe("dialog");
    dialog.unmount();
    expect(getActiveScanTarget()?.id).toBe("page");
    page.unmount();
  });

  it("layer=dialog — oyna maqsadi sahifanikidan doim ustun (bir commit'da o'rnatilsa ham, sahifa qayta yoqilsa ham)", () => {
    // Bola (oyna) effekti ota (sahifa) effektidan oldin ishlaydi — tartib bo'yicha sahifa tepaga chiqardi.
    const Page = ({ pageOn }: { pageOn: boolean }) => {
      useScanTarget(pageOn ? target("page") : null);
      return <Register value={target("dialog", { layer: "dialog" })} />;
    };
    const { rerender } = render(<Page pageOn />);
    expect(getActiveScanTarget()?.id).toBe("dialog");
    rerender(<Page pageOn={false} />);
    rerender(<Page pageOn />);
    expect(getActiveScanTarget()?.id).toBe("dialog");
  });

  it("`null` — ro'yxatdan chiqadi (USB o'chiq: maqsad ham yo'q)", () => {
    const { rerender } = render(<Register value={target("page")} />);
    rerender(<Register value={null} />);
    expect(getActiveScanTarget()).toBeNull();
    rerender(<Register value={target("page")} />);
    expect(getActiveScanTarget()?.id).toBe("page");
  });

  it("maqsad o'zgarsa ref orqali yangilanadi — qayta ro'yxat emas, stack tartibi saqlanadi", () => {
    const page = render(<Register value={target("page", { progress: { done: 1, total: 6 } })} />);
    render(<Register value={target("dialog")} />);
    page.rerender(<Register value={target("page", { progress: { done: 2, total: 6 } })} />);
    // Dialog hali ustda — sahifa yangilangani uni pastga tushirmaydi.
    expect(getActiveScanTarget()?.id).toBe("dialog");
  });

  it("funksiyalar doim eng oxirgi render'dagisini chaqiradi; ma'lumot o'zgarmasa obunachilar uyg'onmaydi", () => {
    const first = vi.fn();
    const second = vi.fn();
    const listener = vi.fn();
    const { rerender } = render(<Register value={target("page", { onScan: first })} />);
    const unsubscribe = subscribeScanTargets(listener);
    const view = getActiveScanTarget();

    rerender(<Register value={target("page", { onScan: second })} />);
    expect(listener).not.toHaveBeenCalled();
    expect(getActiveScanTarget()).toBe(view);

    void view?.onScan("abc", "camera");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("abc", "camera");

    rerender(<Register value={target("page", { onScan: second, progress: { done: 3 } })} />);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getActiveScanTarget()?.progress).toEqual({ done: 3 });
    unsubscribe();
  });

  it("ro'yxat qatoridagi «Bekor qilish» va «Tugatish» eng oxirgi funksiyaga boradi", () => {
    const undoOld = vi.fn();
    const undoNew = vi.fn();
    const finishNew = vi.fn();
    const item = (onUndo: () => void) => [{ key: "1", title: "№1", onUndo }];
    const { rerender } = render(
      <Register value={target("page", { list: item(undoOld), finish: { label: "Tugatish", onFinish: vi.fn() } })} />,
    );
    const view = getActiveScanTarget();
    rerender(<Register value={target("page", { list: item(undoNew), finish: { label: "Tugatish", onFinish: finishNew } })} />);
    view?.list?.[0].onUndo?.();
    view?.finish?.onFinish();
    expect(undoOld).not.toHaveBeenCalled();
    expect(undoNew).toHaveBeenCalledTimes(1);
    expect(finishNew).toHaveBeenCalledTimes(1);
  });

  it("useActiveScanTarget — o'zgarishda qayta chiziladi", () => {
    const { result } = renderHook(() => useActiveScanTarget());
    expect(result.current).toBeNull();

    const Toggle = () => {
      const [count, setCount] = useState(0);
      useScanTarget(target("page", { progress: { done: count } }));
      return (
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          +
        </button>
      );
    };
    const { getByRole } = render(<Toggle />);
    expect(result.current?.progress?.done).toBe(0);
    act(() => getByRole("button").click());
    expect(result.current?.progress?.done).toBe(1);
  });

  it("switcher va stats: ma'lumot o'zgarsa yangilanadi; onSelect va yuklovchi eng oxirgisiga boradi", async () => {
    const selectOld = vi.fn();
    const selectNew = vi.fn();
    const loadNew = vi.fn(async () => [{ value: "9", label: "Baraka Shop" }]);
    const listener = vi.fn();
    const switcher = (onSelect: (value: string) => void, options: () => Promise<{ value: string; label: string }[]>) => ({
      label: "Urgut Savdo",
      value: "7",
      title: "Marketni tanlang",
      options,
      onSelect,
    });
    const { rerender } = render(
      <Register value={target("page", { switcher: switcher(selectOld, vi.fn(async () => [])), stats: [{ key: "a", label: "Qabul qilindi", value: 1 }] })} />,
    );
    const unsubscribe = subscribeScanTargets(listener);
    const view = getActiveScanTarget();

    rerender(<Register value={target("page", { switcher: switcher(selectNew, loadNew), stats: [{ key: "a", label: "Qabul qilindi", value: 1 }] })} />);
    expect(listener).not.toHaveBeenCalled();
    view?.switcher?.onSelect("9");
    expect(selectOld).not.toHaveBeenCalled();
    expect(selectNew).toHaveBeenCalledWith("9");
    const options = view?.switcher?.options;
    await expect(typeof options === "function" ? options() : options).resolves.toEqual([{ value: "9", label: "Baraka Shop" }]);

    rerender(<Register value={target("page", { switcher: switcher(selectNew, loadNew), stats: [{ key: "a", label: "Qabul qilindi", value: 2 }] })} />);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getActiveScanTarget()?.stats?.[0].value).toBe(2);
    unsubscribe();
  });
});
