import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/test-utils";
import CampaignPage from "./CampaignPage";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
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

describe("CampaignPage (sVByLMnt)", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) => {
      if (url.endsWith("tariffs")) return Promise.resolve({ data: { data: { transactional: 95, promo: 175, security: 95 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    api.post.mockReset().mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("preview")
          ? { data: { data: preview } }
          : { data: { data: { campaign_id: "5", queued: 1, blocked_no_consent: 1, skipped_invalid_phone: 1 } } },
      ),
    );
  });

  const fill = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByLabelText("Xabar matni"), text);
    await user.type(screen.getByLabelText("Telefon raqamlari (har qatorda bittadan)"), "+998901111111\n+998902222222\nxyz");
  };

  it("an unfilled {{placeholder}} is red and blocks the review", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Salom {{{{discount}}");

    const varInput = screen.getByLabelText("discount");
    expect(varInput.closest(".ant-input-group-wrapper, .ant-input-affix-wrapper, .ant-input")?.className ?? varInput.className).toMatch(/error/);
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeDisabled();

    await user.type(varInput, "20%");
    expect(screen.getByRole("button", { name: "Ko'rib chiqish" })).toBeEnabled();
  });

  it("confirmation shows exact recipients, blocked, invalid, forecast and the FULL text; sends with Idempotency-Key", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma 20%");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));

    const dialog = await screen.findByTestId("campaign-confirm");
    expect(dialog).toHaveTextContent("1 ta qabul qiluvchiga yuboriladi");
    expect(dialog).toHaveTextContent("Roziligi yo'q — yuborilmaydi: 1");
    expect(dialog).toHaveTextContent("Raqami noto'g'ri — o'tkazib yuboriladi: 1");
    expect(dialog).toHaveTextContent("175");
    expect(within(dialog).getByText(/Rad etish: https:\/\/api\.elchipochta\.uz\/sms\/stop/)).toBeInTheDocument();

    const previewBody = api.post.mock.calls[0][1];
    expect(previewBody).toMatchObject({ message_class: "promo", text: "Chegirma 20%", segment: { phones: ["+998901111111", "+998902222222", "xyz"] } });

    await user.click(screen.getByRole("button", { name: "Yuborish" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    const [url, body, config] = api.post.mock.calls[1];
    expect(url).toBe("notifications/sms/campaigns");
    expect(body).toEqual(previewBody);
    expect(config.headers["Idempotency-Key"]).toMatch(/.{8,}/);
    expect(await screen.findByText(/Navbatga qo'yildi: 1 ta/)).toBeInTheDocument();
  });

  it("over the fan-out limit the send button stays disabled", async () => {
    api.post.mockResolvedValueOnce({ data: { data: { ...preview, fanout_exceeded: true } } });
    const user = userEvent.setup();
    renderWithProviders(<CampaignPage />);
    await fill(user, "Chegirma");
    await user.click(screen.getByRole("button", { name: "Ko'rib chiqish" }));
    await screen.findByTestId("campaign-confirm");
    expect(screen.getByText(/chegaradan \(200\) ko'p/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yuborish" })).toBeDisabled();
  });
});
