import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { api } from "../../shared/api/api";
import { renderWithProviders } from "../../test/test-utils";
import NotificationSendPage from "./index";

describe("NotificationSendPage preview", () => {
  it("previews the message as the real inbox card — title, text, category and priority chips, no actions", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { data: { items: [], meta: { total: 0 } } } });
    const user = userEvent.setup();
    renderWithProviders(<NotificationSendPage />);

    await user.type(screen.getByLabelText("Sarlavha"), "Yangi tarif");
    await user.type(screen.getByLabelText("Matn"), "1-oktabrdan kuchga kiradi");

    const preview = screen.getByTestId("dispatch-preview");
    expect(within(preview).getByText("Yangi tarif")).toBeInTheDocument();
    expect(within(preview).getByText("1-oktabrdan kuchga kiradi")).toBeInTheDocument();
    expect(within(preview).getByText("Tizim")).toBeInTheDocument();
    // Inbox'dagidek: "Oddiy" muhimlik chip'siz, "Yuqori" — chip bilan.
    expect(within(preview).queryByText("Oddiy")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Muhimlik" }));
    fireEvent.click(await screen.findByTitle("Yuqori"));
    expect(within(preview).getByText("Yuqori")).toBeInTheDocument();
    expect(within(preview).getByText("hozir")).toBeInTheDocument();
    // Hali yuborilmagan xabar — o'qildi/o'chirish tugmalari yo'q.
    expect(within(preview).queryByRole("button", { name: /O'qilgan deb belgilash|O'chirish/ })).not.toBeInTheDocument();
    getSpy.mockRestore();
  });
});
