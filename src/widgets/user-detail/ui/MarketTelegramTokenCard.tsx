import { memo, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppNotification } from "../../../app/providers/notification/NotificationProvider";
import { copyToClipboard } from "../../../shared/lib/clipboard";

/** Uzunligi ham oshkor bo'lmasin — doim bir xil sondagi nuqta. */
const MASKED_TOKEN = "•".repeat(16);

interface MarketTelegramTokenCardProps {
  token?: string | null;
}

/**
 * Marketning Telegram tokeni (fix3b CODE-02, docs: admin tokenni marketga
 * beradi). Market Telegram guruhiga botni qo'shib, shu tokenni yuboradi —
 * bot guruhni o'sha marketga bog'laydi.
 *
 * ⚠️ Token — maxfiy kalit: sukut bo'yicha yashirin, faqat "Ko'rsatish"
 * bosilganda ochiladi. Kartani faqat SUPERADMIN/ADMIN ko'radi (chaqiruvchi
 * tekshiradi; backend ham tokenni faqat ularga qaytaradi).
 */
export const MarketTelegramTokenCard = memo(({ token }: MarketTelegramTokenCardProps) => {
  const { t } = useTranslation("users");
  const { api } = useAppNotification();
  const [isRevealed, setIsRevealed] = useState(false);
  const value = typeof token === "string" ? token.trim() : "";

  const handleCopy = () => {
    if (!value) return;
    void copyToClipboard(value).then((copied) => {
      if (copied) {
        api.success({ message: t("telegramTokenCopied"), placement: "topRight" });
      } else {
        api.error({ message: t("telegramTokenCopyFailed"), placement: "topRight" });
      }
    });
  };

  return (
    <section
      aria-label={t("telegramTokenTitle")}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-maindark sm:p-5"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
          <KeyRound size={17} />
        </span>
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t("telegramTokenTitle")}</h3>
      </div>

      {value ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code
            data-testid="telegram-token-value"
            className="min-w-0 flex-1 break-all rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            {isRevealed ? value : MASKED_TOKEN}
          </code>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setIsRevealed((previous) => !previous)}
              aria-pressed={isRevealed}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-main/40 hover:text-main dark:border-white/10 dark:text-white/80"
            >
              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              {isRevealed ? t("telegramTokenHide") : t("telegramTokenShow")}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-main px-3 text-xs font-bold text-white transition-colors hover:bg-main/90"
            >
              <Copy size={14} />
              {t("telegramTokenCopy")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-500 dark:text-white/60">{t("telegramTokenMissing")}</p>
      )}

      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-white/60">{t("telegramTokenHint")}</p>
    </section>
  );
});

MarketTelegramTokenCard.displayName = "MarketTelegramTokenCard";
