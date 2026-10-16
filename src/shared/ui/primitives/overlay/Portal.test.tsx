import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Z_LAYERS } from "./layers";
import { Portal } from "./Portal";
import { PORTAL_ROOT_ID } from "./portalRoot";

/** Portal: yagona `#ui-portal`, qatlam z-index'i, ichma-ich ko'tarilish, eski oyna ichida langar. */

const containerOf = (text: string) => screen.getByText(text).closest<HTMLElement>("[data-ui-layer]")!;

describe("Portal", () => {
  it.each([
    ["dropdown", Z_LAYERS.dropdown],
    ["overlay", Z_LAYERS.overlay],
    ["toast", Z_LAYERS.toast],
  ] as const)("%s qatlami — #ui-portal ichida, z-index %i", (layer, z) => {
    render(
      <Portal layer={layer}>
        <p>panel</p>
      </Portal>,
    );
    const container = containerOf("panel");
    expect(container.parentElement?.id).toBe(PORTAL_ROOT_ID);
    expect(container.parentElement?.parentElement).toBe(document.body);
    expect(container).toHaveAttribute("data-ui-layer", layer);
    expect(container.style.zIndex).toBe(String(z));
    expect(container.style.position).toBe("relative");
  });

  it("bitta #ui-portal ildizi; yopilganda konteyner olib tashlanadi", () => {
    const { rerender } = render(
      <>
        <Portal layer="dropdown">
          <p>bir</p>
        </Portal>
        <Portal layer="toast">
          <p>ikki</p>
        </Portal>
      </>,
    );
    expect(document.querySelectorAll(`#${PORTAL_ROOT_ID}`)).toHaveLength(1);
    expect(containerOf("bir").parentElement).toBe(containerOf("ikki").parentElement);

    rerender(
      <Portal layer="toast">
        <p>ikki</p>
      </Portal>,
    );
    expect(screen.queryByText("bir")).not.toBeInTheDocument();
    expect(document.querySelectorAll(`#${PORTAL_ROOT_ID} > [data-ui-layer="dropdown"]`)).toHaveLength(0);
  });

  it("dialog ichidagi ro'yxat oyna qatlamidan bitta yuqori (DOM tartibidan qat'i nazar)", () => {
    render(
      <Portal layer="overlay">
        <p>oyna</p>
        <Portal layer="dropdown">
          <p>ro'yxat</p>
        </Portal>
      </Portal>,
    );
    const dialog = containerOf("oyna");
    const list = containerOf("ro'yxat");
    expect(dialog.style.zIndex).toBe(String(Z_LAYERS.overlay));
    expect(list.style.zIndex).toBe(String(Z_LAYERS.overlay + 1));
  });

  it("langar eski v1 oyna (z 9998) ichida — ro'yxat undan bitta yuqori", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const anchorRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <div style={{ position: "fixed", zIndex: 9998 }}>
          <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
            ochish
          </button>
          {open ? (
            <Portal layer="dropdown" anchor={anchorRef}>
              <p>ro'yxat</p>
            </Portal>
          ) : null}
        </div>
      );
    };
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "ochish" }));
    expect(containerOf("ro'yxat").style.zIndex).toBe("9999");
  });

  it("overlay sukut bo'yicha ochgan (fokusdagi) element qatlamidan yuqori", async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <div style={{ position: "fixed", zIndex: 9999 }}>
          <button type="button" onClick={() => setOpen(true)}>
            tasdiqlash
          </button>
          {open ? (
            <Portal layer="overlay">
              <p>tasdiq oynasi</p>
            </Portal>
          ) : null}
        </div>
      );
    };
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "tasdiqlash" }));
    expect(containerOf("tasdiq oynasi").style.zIndex).toBe("10000");
  });
});
