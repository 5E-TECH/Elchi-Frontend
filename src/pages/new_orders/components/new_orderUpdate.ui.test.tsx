import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../test/test-utils";
import { OrderCommentCard } from "./new_orderUpdate.ui";

describe("OrderCommentCard", () => {
  it("shows the comment text under an 'Izoh' label", () => {
    renderWithProviders(<OrderCommentCard comment="Mijoz ertaga qo'ng'iroq qilishni so'radi" />);

    expect(screen.getByText("Izoh")).toBeInTheDocument();
    expect(screen.getByText("Mijoz ertaga qo'ng'iroq qilishni so'radi")).toBeInTheDocument();
  });

  it("preserves line breaks in a multi-line comment", () => {
    renderWithProviders(<OrderCommentCard comment={"Birinchi qator\nIkkinchi qator"} />);

    const text = screen.getByText((_, element) => element?.textContent === "Birinchi qator\nIkkinchi qator");
    expect(text).toHaveClass("whitespace-pre-line");
    // 390px kabi tor ekranda uzun, bo'shliqsiz so'z gorizontal chiqib
    // ketmasligi kerak.
    expect(text).toHaveClass("break-words");
  });

  it("does not show a toggle for a short, single-line comment", () => {
    renderWithProviders(<OrderCommentCard comment="Qisqa izoh" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("clamps a long comment behind a 'Show more' toggle and expands on click", async () => {
    const user = userEvent.setup();
    const longComment = Array.from({ length: 5 }, (_, i) => `Qator ${i + 1}`).join("\n");
    renderWithProviders(<OrderCommentCard comment={longComment} />);

    const text = screen.getByText((_, element) => element?.textContent === longComment);
    expect(text).toHaveClass("line-clamp-3");

    const toggle = screen.getByRole("button", { name: "Ko'proq ko'rsatish" });
    await user.click(toggle);

    expect(text).not.toHaveClass("line-clamp-3");
    expect(screen.getByRole("button", { name: "Yashirish" })).toBeInTheDocument();
  });
});
