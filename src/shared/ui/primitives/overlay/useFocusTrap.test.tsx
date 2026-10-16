import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenLayerCount } from "./layerStack";
import { Portal } from "./Portal";
import { useFocusTrap, type FocusTrapOptions } from "./useFocusTrap";

/**
 * Overlay fokus qamog'i: boshlang'ich fokus (xavfsiz tugma), qaytarish, `inert` (xabar qatlami
 * bundan mustasno), ichma-ich oynada Esc faqat ustdagisini yopadi.
 */

let appRoot: HTMLDivElement;
beforeEach(() => {
  appRoot = document.createElement("div");
  appRoot.id = "root";
  document.body.appendChild(appRoot);
});
afterEach(() => {
  appRoot.remove();
});

type DialogProps = { name: string; onClose: () => void; options?: FocusTrapOptions; children?: ReactNode };

const Dialog = ({ name, onClose, options, children }: DialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    inert: true,
    initialFocus: cancelRef,
    ...options,
  });
  return (
    <Portal layer="overlay">
      <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}>
        <button type="button">{`${name}: xavfli`}</button>
        <button ref={cancelRef} type="button" onClick={onClose}>
          {`${name}: bekor qilish`}
        </button>
        {children}
      </div>
    </Portal>
  );
};

const Harness = ({ options, nested = false }: { options?: FocusTrapOptions; nested?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        ochish
      </button>
      {open ? (
        <Dialog name="A" onClose={() => setOpen(false)} options={options}>
          {nested ? (
            <button type="button" onClick={() => setInner(true)}>
              ichki
            </button>
          ) : null}
          {inner ? <Dialog name="B" onClose={() => setInner(false)} /> : null}
        </Dialog>
      ) : null}
    </>
  );
};

const renderInRoot = (ui: ReactElement) => render(ui, { container: appRoot });

describe("overlay useFocusTrap", () => {
  it("boshlang'ich fokus — berilgan element (xavfsiz «Bekor qilish»); yopilganda ochgan tugmaga qaytadi", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    expect(screen.getByRole("button", { name: "A: bekor qilish" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ochish" })).toHaveFocus();
  });

  it("initialFocus='panel' — panelning o'zi", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness options={{ initialFocus: "panel" }} />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    expect(screen.getByRole("dialog", { name: "A" })).toHaveFocus();
  });

  it("inert: ochiq turganda #root va boshqa qatlamlar inert, xabar qatlami emas; yopilganda tiklanadi", async () => {
    const user = userEvent.setup();
    const toastHost = render(
      <Portal layer="toast">
        <p>xabar</p>
      </Portal>,
    );
    renderInRoot(<Harness />);
    await user.click(screen.getByRole("button", { name: "ochish" }));

    expect(appRoot).toHaveAttribute("inert");
    expect(screen.getByText("xabar").closest("[data-ui-layer]")).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog").closest("[data-ui-layer]")).not.toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(appRoot).not.toHaveAttribute("inert");
    toastHost.unmount();
  });

  it("ichma-ich: Esc avval ichki oynani yopadi, keyingi Esc — tashqisini; fokus har safar qaytadi", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness nested />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    await user.click(screen.getByRole("button", { name: "ichki" }));
    expect(screen.getByRole("button", { name: "B: bekor qilish" })).toHaveFocus();
    // Ichki ochiq: tashqi oyna konteyneri ham inert.
    expect(screen.getByRole("button", { name: "A: xavfli" }).closest("[data-ui-layer]")).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "B" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ichki" })).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "A" }).closest("[data-ui-layer]")).not.toHaveAttribute("inert");
    expect(appRoot).toHaveAttribute("inert");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(appRoot).not.toHaveAttribute("inert");
    expect(getOpenLayerCount()).toBe(0);
  });

  it("Tab va Shift+Tab panel ichida aylanadi", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "A: xavfli" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "A: bekor qilish" })).toHaveFocus();
  });

  it("maydon Esc ni o'zi ishlatsa (preventDefault) — oyna yopilmaydi", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    const Own = () => {
      const ref = useFocusTrap<HTMLDivElement>(true, { onEscape });
      return (
        <div ref={ref} tabIndex={-1}>
          <input aria-label="qidiruv" onKeyDown={(event) => event.key === "Escape" && event.preventDefault()} />
        </div>
      );
    };
    renderInRoot(<Own />);
    expect(screen.getByRole("textbox", { name: "qidiruv" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("returnFocus=false — fokus qaytarilmaydi", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness options={{ returnFocus: false }} />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "ochish" })).not.toHaveFocus();
  });

  it("eski inertAppRoot: faqat #root inert", async () => {
    const user = userEvent.setup();
    renderInRoot(<Harness options={{ inert: false, inertAppRoot: true }} />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    expect(appRoot).toHaveAttribute("inert");
    await user.keyboard("{Escape}");
    expect(appRoot).not.toHaveAttribute("inert");
  });
});
