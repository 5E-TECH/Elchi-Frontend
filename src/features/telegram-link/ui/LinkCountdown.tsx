// dizayn-v2: common-profile-telegram-link-dialog, superadmin-notifications-create-link-dialog
import { useEffect, useId, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { LINK_TTL_MS, formatLinkTimeLeft } from "../lib/linkTime";

export type LinkCountdownProps = {
  /** Havola amal qiladigan oxirgi lahza (ms, mahalliy soat bo'yicha). */
  expiresAtMs: number;
  /** To'liq muddat (progress 100% i), sukut — 10 daqiqa. */
  totalMs?: number;
  /**
   * `bar` (sukut) — ikki qator + progress chizig'i (shaxsiy Telegram oynasi, `common-profile-telegram-link-dialog`).
   * `inline` — bitta qator, progresssiz: «🕓 9:41 qoldi · 14:37 gacha amal qiladi» (guruh qo'shish oynasi,
   * `*-notifications-create-link-dialog`).
   */
  variant?: "bar" | "inline";
  /** `inline` da muddat matni (sukut — `telegramLink:expiresAt`); iste'molchi o'z matnini beradi. */
  untilLabel?: string;
  className?: string;
};

/**
 * Havola muddati: «Havola 14:25 gacha amal qiladi» + «9:41 qoldi» (`role="timer"`, har soniyada) va ingichka
 * progress chizig'i (maket `.el-progress`, 6 px, to'ldirish `text-subtle`; primitivi yo'q — CODE-MAP §2.9).
 * Muddat tugaganini bu komponent hal qilmaydi — ota oyna «Havola eskirdi» holatiga o'tkazadi.
 */
export const LinkCountdown = ({
  expiresAtMs,
  totalMs = LINK_TTL_MS,
  variant = "bar",
  untilLabel,
  className,
}: LinkCountdownProps) => {
  const { t } = useTranslation("telegramLink");
  const leftId = useId();
  const [now, setNow] = useState(() => Date.now());

  const leftMs = Math.max(0, Math.min(totalMs, expiresAtMs - now));
  const running = leftMs > 0;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, expiresAtMs]);

  const totalSeconds = Math.round(totalMs / 1000);
  const leftSeconds = Math.ceil(leftMs / 1000);
  const percent = totalMs > 0 ? (leftMs / totalMs) * 100 : 0;

  if (variant === "inline") {
    return (
      <p className={cx("m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px]", className)}>
        <Clock aria-hidden="true" size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
        <span role="timer" className="whitespace-nowrap font-semibold text-text tabular-nums">
          {t("timeLeft", { time: formatLinkTimeLeft(leftMs) })}
        </span>
        <span className="text-text-muted">
          · {untilLabel ?? t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
        </span>
      </p>
    );
  }

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-text-muted">
          <Clock aria-hidden="true" size={16} strokeWidth={2} className="shrink-0" />
          {t("expiresAt", { time: formatTimeLocalized(expiresAtMs) })}
        </span>
        <span
          id={leftId}
          role="timer"
          className="whitespace-nowrap text-[13px] leading-[18px] font-semibold text-text tabular-nums"
        >
          {t("timeLeft", { time: formatLinkTimeLeft(leftMs) })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={leftId}
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={leftSeconds}
        className="h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <span
          className="block h-full rounded-full bg-text-subtle transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
