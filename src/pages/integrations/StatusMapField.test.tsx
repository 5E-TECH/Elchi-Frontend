import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/test-utils";
import StatusMapField from "./StatusMapField";
import type { ConnectionField } from "./connections";

const catalogMock = vi.hoisted(() => ({ value: { data: undefined as unknown, isLoading: false } }));
vi.mock("../../entities/integrations/statusCatalog", () => ({ useStatusCatalog: () => catalogMock.value }));

const catalog = {
  shipment: [
    { code: "sold", key: "sold", meaning_uz: "Yetkazildi, pul olindi" },
    { code: "on the road", key: "on_the_road", meaning_uz: "Yo'lda" },
    { code: "cancelled", key: "cancelled", meaning_uz: "Bekor" },
  ],
  payment: [
    { code: "succeeded", key: "succeeded", meaning_uz: "To'lov o'tdi" },
    { code: "failed", key: "failed", meaning_uz: "To'lov o'tmadi" },
  ],
  inbound_default_action: { sold: "sell", cancelled: "cancel" },
};

const field = (key: string): ConnectionField => ({ key, labelKey: "fStatusMappingLabel", type: "status-map" }) as ConnectionField;

describe("StatusMapField (JnHK6bgV)", () => {
  beforeEach(() => {
    catalogMock.value = { data: catalog, isLoading: false };
  });

  it("har kanonik status QATOR: o'zbekcha nom + kod + ma'no + input; sarlavhada moslangan/jami", () => {
    renderWithProviders(
      <StatusMapField field={field("status_mapping")} kind="outbound" value={{ sold: "7", sell: "DONE" }} onChange={vi.fn()} />,
    );
    const row = screen.getByTestId("status-map-row-on_the_road");
    expect(within(row).getByText("on the road")).toBeInTheDocument();
    expect(within(row).getByText("Yo'lda — filiallar orasida")).toBeInTheDocument();
    expect(screen.getByTestId("status-map-matched")).toHaveTextContent("moslangan: 1 / 3");
    expect((within(screen.getByTestId("status-map-row-sold")).getByRole("textbox") as HTMLInputElement).value).toBe("7");
  });

  it("hamkor qiymati erkin matn: raqam, kirill va tire-li kod; payload kalit→qiymat", () => {
    const onChange = vi.fn();
    renderWithProviders(<StatusMapField field={field("status_mapping")} kind="outbound" value={{}} onChange={onChange} />);
    const input = within(screen.getByTestId("status-map-row-cancelled")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "ST-07" } });
    expect(onChange).toHaveBeenLastCalledWith({ cancelled: "ST-07" });
    fireEvent.change(input, { target: { value: "отменён" } });
    expect(onChange).toHaveBeenLastCalledWith({ cancelled: "отменён" });
  });

  it("katalogda yo'q eski qiymat \"Qo'shimcha\" bo'limida ko'rinadi", () => {
    renderWithProviders(
      <StatusMapField field={field("status_mapping")} kind="outbound" value={{ sold: "7", sell: "DONE" }} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("Qo'shimcha / nostandart qiymatlar (1)"));
    expect((screen.getByLabelText("sell") as HTMLInputElement).value).toBe("DONE");
  });

  it("to'lov xaritasi o'z (to'lov) katalogini oladi, posilkanikini emas; qiymat massiv", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <StatusMapField field={field("payment_config.status_map")} kind="payment" value={{}} onChange={onChange} />,
    );
    expect(screen.getByTestId("status-map-row-succeeded")).toBeInTheDocument();
    expect(screen.queryByTestId("status-map-row-sold")).not.toBeInTheDocument();
    fireEvent.change(within(screen.getByTestId("status-map-row-succeeded")).getByRole("textbox"), {
      target: { value: "2, PAID" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ succeeded: ["2", "PAID"] });
  });

  it("kiruvchi xaritada yakuniy holat amali ko'rsatiladi va yangi kodga yoziladi", () => {
    const onChange = vi.fn();
    renderWithProviders(<StatusMapField field={field("inbound_status_mapping")} kind="inbound" value={{}} onChange={onChange} />);
    const row = screen.getByTestId("status-map-row-sold");
    expect(within(row).getByText("buyurtmani sotadi")).toBeInTheDocument();
    fireEvent.change(within(row).getByRole("textbox"), { target: { value: "DELIVERED" } });
    expect(onChange).toHaveBeenLastCalledWith({ DELIVERED: { status: "sold", action: "sell" } });
  });

  it("390px: qatorlar ustma-ust (bitta ustun), md dan uch ustun", () => {
    renderWithProviders(<StatusMapField field={field("status_mapping")} kind="outbound" value={{}} onChange={vi.fn()} />);
    expect(screen.getByTestId("status-map-row-sold")).toHaveClass("grid-cols-1");
    expect(screen.getByTestId("status-map-row-sold").className).toMatch(/md:grid-cols-\[/);
  });

  it("katalog yuklanmasa ogohlantirish — bo'sh jadval emas", () => {
    catalogMock.value = { data: null, isLoading: false };
    renderWithProviders(<StatusMapField field={field("status_mapping")} kind="outbound" value={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/Statuslar ro'yxatini yuklab bo'lmadi/)).toBeInTheDocument();
  });
});
