import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CampaignPage from "./CampaignPage";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../../../shared/api/api", () => ({ api }));

const preview = {
  message_class: "promo",
  text: "Chegirma 20%",
  sample_text: "Chegirma 20%\nRad etish: https://api.elchipochta.uz/sms/stop/998901111111.abc",
  encoding: "GSM-7",
  parts: 1,
  total: 3,
  recipients: 1,
  blocked_no_consent: 1,
  skipped_invalid_phone: 1,
  max_fanout: 200,
  fanout_exceeded: false,
  tariff: 175,
  estimated_cost: 175,
  scheduled_for: new Date().toISOString(),
  sms_enabled: true,
};

const HISTORY = [
  {
    id: "5",
    created_at: new Date().toISOString(),
    message_class: "transactional",
    text: "Hurmatli mijoz, 10-oktabr kuni qabul punkti 10:00 dan ishlaydi.",
    total: 86,
    queued: 86,
    blocked: 0,
    skipped: 0,
    sent: 86,
    delivered: 61,
    failed: 3,
    pending: 25,
    estimated_cost: null,
  },
];

describe("CampaignPage (sVByLMnt)", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("tariffs"))
        return Promise.resolve({ data: { data: { transactional: 95, promo: 175, security: 95 } } });
      if (url.endsWith("sms/campaigns")) return Promise.resolve({ data: { data: HISTORY } });
      if (url.endsWith("sms/status")) {
        return Promise.resolve({
          data: { data: { quiet_hours: { start: 18 * 60, end: 9 * 60 }, enabled: true } },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    api.post
      .mockReset()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("preview")
            ? { data: { data: preview } }
            : {
                data: {
                  data: {
                    campaign_id: "5",
                    queued: 1,
                    blocked_no_consent: 1,
                    skipped_invalid_phone: 1,
                  },
                },
              },
        ),
      );
  });

  const fill = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByRole("textbox", { name: "Xabar matni" }), text);
    await user.type(
      screen.getByRole("textbox", { name: "Telefon raqamlari (har qatorda bittadan)" }),
      "+998901111111\n+998902222222\nxyz",
    );
  };

  it("an unfilled {{placeholder}} is red and blocks the review (footer explains why)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Salom {{{{discount}}");

    const varInput = screen.getByRole("textbox", { name: "discount" });
    expect(varInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();
    expect(
      screen.getByText("Ko'rib chiqish uchun barcha o'zgaruvchilarni to'ldiring"),
    ).toBeInTheDocument();

    await user.type(varInput, "20%");
    expect(varInput).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeEnabled();
  });

  it("confirmation shows exact recipients, blocked, invalid, forecast and the FULL text; sends with Idempotency-Key", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma 20%");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(dialog).toHaveTextContent("1 ta qabul qiluvchiga yuboriladi");
    const body = within(dialog).getByTestId("campaign-confirm");
    expect(body).toHaveTextContent("Roziligi yo'q — yuborilmaydi1 ta");
    expect(body).toHaveTextContent("Raqami noto'g'ri — o'tkazib yuboriladi1 ta");
    expect(body).toHaveTextContent("Prognoz narx175 so'm");
    expect(body).toHaveTextContent("GSM-7, har biri 1 bo'lak");
    expect(body).toHaveTextContent("Bu amalni qaytarib bo'lmaydi.");
    expect(
      within(dialog).getByText(/Rad etish: https:\/\/api\.elchipochta\.uz\/sms\/stop/),
    ).toBeInTheDocument();

    const previewBody = api.post.mock.calls[0][1];
    expect(previewBody).toMatchObject({
      message_class: "promo",
      text: "Chegirma 20%",
      segment: { phones: ["+998901111111", "+998902222222", "xyz"] },
    });

    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const [url, body2, config] = api.post.mock.calls[1];
    expect(url).toBe("notifications/sms/campaigns");
    expect(body2).toEqual(previewBody);
    expect(config.headers["Idempotency-Key"]).toMatch(/.{8,}/);
    expect(await screen.findByText(/Navbatga qo'yildi: 1 ta/)).toBeInTheDocument();
  });

  it("each review gets a NEW Idempotency-Key; the same dialog reuses one key", async () => {
    api.post.mockImplementation((url: string) =>
      url.endsWith("preview")
        ? Promise.resolve({ data: { data: preview } })
        : Promise.reject(
            Object.assign(new Error("dup"), {
              response: { status: 409, data: { message: "Takroriy so'rov" } },
            }),
          ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");

    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    let dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    // 409 (takroriy kalit) — xato ko'rsatiladi, oyna yopiladi, qayta yuborilmaydi.
    expect(await screen.findByText("Takroriy so'rov")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    const firstKey = api.post.mock.calls[1][2].headers["Idempotency-Key"];

    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    await user.click(within(dialog).getByRole("button", { name: "Yuborish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(4));
    const secondKey = api.post.mock.calls[3][2].headers["Idempotency-Key"];
    expect(secondKey).not.toBe(firstKey);
  });

  it("cancel closes the confirmation without sending", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });

    await user.click(within(dialog).getByRole("button", { name: "Bekor qilish" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("over the fan-out limit the send button stays disabled", async () => {
    api.post.mockResolvedValueOnce({ data: { data: { ...preview, fanout_exceeded: true } } });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText(/chegaradan \(200\) ko'p/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Yuborish" })).toBeDisabled();
  });

  it("a later scheduled time is shown with the promo quiet hours", async () => {
    api.post.mockResolvedValueOnce({
      data: {
        data: {
          ...preview,
          scheduled_for: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "SMS kampaniyani yuborishni tasdiqlang",
    });
    expect(within(dialog).getByText(/da yuboriladi$/)).toBeInTheDocument();
    expect(within(dialog).getByText("Reklama taqiqi: 18:00–09:00")).toBeInTheDocument();
  });

  it("history: table with class badge, numbers and the count badge", async () => {
    renderWithProviders(<CampaignPage />);
    const table = await screen.findByRole("table", { name: "Yuborilgan kampaniyalar" });
    expect(within(table).getByText("Xizmat xabari")).toBeInTheDocument();
    expect(within(table).getByText(/Hurmatli mijoz/)).toBeInTheDocument();
    expect(within(table).getByText("25")).toHaveClass("text-warning-fg");
    expect(within(table).getByText("3")).toHaveClass("text-danger-fg");
    expect(screen.getByText("1 ta")).toBeInTheDocument();
  });
});
