// dizayn-v2: superadmin-notifications-sms-campaign-segment
import { useEffect, useId, useState } from "react";
import { Globe, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoticeAlert } from "../../../../entities/notification";
import { minutesToHhmm, quietHoursNotice, type QuietHours } from "../../../../entities/sms";
import { Badge } from "../../../../shared/ui/primitives";

/** Daqiqada bir marta yangilanadigan «hozir» (soat chegarasida izoh o'zi chiqadi / yo'qoladi). */
const useMinuteClock = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

export type CampaignSendTimeProps = {
  /** `GET sms/status` → `quiet_hours` (Toshkent, daqiqa). Noma'lum — izoh chizilmaydi. */
  quietHours: QuietHours | null | undefined;
};

/**
 * «YUBORISH VAQTI» — maket `superadmin-notifications-sms-campaign-segment` (karta pastki bo'limi): «Toshkent vaqti»
 * belgisi, yagona «Darhol» varianti va reklama tungi taqiqi ichida — «Hozir 19:10 — SMS ertaga, 09:00 da
 * yuboriladi» ogohlantirishi. «Belgilangan vaqtda» — «Taklif · backend kerak» (KM-4/KM-6), chizilmaydi.
 */
export const CampaignSendTime = ({ quietHours }: CampaignSendTimeProps) => {
  const { t } = useTranslation("sms");
  const titleId = useId();
  const now = useMinuteClock();
  const notice = quietHoursNotice(quietHours, now);

  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-border p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={titleId} className="m-0 text-sm font-semibold text-text">
          {t("campaign.when")}
        </h3>
        <Badge icon={Globe}>{t("campaign.tashkentTime")}</Badge>
      </div>

      <div role="radiogroup" aria-labelledby={titleId} className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border border-border-strong bg-surface px-3.5 py-3 has-[:checked]:border-action has-[:checked]:bg-action-soft">
          <input
            type="radio"
            name="sms-campaign-when"
            value="now"
            checked
            readOnly
            className="mt-0.5 size-[18px] shrink-0 accent-action"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold text-text">{t("campaign.whenNow")}</span>
            <span className="text-xs text-text-muted">{t("campaign.whenNowHint")}</span>
          </span>
        </label>
      </div>

      {notice && quietHours ? (
        <NoticeAlert
          tone="warning"
          icon={Moon}
          data-testid="campaign-quiet-notice"
          title={t(notice.day === "tomorrow" ? "campaign.quietTomorrow" : "campaign.quietToday", {
            now: minutesToHhmm(notice.now),
            at: minutesToHhmm(notice.sendAt),
          })}
        >
          {t("campaign.quietBody", { from: minutesToHhmm(quietHours.start), to: minutesToHhmm(quietHours.end) })}
        </NoticeAlert>
      ) : null}
    </div>
  );
};

export default CampaignSendTime;
