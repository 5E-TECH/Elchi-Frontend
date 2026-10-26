import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../../test/test-utils";
import type { QuietHours } from "../../../../entities/sms";
import { CampaignSendTime } from "./CampaignSendTime";
import { createSmsSendTime, quietShiftFor, type SmsSendTimeValue } from "./sendTime";

const QUIET = { start: 18 * 60, end: 9 * 60 };

const Harness = ({
  quietHours,
  initial = createSmsSendTime(),
}: {
  quietHours: QuietHours | undefined;
  initial?: SmsSendTimeValue;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CampaignSendTime quietHours={quietHours} value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
};

describe("CampaignSendTime (KM-1, tungi taqiq izohi)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("⭐ kechqurun 19:10 (Toshkent) — «SMS ertaga, 09:00 da yuboriladi»", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T14:10:00Z"));
    renderWithProviders(<Harness quietHours={QUIET} />);
    const notice = screen.getByTestId("campaign-quiet-notice");
    expect(notice).toHaveTextContent("Hozir 19:10 — SMS ertaga, 09:00 da yuboriladi");
    expect(notice).toHaveTextContent("Reklama 18:00–09:00 oralig'ida yuborilmaydi");
  });

  it("tunda 03:00 — «bugun, 09:00»", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T22:00:00Z"));
    renderWithProviders(<Harness quietHours={QUIET} />);
    expect(screen.getByTestId("campaign-quiet-notice")).toHaveTextContent(
      "Hozir 03:00 — SMS bugun, 09:00 da yuboriladi",
    );
  });

  it("kunduzi va taqiq noma'lum bo'lsa — izoh yo'q", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z"));
    const { unmount } = renderWithProviders(<Harness quietHours={QUIET} />);
    expect(screen.queryByTestId("campaign-quiet-notice")).toBeNull();
    unmount();
    vi.setSystemTime(new Date("2026-10-21T14:10:00Z"));
    renderWithProviders(<Harness quietHours={undefined} />);
    expect(screen.queryByTestId("campaign-quiet-notice")).toBeNull();
    expect(screen.getByRole("radio", { name: /Darhol/ })).toBeChecked();
  });
});

describe("CampaignSendTime (KM-6, 2aS7PFX0 — belgilangan vaqtda)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("«Belgilangan vaqtda» — sukut ertaga 10:00 (Toshkent), sana/soat maydonlari va «Ertaga, 10:00 da yuboriladi»", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T14:10:00Z")); // 19:10 Toshkent
    renderWithProviders(<Harness quietHours={QUIET} />);
    fireEvent.click(screen.getByRole("radio", { name: /Belgilangan vaqtda/ }));
    expect(screen.getByRole("radio", { name: /Belgilangan vaqtda/ })).toBeChecked();
    expect(JSON.parse(screen.getByTestId("value").textContent ?? "{}")).toEqual({
      when: "scheduled",
      day: "2026-10-22",
      time: "10:00",
    });
    expect(screen.getByText("Sana")).toBeInTheDocument();
    expect(screen.getByText("Soat")).toBeInTheDocument();
    expect(screen.getByTestId("campaign-schedule-chosen")).toHaveTextContent("Ertaga, 10:00 da yuboriladi");
    // «Darhol» taqiq izohi belgilangan vaqtda chiqmaydi.
    expect(screen.queryByTestId("campaign-quiet-notice")).toBeNull();
  });

  it("tanlangan soat taqiqqa tushsa — backend 09:00 ga surishi oldindan aytiladi", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T07:00:00Z")); // 12:00 Toshkent
    renderWithProviders(
      <Harness quietHours={QUIET} initial={{ when: "scheduled", day: "2026-10-22", time: "20:00" }} />,
    );
    const shift = screen.getByTestId("campaign-quiet-shift");
    expect(shift).toHaveTextContent("20:00 reklama taqiqiga tushadi — SMS 23.10.2026, 09:00 da yuboriladi");
    expect(screen.queryByTestId("campaign-schedule-chosen")).toBeNull();
  });

  it("quietShiftFor: kechqurun — ertasi 09:00, ertalab — o'sha kun 09:00, kunduzi — null", () => {
    expect(quietShiftFor("2026-10-22", "20:00", QUIET)).toEqual({ day: "2026-10-23", time: "09:00" });
    expect(quietShiftFor("2026-10-22", "07:30", QUIET)).toEqual({ day: "2026-10-22", time: "09:00" });
    expect(quietShiftFor("2026-10-22", "12:00", QUIET)).toBeNull();
    expect(quietShiftFor("2026-10-22", "20:00", null)).toBeNull();
    expect(quietShiftFor("2026-10-22", "20:00", { start: 600, end: 600 })).toBeNull();
  });
});
