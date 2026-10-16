import { useRef, useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Portal } from "./Portal";
import { useDismiss, type DismissReason, type UseDismissOptions } from "./useDismiss";

/** useDismiss: Esc va tashqariga bosish faqat eng ustdagi qatlamda; ichkari/keyingi qatlam/antd — tashqari emas. */

type Props = {
  name: string;
  onDismiss: (reason: DismissReason) => void;
  options?: Partial<UseDismissOptions>;
  children?: ReactNode;
};

const Popover = ({ name, onDismiss, options, children }: Props) => {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  useDismiss({
    open,
    refs: [anchorRef, floatingRef],
    onDismiss: (reason) => {
      onDismiss(reason);
      setOpen(false);
    },
    ...options,
  });
  return (
    <>
      <button ref={anchorRef} type="button">{`${name} tugmasi`}</button>
      {open ? (
        <Portal layer="dropdown">
          <div ref={floatingRef} role="listbox" aria-label={name}>
            <button type="button">{`${name} varianti`}</button>
            {children}
          </div>
        </Portal>
      ) : null}
    </>
  );
};

describe("useDismiss", () => {
  it("Esc — 'escape'", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Popover name="A" onDismiss={onDismiss} />);
    await user.keyboard("{Escape}");
    expect(onDismiss).toHaveBeenCalledWith("escape");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("tashqariga bosish — 'outside'; langar va panel ichiga bosish — yo'q", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <p>sahifa</p>
        <Popover name="A" onDismiss={onDismiss} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "A tugmasi" }));
    await user.click(screen.getByRole("button", { name: "A varianti" }));
    expect(onDismiss).not.toHaveBeenCalled();
    await user.click(screen.getByText("sahifa"));
    expect(onDismiss).toHaveBeenCalledWith("outside");
  });

  it("ichma-ich: ichki ro'yxat ochiq bo'lsa Esc va tashqariga bosish faqat uni yopadi", async () => {
    const user = userEvent.setup();
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <p>sahifa</p>
        <Popover name="A" onDismiss={outer}>
          <Popover name="B" onDismiss={inner} />
        </Popover>
      </>,
    );
    // Ichki qatlamdagi bosish tashqi uchun «tashqari» emas.
    await user.click(screen.getByRole("button", { name: "B varianti" }));
    expect(outer).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(inner).toHaveBeenCalledWith("escape");
    expect(outer).not.toHaveBeenCalled();

    await user.click(screen.getByText("sahifa"));
    expect(outer).toHaveBeenCalledWith("outside");
  });

  it("maydon Esc ni o'zi ishlatsa (preventDefault) — yopilmaydi", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Popover name="A" onDismiss={onDismiss}>
        <input aria-label="qidiruv" onKeyDown={(event) => event.key === "Escape" && event.preventDefault()} />
      </Popover>,
    );
    screen.getByRole("textbox", { name: "qidiruv" }).focus();
    await user.keyboard("{Escape}");
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("antd ro'yxati va data-ui-dismiss-ignore — tashqari emas", () => {
    const onDismiss = vi.fn();
    const antd = document.createElement("div");
    antd.className = "ant-select-dropdown";
    const ignored = document.createElement("div");
    ignored.setAttribute("data-ui-dismiss-ignore", "");
    document.body.append(antd, ignored);
    render(<Popover name="A" onDismiss={onDismiss} />);
    fireEvent.pointerDown(antd);
    fireEvent.pointerDown(ignored);
    expect(onDismiss).not.toHaveBeenCalled();
    antd.remove();
    ignored.remove();
  });

  it("escape={false}, outsidePress={false} — yopilmaydi", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <p>sahifa</p>
        <Popover name="A" onDismiss={onDismiss} options={{ escape: false, outsidePress: false }} />
      </>,
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByText("sahifa"));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("focusOutside — fokus tashqariga chiqsa 'focus'", async () => {
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button">boshqa</button>
        <Popover name="A" onDismiss={onDismiss} options={{ focusOutside: true }} />
      </>,
    );
    screen.getByRole("button", { name: "A varianti" }).focus();
    expect(onDismiss).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "boshqa" }).focus();
    expect(onDismiss).toHaveBeenCalledWith("focus");
  });
});
