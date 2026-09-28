import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./useFocusTrap";

const Harness = ({ onEscape }: { onEscape?: () => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap<HTMLDivElement>(open, {
    onEscape: () => {
      onEscape?.();
      setOpen(false);
    },
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        ochish
      </button>
      <button type="button">fon</button>
      {open && (
        <div ref={ref} tabIndex={-1} data-testid="panel">
          <button type="button">birinchi</button>
          <input aria-label="matn" />
          <button type="button" onClick={() => setOpen(false)}>
            yopish
          </button>
        </div>
      )}
    </>
  );
};

describe("useFocusTrap", () => {
  it("moves focus into the panel when it opens and returns it to the opener when it closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "ochish" }));
    expect(screen.getByRole("button", { name: "birinchi" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "yopish" }));
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ochish" })).toHaveFocus();
  });

  it("cycles Tab and Shift+Tab inside the panel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ochish" }));

    await user.tab();
    expect(screen.getByRole("textbox", { name: "matn" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "yopish" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "birinchi" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "yopish" })).toHaveFocus();
  });

  it("closes on Escape and gives focus back", async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    await user.click(screen.getByRole("button", { name: "ochish" }));

    await user.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ochish" })).toHaveFocus();
  });
});
