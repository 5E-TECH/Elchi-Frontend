import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import InvestorsOpsPage from "./index";
import { toInvestorList } from "../../entities/investors";
import { renderWithProviders } from "../../test/test-utils";
import { expectNoRawBackendText, expectRequestBody, mockEnvelope, mockRejection } from "../../test/mockEnvelope";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("../../shared/api/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    post: (...a: unknown[]) => apiPostMock(...a),
  },
}));

describe("InvestorsOps page", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    // Haqiqiy konvert: `GET investors` → `{ statusCode, message, data: { items, meta } }`.
    apiGetMock.mockResolvedValue(mockEnvelope({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
    apiPostMock.mockResolvedValue(mockEnvelope({ id: "x", name: "Ali", phone_number: "+998901112233" }, { statusCode: 201 }));
  });

  it("renders header \"Investorlar\" with the back link; `embedded` — without the page header", () => {
    const { unmount } = renderWithProviders(<InvestorsOpsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Investorlar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ops vositalari/ })).toHaveAttribute("href", "/ops?tab=investors");
    unmount();

    renderWithProviders(<InvestorsOpsPage embedded />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Investorlar" })).toBeInTheDocument();
  });

  it("calls api.get with \"investors\" on mount", async () => {
    renderWithProviders(<InvestorsOpsPage />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("investors", expect.anything()),
    );
  });

  it("fills form and calls api.post with \"investors\"", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvestorsOpsPage />);

    await user.type(screen.getByRole("textbox", { name: /Investor ismi/ }), "Ali");
    await user.type(screen.getByRole("textbox", { name: /Telefon raqami/ }), "901112233");
    await user.click(screen.getByRole("button", { name: "Qo'shish" }));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expectRequestBody(apiPostMock, "investors", { name: "Ali", phone_number: "+998901112233" });
    expect(await screen.findByText("Investor muvaffaqiyatli qo'shildi")).toBeInTheDocument();
    expect(screen.getByText("Ali · +998 90 111 22 33")).toBeInTheDocument();
  });

  it("does not post an incomplete form — shows field errors instead", async () => {
    const user = userEvent.setup();
    renderWithProviders(<InvestorsOpsPage />);

    await user.click(screen.getByRole("button", { name: "Qo'shish" }));
    expect(await screen.findByText("Investor ismini kiriting")).toBeInTheDocument();
    expect(screen.getByText("Telefon raqamini to'liq kiriting")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("unwraps the {data:{items,meta}} envelope and shows the investors instead of crashing", async () => {
    // Jonli javob shakli — ilgari "te.some is not a function" bilan /runtime-error ga otardi.
    apiGetMock.mockResolvedValue(
      mockEnvelope({
        items: [{ id: "1", name: "AUDIT TEST Investor", phone_number: "+998901112233" }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    );
    renderWithProviders(<InvestorsOpsPage />);

    expect(await screen.findByText("AUDIT TEST Investor")).toBeInTheDocument();
    expect(screen.getByText("+998 90 111 22 33")).toBeInTheDocument();
    expect(screen.getByText("1 ta")).toBeInTheDocument();
  });

  it("shows an empty state for an empty list instead of crashing", async () => {
    apiGetMock.mockResolvedValue(mockEnvelope({ items: [], meta: {} }));
    renderWithProviders(<InvestorsOpsPage />);

    expect(await screen.findByText("Investorlar yo'q")).toBeInTheDocument();
  });

  it("so'rov rad etildi (qo'shish 409) — i18n matn, xom backend matni yo'q, muvaffaqiyat chiqmaydi", async () => {
    apiPostMock.mockRejectedValue(mockRejection(409));
    const user = userEvent.setup();
    renderWithProviders(<InvestorsOpsPage />);

    await user.type(screen.getByRole("textbox", { name: /Investor ismi/ }), "Ali");
    await user.type(screen.getByRole("textbox", { name: /Telefon raqami/ }), "901112233");
    await user.click(screen.getByRole("button", { name: "Qo'shish" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Holat allaqachon o'zgargan (409). Ro'yxatni yangilab, qayta urinib ko'ring.");
    expect(screen.queryByText("Investor muvaffaqiyatli qo'shildi")).toBeNull();
    expectNoRawBackendText();
  });

  it("so'rov rad etildi (ro'yxat 400) — xato holati i18n matni bilan, xom backend matni yo'q", async () => {
    apiGetMock.mockRejectedValue(mockRejection(400));
    renderWithProviders(<InvestorsOpsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("So'rov bajarilmadi (400).");
    expectNoRawBackendText();
  });
});

describe("toInvestorList", () => {
  it("returns the items array from any response shape", () => {
    expect(toInvestorList({ data: { items: [{ id: "1" }], meta: { total: 1 } } })).toEqual({ items: [{ id: "1" }], meta: { total: 1 } });
    expect(toInvestorList({ items: [{ id: "2" }] }).items).toEqual([{ id: "2" }]);
    expect(toInvestorList([{ id: "3" }]).items).toEqual([{ id: "3" }]);
    expect(toInvestorList({ data: { statusCode: 500 } }).items).toEqual([]);
    expect(toInvestorList(null).items).toEqual([]);
  });
});
