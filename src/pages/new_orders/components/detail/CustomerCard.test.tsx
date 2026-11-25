import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import { CustomerCard } from "./CustomerCard";
import { normalizeOrderDetail } from "./orderDetailModel";

const order = (customer: Record<string, unknown>) =>
  normalizeOrderDetail({ id: "95", status: "waiting", customer: { id: "c1", name: "Aliyev Vali", ...customer } })!;

/** iOiPoBMG (ega 2026-11-20): buyurtma tafsilotida mijoz telefoni bosilsa — qo'ng'iroq. */
describe("CustomerCard — mijoz telefoni (iOiPoBMG)", () => {
  it.each(["default", "market"] as const)("⭐ %s: `tel:` havola, nomi — kim va qaysi raqam", (variant) => {
    renderWithProviders(<CustomerCard order={order({ phone_number: "901234567" })} variant={variant} />);
    const link = screen.getByRole("link", { name: "Qo'ng'iroq qilish: Aliyev Vali, +998 90 123 45 67" });
    expect(link).toHaveAttribute("href", "tel:+998901234567");
    expect(link).toHaveTextContent("+998 90 123 45 67");
    expect(screen.queryByText("Qo'shimcha raqam")).not.toBeInTheDocument();
  });

  it("qo'shimcha raqam ham havola", () => {
    renderWithProviders(
      <CustomerCard order={order({ phone_number: "+998901234567", extra_number: "+998 97 111 22 33" })} />,
    );
    expect(screen.getByText("Qo'shimcha raqam")).toBeInTheDocument();
    expect(within(screen.getByTestId("customer-extra-phone")).getByRole("link")).toHaveAttribute(
      "href",
      "tel:+998971112233",
    );
  });

  it.each([
    ["yo'q", "", "—"],
    ["null", null, "—"],
    ["chala", "+998 90 123", "+998 90 123"],
  ])("raqam %s — havola chizilmaydi", (_label, phone_number, text) => {
    renderWithProviders(<CustomerCard order={order({ phone_number })} />);
    const cell = screen.getByTestId("customer-phone");
    expect(cell).toHaveTextContent(text);
    expect(within(cell).queryByRole("link")).toBeNull();
  });
});
