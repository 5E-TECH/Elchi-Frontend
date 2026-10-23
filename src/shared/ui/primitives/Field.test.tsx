import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "../../../i18n";
import { Field } from "./Field";
import { useFieldControl } from "./fieldContext";
import { TextInput } from "./TextInput";

/**
 * Field — `.el-field` / `.el-label` / `.el-req` / `.el-hint` / `.el-error-text` (CODE-MAP 2.2,
 * `tizim-states-forms` 01): yorliq ↔ maydon, ko'rsatma/xato `aria-describedby`, xato ko'rsatma o'rnida.
 */

beforeAll(async () => {
  await i18n.changeLanguage("uz");
});

describe("Field", () => {
  it("yorliq maydonga ulangan; majburiy — qizil yulduzcha va aria-required; ko'rsatma describedby", () => {
    render(
      <Field label="Mijoz ismi" required hint="Ism va familiya">
        <TextInput placeholder="Ism kiriting" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Mijoz ismi" });
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Ism va familiya");
    const star = screen.getByText("*");
    expect(star).toHaveAttribute("aria-hidden", "true");
    expect(star).toHaveClass("text-danger-fg");
    const label = screen.getByText("Mijoz ismi");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveClass("text-[13px]", "font-semibold", "text-text");
  });

  it("xato: ko'rsatma o'rnida, CircleX bilan; aria-invalid, aria-errormessage, describedby xatoga", () => {
    render(
      <Field label="Mijoz ismi" required hint="Ism va familiya" error="Mijoz ismini kiriting">
        <TextInput />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Mijoz ismi" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Mijoz ismini kiriting");
    const error = screen.getByText("Mijoz ismini kiriting").parentElement!;
    expect(input).toHaveAttribute("aria-errormessage", error.id);
    expect(error).toHaveClass("text-xs", "font-semibold", "text-danger-fg");
    expect(error.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText("Ism va familiya")).not.toBeInTheDocument();
  });

  it("XsoWhKP5 ce8cb3: error berilmasa — xato bloki yo'q, aria-invalid / aria-errormessage yo'q", () => {
    const { container, rerender } = render(
      <Field label="Parol">
        <TextInput />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Parol" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-errormessage");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(container.querySelector("[data-field]")).not.toHaveAttribute("data-invalid");
    expect(container.querySelector(".text-danger-fg")).toBeNull();

    // Bo'sh qiymatlar (`""`, `null`, `false`) ham xato emas — react-hook-form `errors.x?.message` shunday keladi.
    for (const empty of ["", null, false, undefined]) {
      rerender(
        <Field label="Parol" error={empty}>
          <TextInput />
        </Field>,
      );
      expect(screen.getByRole("textbox", { name: "Parol" })).not.toHaveAttribute("aria-invalid");
      expect(container.querySelector(".text-danger-fg")).toBeNull();
    }

    // Xato kelib, keyin tuzatilsa — bog'lanish ham yo'qoladi.
    rerender(
      <Field label="Parol" error="Parol shart">
        <TextInput />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Parol" })).toHaveAttribute("aria-invalid", "true");
    rerender(
      <Field label="Parol">
        <TextInput />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Parol" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("textbox", { name: "Parol" })).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Parol shart")).not.toBeInTheDocument();
  });

  it("ixtiyoriy — «(ixtiyoriy)» kulrang", () => {
    render(
      <Field label="Izoh" optional>
        <TextInput multiline />
      </Field>,
    );
    expect(screen.getByRole("textbox", { name: "Izoh (ixtiyoriy)" }).tagName).toBe("TEXTAREA");
    expect(screen.getByText("(ixtiyoriy)", { exact: false })).toHaveClass("text-text-muted");
  });

  it("disabled va readOnly maydonga o'tadi", () => {
    render(
      <>
        <Field label="A" disabled hint="Yopilgan buyurtmada tahrirlanmaydi">
          <TextInput defaultValue="x" />
        </Field>
        <Field label="B" readOnly>
          <TextInput defaultValue="y" />
        </Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "A" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "B" })).toHaveAttribute("readonly");
  });

  it("labelAs='span' — tugma ko'rinishidagi boshqaruv aria-labelledby bilan", () => {
    const Trigger = () => {
      const field = useFieldControl();
      return (
        <button type="button" id={field.id} aria-labelledby={field.labelId} aria-describedby={field["aria-describedby"]}>
          Viloyat tanlang
        </button>
      );
    };
    render(
      <Field label="Viloyat" labelAs="span" hint="Viloyat tanlangach ochiladi">
        <Trigger />
      </Field>,
    );
    const button = screen.getByRole("button", { name: "Viloyat" });
    expect(button).toHaveAccessibleDescription("Viloyat tanlangach ochiladi");
    expect(screen.getByText("Viloyat").tagName).toBe("SPAN");
  });

  it("hideLabel — yorliq faqat ekran o'quvchi uchun", () => {
    render(
      <Field label="Qidiruv" hideLabel>
        <TextInput mode="search" />
      </Field>,
    );
    expect(screen.getByText("Qidiruv")).toHaveClass("sr-only");
    expect(screen.getByRole("searchbox", { name: "Qidiruv" })).toBeInTheDocument();
  });

  it("ikki Field — id lar takrorlanmaydi", () => {
    render(
      <>
        <Field label="Bir" hint="h">
          <TextInput />
        </Field>
        <Field label="Ikki" hint="h">
          <TextInput />
        </Field>
      </>,
    );
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
