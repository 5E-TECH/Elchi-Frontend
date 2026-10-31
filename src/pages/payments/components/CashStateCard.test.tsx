import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CashStateCard from "./CashStateCard";

describe("CashStateCard (qzjTMWPb)", () => {
  it("sof holat = kassa + qabul qilinishi kerak − berilishi kerak", () => {
    renderWithProviders(
      <CashStateCard cash={24_615_000} receive={9_870_000} give={13_458_000} loading={false} isError={false} />,
    );
    const card = screen.getByRole("region", { name: "Kassa holati" });
    expect(card).toHaveTextContent("21 027 000");
    expect(card).toHaveTextContent("Ijobiy");
    expect(card).toHaveTextContent("+9 870 000 so'm");
    expect(card).toHaveTextContent("−13 458 000 so'm");
    expect(screen.getByRole("img", { name: /^Sof holat 21 027 000 so'm/ })).toBeInTheDocument();
  });

  it("manfiy holat — «Salbiy»", () => {
    renderWithProviders(<CashStateCard cash={100} receive={0} give={300} loading={false} isError={false} />);
    expect(screen.getByRole("region", { name: "Kassa holati" })).toHaveTextContent("Salbiy");
  });

  it("xato — raqamlar va «Ijobiy» chizilmaydi (0 emas)", () => {
    renderWithProviders(<CashStateCard cash={0} receive={0} give={0} loading={false} isError onRetry={vi.fn()} />);
    expect(screen.getByText("Kassa holatini yuklab bo'lmadi")).toBeInTheDocument();
    expect(screen.queryByText("Ijobiy")).not.toBeInTheDocument();
    expect(screen.queryByText(/0 so'm/)).not.toBeInTheDocument();
  });
});
