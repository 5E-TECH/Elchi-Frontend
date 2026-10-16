import { useState, type ReactNode } from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timer } from "lucide-react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { Button } from "./Button";
import { Dialog, DialogPanel, type DialogCloseReason, type DialogProps } from "./Dialog";
import { Z_LAYERS } from "./overlay";

/**
 * Dialog — `.el-overlay` / `.el-dialog` / `.el-sheet` (CODE-MAP 2.8, `tizim-motion` 03): WAI-ARIA dialog
 * (nom, izoh, `aria-modal`), fokus ichkariga va qaytib, Tab qamog'i, Esc / fon / «Yopish», so'rov paytida
 * qulf, `inert` fon, skroll qulfi, forma, qatlam (1200), yopilish harakati.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

let appRoot: HTMLDivElement;
beforeEach(() => {
  appRoot = document.createElement("div");
  appRoot.id = "root";
  document.body.appendChild(appRoot);
});
afterEach(() => {
  appRoot.remove();
  vi.unstubAllGlobals();
});

type HarnessProps = Partial<Omit<DialogProps, "open" | "onClose">> & {
  onClose?: (reason: DialogCloseReason) => void;
  children?: ReactNode;
};

const Harness = ({ onClose, children, ...props }: HarnessProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button">fon tugmasi</button>
      <button type="button" onClick={() => setOpen(true)}>
        Smenani yopish
      </button>
      <Dialog
        open={open}
        onClose={(reason) => {
          onClose?.(reason);
          setOpen(false);
        }}
        title="Smenani yopish"
        description="Joriy kassa smenasi yakunlanadi"
        icon={Timer}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button leftIcon={Timer}>Smenani yopish</Button>
          </>
        }
        {...props}
      >
        {children ?? (
          <label>
            Izoh
            <textarea />
          </label>
        )}
      </Dialog>
    </>
  );
};

const renderOpen = async (props: HarnessProps = {}) => {
  const user = userEvent.setup();
  render(<Harness {...props} />, { container: appRoot });
  const opener = screen.getByRole("button", { name: "Smenani yopish" });
  await user.click(opener);
  return { user, opener, dialog: screen.getByRole("dialog", { name: "Smenani yopish" }) };
};

describe("Dialog — tuzilma va ARIA", () => {
  it("nomli modal oyna: sarlavha, izoh, aria-modal; ikonka bezak", async () => {
    const { dialog } = await renderOpen();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Joriy kassa smenasi yakunlanadi");
    expect(screen.getByRole("heading", { level: 2, name: "Smenani yopish" })).toBeInTheDocument();
    expect(dialog.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("`#ui-portal` ga, `overlay` qatlamiga (1200) chiziladi — ilova ildizidan tashqarida", async () => {
    const { dialog } = await renderOpen();
    expect(appRoot.contains(dialog)).toBe(false);
    const layer = dialog.closest<HTMLElement>("[data-ui-layer]");
    expect(layer).toHaveAttribute("data-ui-layer", "overlay");
    expect(Number(layer?.style.zIndex)).toBeGreaterThanOrEqual(Z_LAYERS.overlay);
    expect(layer?.parentElement?.id).toBe("ui-portal");
  });

  it("sukut o'lcham 480, `size` bilan 440/560/640", () => {
    const { rerender } = render(<DialogPanel title="A">x</DialogPanel>);
    expect(screen.getByText("x").closest("[data-layout]")).toHaveClass("max-w-[480px]");
    rerender(
      <DialogPanel title="A" size="xl">
        x
      </DialogPanel>,
    );
    expect(screen.getByText("x").closest("[data-layout]")).toHaveClass("max-w-[640px]");
  });

  it("telefonda pastki varaqa: tutqich (bezak), to'liq en, tepasi yumaloq, teng enli tugmalar", async () => {
    const { dialog } = await renderOpen();
    expect(dialog).toHaveAttribute("data-layout", "auto");
    expect(dialog.className).toContain("max-md:rounded-b-none");
    expect(dialog.className).toContain("max-md:max-h-[92dvh]");
    expect(dialog.className).toContain("env(safe-area-inset-bottom)");
    const grip = dialog.firstElementChild as HTMLElement;
    expect(grip).toHaveAttribute("aria-hidden", "true");
    expect(grip).toHaveAttribute("data-dialog-grip");
    expect(grip.className).toContain("max-md:flex");
    expect(grip.className).toContain("touch-none");
    const footer = dialog.querySelector("[data-dialog-footer]");
    expect(footer?.className).toContain("max-md:[&>*]:flex-1");
  });

  it("`layout=\"sheet\"` (namuna): tutqich doim, kenglik cheklanmaydi", () => {
    render(
      <DialogPanel title="Filtrlar" layout="sheet" size="sm" footer={<button type="button">OK</button>} footerDivider>
        x
      </DialogPanel>,
    );
    const panel = screen.getByText("x").closest<HTMLElement>("[data-layout]")!;
    expect(panel).toHaveAttribute("data-layout", "sheet");
    expect(panel).not.toHaveClass("max-w-[440px]");
    const grip = panel.firstElementChild as HTMLElement;
    expect(grip).toHaveClass("flex");
    // Namuna paneli modal emas — tortib yopish yo'q.
    expect(grip).not.toHaveClass("touch-none");
    expect(panel.querySelector("[data-dialog-footer]")).toHaveClass("border-t");
  });
});

describe("Dialog — fokus va klaviatura", () => {
  it("ochilganda fokus tanadagi birinchi maydonda («Yopish» emas)", async () => {
    await renderOpen();
    expect(screen.getByRole("textbox", { name: "Izoh" })).toHaveFocus();
  });

  it("maydonsiz oynada fokus panelning o'zida (sarlavha o'qiladi)", async () => {
    const { dialog } = await renderOpen({ children: <p>Matn</p> });
    expect(dialog).toHaveFocus();
  });

  it("Tab va Shift+Tab oynadan chiqmaydi", async () => {
    const { user, dialog } = await renderOpen();
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 8; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("Esc yopadi (sabab `escape`) va fokus ochgan tugmaga qaytadi", async () => {
    const onClose = vi.fn();
    const { user, opener } = await renderOpen({ onClose });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith("escape");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("«Yopish» tugmasi (sabab `close-button`); `closable={false}` — tugma yo'q", async () => {
    const onClose = vi.fn();
    const { user } = await renderOpen({ onClose });
    await user.click(screen.getByRole("button", { name: "Yopish" }));
    expect(onClose).toHaveBeenCalledWith("close-button");

    await user.click(screen.getByRole("button", { name: "Smenani yopish" }));
    expect(screen.getByRole("button", { name: "Yopish" })).toBeInTheDocument();
  });

  it("`dismissible={false}` — Esc yopmaydi va orqadagi qatlamga o'tmaydi", async () => {
    const onClose = vi.fn();
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    const { user } = await renderOpen({ onClose, dismissible: false });
    await user.keyboard("{Escape}");
    document.removeEventListener("keydown", outer);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(outer.mock.calls.every(([event]) => (event as KeyboardEvent).defaultPrevented)).toBe(true);
  });
});

describe("Dialog — fon, qulf va forma", () => {
  it("fon bosilsa yopiladi (sabab `overlay`), panel ichiga bosish — yo'q", async () => {
    const onClose = vi.fn();
    const { user, dialog } = await renderOpen({ onClose });
    await user.click(screen.getByText("Joriy kassa smenasi yakunlanadi"));
    expect(onClose).not.toHaveBeenCalled();

    const root = dialog.closest<HTMLElement>("[data-dialog-root]")!;
    await user.click(root);
    expect(onClose).toHaveBeenCalledWith("overlay");
  });

  it("ichkarida bosib fonda qo'yib yuborish (matn belgilash) — yopilmaydi", async () => {
    const onClose = vi.fn();
    const { dialog } = await renderOpen({ onClose });
    const root = dialog.closest<HTMLElement>("[data-dialog-root]")!;
    fireEvent.pointerDown(dialog);
    fireEvent.click(root);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("`closeOnOverlay={false}` — fon yopmaydi, fokus oyna ichida qoladi", async () => {
    const onClose = vi.fn();
    const { user, dialog } = await renderOpen({ onClose, closeOnOverlay: false });
    const field = screen.getByRole("textbox");
    expect(field).toHaveFocus();
    await user.click(dialog.closest<HTMLElement>("[data-dialog-root]")!);
    expect(onClose).not.toHaveBeenCalled();
    expect(field).toHaveFocus();
  });

  it("ichidagi ro'yxat (yuqori qatlam) ochiq turganda fonga bosish oynani yopmaydi", async () => {
    const onClose = vi.fn();
    const { user, dialog } = await renderOpen({ onClose });
    const root = dialog.closest<HTMLElement>("[data-dialog-root]")!;
    const ownLayer = root.closest<HTMLElement>("[data-ui-layer]")!;
    // Oyna ichidan ochilgan v2 ro'yxati — `Portal` konteyneri oyna qatlamidan yuqori (1201).
    const listLayer = document.createElement("div");
    listLayer.setAttribute("data-ui-layer", "dropdown");
    listLayer.style.zIndex = String(Number(ownLayer.style.zIndex) + 1);
    ownLayer.parentElement!.appendChild(listLayer);

    await user.click(root);
    expect(onClose).not.toHaveBeenCalled();

    // antd paneli (`body` da) ochiq — ham.
    listLayer.remove();
    const antd = document.createElement("div");
    antd.className = "ant-select-dropdown";
    document.body.appendChild(antd);
    await user.click(root);
    expect(onClose).not.toHaveBeenCalled();
    antd.remove();

    // Ro'yxat yopilgach — keyingi bosish oynani yopadi.
    await user.click(root);
    expect(onClose).toHaveBeenCalledWith("overlay");
  });

  it("`busy` — Esc, fon va «Yopish» ishlamaydi", async () => {
    const onClose = vi.fn();
    const { user, dialog } = await renderOpen({ onClose, busy: true });
    await user.keyboard("{Escape}");
    await user.click(dialog.closest<HTMLElement>("[data-dialog-root]")!);
    expect(screen.getByRole("button", { name: "Yopish" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ochiq turganda ilova `inert`, sahifa skrolli qulf; yopilgach qaytadi", async () => {
    const { user } = await renderOpen();
    expect(appRoot).toHaveAttribute("inert");
    expect(document.documentElement).toHaveAttribute("data-scroll-locked");
    await user.keyboard("{Escape}");
    expect(appRoot).not.toHaveAttribute("inert");
    expect(document.documentElement).not.toHaveAttribute("data-scroll-locked");
  });

  it("`onSubmit` — tana va amallar `<form>` ichida, `type=\"submit\"` tugma yuboradi", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Mahsulotni tahrirlash"
        onSubmit={onSubmit}
        footer={<Button type="submit">Saqlash</Button>}
      >
        <label>
          Nomi
          <input />
        </label>
      </Dialog>,
      { container: appRoot },
    );
    await user.type(screen.getByRole("textbox", { name: "Nomi" }), "Kurtka{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Saqlash" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

describe("Dialog — telefonda tutqichni tortib yopish", () => {
  // jsdom `PointerEvent` ga `clientY` / `pointerId` / `timeStamp` bermaydi — qo'lda qo'yiladi.
  const pointer = (
    type: "pointerDown" | "pointerMove" | "pointerUp",
    target: HTMLElement,
    clientY: number,
    // React `timeStamp: 0` ni «yo'q» deb `Date.now()` qo'yadi — 1 ms dan boshlanadi.
    timeStamp = 1,
  ) => {
    const event = createEvent[type](target);
    Object.defineProperties(event, {
      clientY: { value: clientY },
      pointerId: { value: 1 },
      pointerType: { value: "touch" },
      timeStamp: { value: timeStamp },
    });
    fireEvent(target, event);
  };
  const drag = (grip: HTMLElement, distance: number, durationMs: number) => {
    pointer("pointerDown", grip, 100);
    pointer("pointerMove", grip, 100 + distance / 2);
    pointer("pointerMove", grip, 100 + distance);
    pointer("pointerUp", grip, 100 + distance, 1 + durationMs);
  };

  it("chegaradan o'tsa yopiladi (sabab `swipe`); qisqa sekin tortishda joyiga qaytadi", async () => {
    const onClose = vi.fn();
    const { dialog } = await renderOpen({ onClose });
    const grip = dialog.querySelector<HTMLElement>("[data-dialog-grip]")!;

    pointer("pointerDown", grip, 100);
    pointer("pointerMove", grip, 140);
    expect(dialog.style.translate).toBe("0 40px");
    pointer("pointerUp", grip, 140, 5000);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.translate).toBe("");
    expect(dialog.style.transition).toBe("");

    drag(grip, 200, 5000);
    expect(onClose).toHaveBeenCalledWith("swipe");
  });

  it("qisqa, lekin tez siltash ham yopadi", async () => {
    const onClose = vi.fn();
    const { dialog } = await renderOpen({ onClose });
    drag(dialog.querySelector<HTMLElement>("[data-dialog-grip]")!, 40, 50);
    expect(onClose).toHaveBeenCalledWith("swipe");
  });

  it("`busy`, `dismissible={false}` yoki `closeOnOverlay={false}` — tortib bo'lmaydi", async () => {
    for (const props of [{ busy: true }, { dismissible: false }, { closeOnOverlay: false }]) {
      const onClose = vi.fn();
      const { dialog } = await renderOpen({ onClose, ...props });
      const grip = dialog.querySelector<HTMLElement>("[data-dialog-grip]")!;
      expect(grip).not.toHaveClass("touch-none");
      drag(grip, 300, 100);
      expect(dialog.style.translate).toBe("");
      expect(onClose).not.toHaveBeenCalled();
      document.body.innerHTML = "";
      appRoot = document.createElement("div");
      appRoot.id = "root";
      document.body.appendChild(appRoot);
    }
  });
});

describe("Dialog — ichidagi antd ro'yxatlari (o'tish davri)", () => {
  it("antd kalendari/menyusi ochiq turganda Esc oynani yopmaydi va hodisani to'xtatmaydi", async () => {
    const onClose = vi.fn();
    const { user, dialog } = await renderOpen({ onClose });
    // antd `DatePicker` paneli `body` ga portal qilinadi (bizning qatlam stekimizda yo'q).
    const popup = document.createElement("div");
    popup.className = "ant-picker-dropdown ant-picker-dropdown-placement-bottomLeft";
    document.body.appendChild(popup);
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    // `Dropdown` Esc ni `window` da tinglaydi — hodisa unga yetib borishi kerak.
    expect(onWindowKey).toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();

    // Panel yopildi (`…-hidden`) — keyingi Esc oynaniki.
    popup.classList.add("ant-picker-dropdown-hidden");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith("escape");
    window.removeEventListener("keydown", onWindowKey);
    popup.remove();
  });

  it("oyna ochilishidan oldin sahifada ochiq qolgan (endi `inert`) antd paneli Esc ni to'smaydi", async () => {
    const stale = document.createElement("div");
    stale.className = "ant-dropdown";
    document.body.appendChild(stale);
    const onClose = vi.fn();
    const { user } = await renderOpen({ onClose });
    expect(stale).toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith("escape");
    stale.remove();
  });
});

describe("Dialog — ichma-ich", () => {
  it("ichki oyna ota qatlamdan yuqori; Esc faqat ustdagisini yopadi", async () => {
    const user = userEvent.setup();
    const Nested = () => {
      const [inner, setInner] = useState(false);
      const [outer, setOuter] = useState(true);
      return (
        <Dialog open={outer} onClose={() => setOuter(false)} title="Tashqi">
          <button type="button" onClick={() => setInner(true)}>
            Ichkini ochish
          </button>
          <Dialog open={inner} onClose={() => setInner(false)} title="Ichki">
            <button type="button">Ichki tugma</button>
          </Dialog>
        </Dialog>
      );
    };
    render(<Nested />, { container: appRoot });
    await user.click(screen.getByRole("button", { name: "Ichkini ochish" }));
    const inner = screen.getByRole("dialog", { name: "Ichki" });
    const outerLayer = screen.getByRole("dialog", { name: "Tashqi", hidden: true }).closest<HTMLElement>("[data-ui-layer]")!;
    expect(Number(inner.closest<HTMLElement>("[data-ui-layer]")!.style.zIndex)).toBeGreaterThan(
      Number(outerLayer.style.zIndex),
    );
    expect(outerLayer).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Ichki" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tashqi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ichkini ochish" })).toHaveFocus();
  });
});

describe("Dialog — mazmunsiz tana va harakat", () => {
  it("mazmunsiz tana yashiriladi (sarlavha va amallar orasi bitta 16 px oraliq)", () => {
    render(<DialogPanel title="Tasdiqlang" footer={<button type="button">Tasdiqlash</button>} />);
    const body = document.querySelector<HTMLElement>("[data-dialog-body]")!;
    expect(body.className).toContain("[&:has(>div:empty)]:hidden");
    expect(body.firstElementChild).toBeEmptyDOMElement();
  });

  it("o'tish `scale` va `translate` xossalarida (Tailwind v4 da ular `transform` emas)", async () => {
    const { dialog } = await renderOpen();
    expect(dialog.className).toContain("transition-[opacity,scale,translate]");
    expect(dialog.className).toContain("max-md:starting:translate-y-full");
    expect(dialog.className).toContain("md:starting:scale-[.98]");
  });
});

describe("Dialog — yopilish harakati (usePresence)", () => {
  it("harakat bor muhitda: `data-state=closed`, `inert`, `transitionend` dan keyin DOM'dan olinadi", async () => {
    vi.stubGlobal("TransitionEvent", class extends Event {});
    const onExited = vi.fn();
    const { user, dialog, opener } = await renderOpen({ onExited });
    await user.keyboard("{Escape}");

    // Hali DOM'da, lekin yopilmoqda: `inert` (brauzerda ekran o'quvchi va bosishdan chiqadi; jsdom
    // `inert` ni bilmaydi), fokus allaqachon ochgan tugmada.
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-state", "closed");
    const root = dialog.closest("[data-dialog-root]");
    expect(root).toHaveAttribute("inert");
    expect(root).toHaveClass("pointer-events-none");
    expect(opener).toHaveFocus();
    expect(onExited).not.toHaveBeenCalled();

    fireEvent.transitionEnd(dialog);
    expect(dialog).not.toBeInTheDocument();
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("`transitionend` kelmasa — zaxira taymer olib tashlaydi", async () => {
    vi.stubGlobal("TransitionEvent", class extends Event {});
    const user = userEvent.setup();
    render(<Harness />, { container: appRoot });
    await user.click(screen.getByRole("button", { name: "Smenani yopish" }));
    const dialog = screen.getByRole("dialog");
    vi.useFakeTimers();
    try {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      expect(dialog).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(dialog).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("«Harakatni kamaytirish» yoqilgan — darhol olib tashlanadi", async () => {
    vi.stubGlobal("TransitionEvent", class extends Event {});
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    try {
      const { user, dialog } = await renderOpen();
      await user.keyboard("{Escape}");
      expect(dialog).not.toBeInTheDocument();
    } finally {
      matchMedia.mockRestore();
    }
  });

  it("yopilayotganda qayta ochilsa — o'sha oyna qaytadi", async () => {
    vi.stubGlobal("TransitionEvent", class extends Event {});
    const { user, dialog, opener } = await renderOpen();
    await user.keyboard("{Escape}");
    expect(dialog).toHaveAttribute("data-state", "closed");
    await user.click(opener);
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(dialog.closest("[data-dialog-root]")).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: "Smenani yopish" })).toBe(dialog);
  });
});
