import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pressable } from "./Pressable";

/**
 * BOSILADIGAN YUZA — 5-bosqich. Pressable o'zi hech narsa chizmaydi: DOM aynan `<button type="button" …>`,
 * xom `<button type="button">` ni u bilan almashtirish pikselni o'zgartirmaydi (ESLint `design-v2/raw-control`).
 */

describe("Pressable — uslubsiz <button>", () => {
  it("sukut: <button type=\"button\">, o'zidan klass yoki atribut qo'shmaydi", () => {
    render(<Pressable>Ochish</Pressable>);
    const button = screen.getByRole("button", { name: "Ochish" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttributeNames()).toEqual(["type"]);
    expect(button).toHaveAttribute("type", "button");
  });

  it("xom <button type=\"button\"> bilan bir xil DOM (atributlar, klass, ichki tuzilma)", () => {
    const { container: raw } = render(
      <button type="button" className="flex items-center gap-2 rounded-xl" aria-pressed="true" title="Tanlash">
        <span>Matn</span>
      </button>,
    );
    const { container: pressable } = render(
      <Pressable className="flex items-center gap-2 rounded-xl" aria-pressed="true" title="Tanlash">
        <span>Matn</span>
      </Pressable>,
    );
    const attrs = (el: Element) => Object.fromEntries(el.getAttributeNames().map((name) => [name, el.getAttribute(name)]));
    const rawButton = raw.firstElementChild as Element;
    const button = pressable.firstElementChild as Element;
    expect(attrs(button)).toEqual(attrs(rawButton));
    expect(button.innerHTML).toBe(rawButton.innerHTML);
  });

  it("type almashtiriladi (forma ichida submit / reset)", () => {
    render(
      <form>
        <Pressable type="submit">Saqlash</Pressable>
        <Pressable type="reset">Tozalash</Pressable>
      </form>,
    );
    expect(screen.getByRole("button", { name: "Saqlash" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Tozalash" })).toHaveAttribute("type", "reset");
  });

  it("forma ichida sukut type=\"button\" — formani jo'natmaydi", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Pressable>Chip</Pressable>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Chip" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ref DOM tugmasiga yetadi (React 19: ref — oddiy prop)", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Pressable ref={ref}>Qator</Pressable>);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Qator" }));
  });

  it("disabled, aria-*, role va hodisalar o'tadi", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Pressable role="switch" aria-checked="false" aria-label="Avtomatik" onClick={onClick} data-testid="switch" />,
    );
    const toggle = screen.getByRole("switch", { name: "Avtomatik" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAttribute("data-testid", "switch");
    await userEvent.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Pressable role="switch" aria-checked="false" aria-label="Avtomatik" onClick={onClick} disabled />);
    expect(screen.getByRole("switch", { name: "Avtomatik" })).toBeDisabled();
    await userEvent.click(screen.getByRole("switch", { name: "Avtomatik" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("menyu bandi va ochib-yopish sarlavhasi rollari saqlanadi", () => {
    render(
      <>
        <Pressable role="menuitem">Tahrirlash</Pressable>
        <Pressable aria-expanded="true" aria-controls="panel-1">
          Tafsilot
        </Pressable>
      </>,
    );
    expect(screen.getByRole("menuitem", { name: "Tahrirlash" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Tafsilot" })).toHaveAttribute("aria-expanded", "true");
  });
});
