import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { DateInput, type DateInputProps } from "./DateInput";
import { Dialog } from "./Dialog";
import { Field } from "./Field";

/**
 * DateInput — bitta sana (`.el-select` + `.el-cal`, CODE-MAP 2.2): maydon matni va nomi, bitta oy,
 * kun bosilishi bilan qo'llanadi, min/max, tozalash, `Field` bilan bog'lanish.
 */

const TODAY = "2026-10-08";

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

const Controlled = ({ initial = "", onChange, ...props }: Partial<DateInputProps> & { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
      today={TODAY}
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

describe("DateInput", () => {
  it("bo'sh — «Sanani tanlang»; tanlangan — «08.10.2026», nomi «Sana: 08.10.2026»", () => {
    const { rerender } = render(<DateInput value="" onChange={() => {}} today={TODAY} />);
    expect(screen.getByRole("button", { name: "Sana: Sanani tanlang" })).toHaveTextContent("Sanani tanlang");
    rerender(<DateInput value="2026-10-08" onChange={() => {}} today={TODAY} aria-label="Oxirgi buyurtma — dan" />);
    expect(screen.getByRole("button", { name: "Oxirgi buyurtma — dan: 08.10.2026" })).toHaveTextContent("08.10.2026");
  });

  it("bitta oy; kun bosilsa qo'llanadi, panel yopiladi va fokus maydonga qaytadi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-10-08" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Sana: 08.10.2026" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Sanani tanlash" });
    expect(within(dialog).getAllByRole("grid")).toHaveLength(1);
    const selected = within(dialog).getByRole("gridcell", { name: "8-oktabr, bugun" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(selected);

    await user.keyboard("{ArrowLeft}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-10-07");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sana: 07.10.2026" }));
  });

  it("min dan oldingi kun tanlanmaydi; × tozalaydi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial="2026-10-08" onChange={onChange} min="2026-10-05" />);

    await user.click(screen.getByRole("button", { name: "Sana: 08.10.2026" }));
    await user.click(screen.getByRole("gridcell", { name: "4-oktabr, tanlab bo'lmaydi" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Sanani tozalash" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("Field ichida — yorliq bilan nomlanadi, majburiy — tavsifda «majburiy» (button rolida aria-required yo'q)", () => {
    render(
      <Field label="Boshlanish" labelAs="span" required>
        <DateInput value="2026-10-01" onChange={() => {}} today={TODAY} />
      </Field>,
    );
    const trigger = screen.getByRole("button", { name: "Boshlanish 01.10.2026" });
    expect(trigger).toHaveAccessibleDescription("majburiy");
    expect(trigger).not.toHaveAttribute("aria-required");
  });

  it("Dialog ichida: kalendar oyna ustida, klaviatura ishlaydi; Esc avval kalendarni, keyin oynani yopadi", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Foydalanuvchini tahrirlash">
        <Field label="To'lov kuni" labelAs="span">
          <Controlled initial="2026-10-08" onChange={onChange} />
        </Field>
      </Dialog>,
    );
    const modal = screen.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" });
    const trigger = within(modal).getByRole("button", { name: "To'lov kuni 08.10.2026" });

    await user.click(trigger);
    const calendar = screen.getByRole("dialog", { name: "Sanani tanlash" });
    // Kalendar oyna ichida emas (portal), lekin `inert` emas va oyna qatlamidan yuqorida.
    expect(modal).not.toContainElement(calendar);
    expect(calendar.closest("[inert]")).toBeNull();
    const layerZ = (el: HTMLElement) => Number(el.closest<HTMLElement>("[data-ui-layer]")?.style.zIndex);
    expect(layerZ(calendar)).toBeGreaterThan(layerZ(modal));
    expect(document.activeElement).toBe(within(calendar).getByRole("gridcell", { name: "8-oktabr, bugun" }));

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Sanani tanlash" })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-10-09");
    expect(screen.getByRole("dialog", { name: "Foydalanuvchini tahrirlash" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledWith("escape");
  });
});
