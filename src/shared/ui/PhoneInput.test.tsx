import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../../i18n";
import PhoneInput from "./PhoneInput";

/** PhoneInput — eski API saqlangan (qiymat `+998…`), ichi v2 `TextInput mode="phone"`. */

const Harness = ({ onBlur }: { onBlur?: () => void }) => {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <>
      <PhoneInput name="phone_number" value={value} onChange={setValue} onBlur={onBlur} placeholder="90 123 45 67" />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe("PhoneInput", () => {
  it("raqam yozilsa qiymat +998… , ko'rinishi 90 123 45 67; onBlur o'tadi", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    render(
      <>
        <Harness onBlur={onBlur} />
        <button type="button">keyingi</button>
      </>,
    );
    const input = screen.getByPlaceholderText("90 123 45 67");
    expect(input).toHaveAttribute("name", "phone_number");
    expect(input).toHaveAttribute("type", "tel");
    await user.type(input, "901234567");
    expect(input).toHaveValue("90 123 45 67");
    expect(screen.getByTestId("value")).toHaveTextContent("+998901234567");
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it("error — aria-invalid va danger chegara; disabled", () => {
    render(
      <>
        <PhoneInput name="a" value="+99890" onChange={() => {}} error placeholder="a" />
        <PhoneInput name="b" onChange={() => {}} disabled placeholder="b" />
      </>,
    );
    const invalid = screen.getByPlaceholderText("a");
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid.closest("[data-text-input]")).toHaveClass("border-danger");
    expect(screen.getByPlaceholderText("b")).toBeDisabled();
  });

  it("v1 klasslari yo'q", () => {
    const { container } = render(<PhoneInput name="a" onChange={() => {}} />);
    expect(container.innerHTML).not.toMatch(/maindark|primarydark|dark:|red-400|bg-main|card-surface/);
  });
});
