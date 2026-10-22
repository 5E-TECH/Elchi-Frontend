import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CampaignSchedulePolicy } from "../../../entities/notification-campaign";
import { renderWithProviders } from "../../../test/test-utils";
import type { CampaignScheduleValue } from "../model/schema";
import { CampaignScheduleCard, type CampaignScheduleErrors } from "./CampaignScheduleCard";

/** 2026-10-21 19:10 Toshkent (14:10 UTC) — reklama taqiqi vaqti. */
const EVENING = Date.parse("2026-10-21T14:10:00Z");
/** 2026-10-21 10:05 Toshkent. */
const MORNING = Date.parse("2026-10-21T05:05:00Z");

const POLICY: CampaignSchedulePolicy = {
  quietHours: { start: "18:00", end: "09:00", enabled: true },
  isPromo: true,
  maxScheduleDays: 90,
  check: null,
};

const Harness = ({
  initial = { when: "now", day: "", time: "" },
  promo = true,
  now,
  errors,
}: {
  initial?: CampaignScheduleValue;
  promo?: boolean;
  now: number;
  errors?: CampaignScheduleErrors;
}) => {
  const [value, setValue] = useState<CampaignScheduleValue>(initial);
  return (
    <>
      <CampaignScheduleCard
        value={value}
        onChange={setValue}
        promo={promo}
        policy={POLICY}
        policyLoading={false}
        errors={errors}
        now={now}
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
};

const value = () => JSON.parse(screen.getByTestId("value").textContent ?? "{}") as CampaignScheduleValue;

describe("CampaignScheduleCard (KM-3, maket superadmin-notifications-send-schedule)", () => {
  it("«Belgilangan vaqtda» — sukut ertaga 10:00, «Ertaga, 10:00 da yuboriladi»", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness now={MORNING} />);
    const card = screen.getByTestId("campaign-schedule");
    expect(card).toHaveTextContent("Toshkent vaqti");
    expect(within(card).getByRole("radio", { name: /Darhol/ })).toBeChecked();
    await user.click(within(card).getByRole("radio", { name: /Belgilangan vaqtda/ }));
    expect(value()).toEqual({ when: "scheduled", day: "2026-10-22", time: "10:00" });
    expect(card).toHaveTextContent("90 kungacha oldinga");
    expect(card).toHaveTextContent("Ertaga, 10:00 da yuboriladi");
    expect(card).toHaveTextContent("Toshkent vaqti (UTC+5)");
  });

  it("reklama: taqiq soatlari tanlanmaydi («Reklama taqiqi»), taqiqdan tashqarisi — tanlanadi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness now={MORNING} initial={{ when: "scheduled", day: "2026-10-22", time: "10:00" }} />);
    const card = screen.getByTestId("campaign-schedule");
    expect(card).toHaveTextContent("Reklama 18:00–09:00 oralig'ida yuborilmaydi");
    await user.click(within(card).getByRole("combobox", { name: "Soat" }));
    const quiet = await screen.findByRole("option", { name: /^08:30/ });
    expect(quiet).toHaveAttribute("aria-disabled", "true");
    expect(quiet).toHaveTextContent("Reklama taqiqi");
    expect(screen.getByRole("option", { name: /^18:00/ })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("option", { name: /^17:30/ }));
    expect(value().time).toBe("17:30");
  });

  it("bugun — o'tgan soatlar ro'yxatda yo'q; reklama bo'lmasa taqiq izohi ham yo'q", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness promo={false} now={MORNING} initial={{ when: "scheduled", day: "2026-10-21", time: "" }} />,
    );
    const card = screen.getByTestId("campaign-schedule");
    expect(card).not.toHaveTextContent("Reklama 18:00–09:00");
    await user.click(within(card).getByRole("combobox", { name: "Soat" }));
    expect(screen.queryByRole("option", { name: /^10:00/ })).toBeNull();
    expect(screen.getByRole("option", { name: /^10:30/ })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: /^20:00/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("«Darhol» reklama kechqurun — «Hozir 19:10 — reklama ertaga, 09:00 da yuboriladi»", () => {
    renderWithProviders(<Harness now={EVENING} />);
    const card = screen.getByTestId("campaign-schedule");
    expect(card).toHaveTextContent("Hozir 19:10 — reklama ertaga, 09:00 da yuboriladi");
    expect(card).toHaveTextContent("Tungi taqiq tugashi bilan navbat o'zi davom etadi");
  });

  it("xato — maydon ostida, bloki «yuboriladi» chiqmaydi", () => {
    renderWithProviders(
      <Harness
        now={MORNING}
        initial={{ when: "scheduled", day: "2026-10-22", time: "20:00" }}
        errors={{ time: "Reklama 18:00–09:00 oralig'ida yuborilmaydi — boshqa soatni tanlang" }}
      />,
    );
    const card = screen.getByTestId("campaign-schedule");
    expect(card).toHaveTextContent("boshqa soatni tanlang");
    expect(card).not.toHaveTextContent("da yuboriladi");
  });
});
