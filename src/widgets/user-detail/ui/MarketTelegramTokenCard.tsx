// dizayn-v2: superadmin-users-detail
import { memo, useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchMarketTelegramToken } from "../../../entities/user/api/userApi";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Button, Card } from "../../../shared/ui/primitives";

/** Uzunligi ham oshkor bo'lmasin — doim bir xil sondagi nuqta. */
const MASKED_TOKEN = "•".repeat(16);

interface MarketTelegramTokenCardProps {
  marketId: string;
}

/**
 * Marketning Telegram tokeni — dizayn v2 (maket `superadmin-users-detail` «Telegram token»): yashirin
 * •••• qatori, «Ko'rsatish» va «Nusxalash», ostida izoh. Market Telegram guruhiga botni qo'shib, shu tokenni
 * yuboradi — bot guruhni o'sha marketga bog'laydi.
 *
 * GvL6ZFAd: token umumiy javoblarda yo'q — `GET /markets/:id/tg-token` dan faqat «Ko'rsatish» yoki
 * «Nusxalash» bosilganda olinadi (faqat SUPERADMIN; har ko'rish audit jurnaliga yoziladi), keshlanmaydi —
 * karta yopilsa unutiladi. Kartani chaqiruvchi faqat superadminga chizadi.
 */
export const MarketTelegramTokenCard = memo(({ marketId }: MarketTelegramTokenCardProps) => {
  const { t } = useTranslation("users");
  // `undefined` — hali so'ralmagan; `null` — marketda token yo'q.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [isRevealed, setIsRevealed] = useState(false);
  const [pending, setPending] = useState<"show" | "copy" | null>(null);

  const loadToken = async (): Promise<string | null | undefined> => {
    if (token !== undefined) return token;
    try {
      const value = await fetchMarketTelegramToken(marketId);
      setToken(value);
      return value;
    } catch (error) {
      // `null` — javob kelmadi: global «Internet aloqasi yo'q» xabari yetarli, ikkinchisi chiqmaydi.
      const description = getActionErrorMessage(error, t("telegramTokenLoadFailedHint"));
      if (description !== null) notify.error(t("telegramTokenLoadFailed"), { description });
      return undefined;
    }
  };

  const handleToggle = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }
    setPending("show");
    const value = await loadToken();
    setPending(null);
    if (value) setIsRevealed(true);
  };

  const handleCopy = async () => {
    setPending("copy");
    const value = await loadToken();
    setPending(null);
    if (!value) return;
    const copied = await copyToClipboard(value);
    if (copied) notify.success(t("telegramTokenCopied"));
    else notify.error(t("telegramTokenCopyFailed"));
  };

  const missing = token === null;

  return (
    <Card
      title={
        <span className="flex items-center gap-3">
          <span className="inline-flex size-9 flex-none items-center justify-center rounded-[10px] bg-sunken text-text-muted">
            <KeyRound size={18} aria-hidden="true" />
          </span>
          {t("telegramTokenTitle")}
        </span>
      }
      bodyClassName="flex flex-col gap-3"
    >
      {missing ? (
        <p className="text-sm text-text-muted">{t("telegramTokenMissing")}</p>
      ) : (
        <>
          <span
            data-testid="telegram-token-value"
            className={cx(
              "flex min-h-11 items-center rounded-[10px] bg-sunken px-3.5 text-sm font-semibold text-text",
              isRevealed ? "break-all py-2.5" : "overflow-hidden whitespace-nowrap",
            )}
          >
            {isRevealed && token ? (
              token
            ) : (
              <>
                {/* Nuqtalar ekran o'quvchiga o'qilmaydi — o'rniga «Token yashirilgan». */}
                <span aria-hidden="true">{MASKED_TOKEN}</span>
                <span className="sr-only">{t("telegramTokenHidden")}</span>
              </>
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            {/* Yorliq holatni o'zi aytadi («Ko'rsatish» / «Yashirish») — `aria-pressed` ikkilanmasin. Yuklanayotgan
                tugma `disabled` emas (fokus unda qoladi, `loading` bosishni to'sadi) — faqat ikkinchisi. */}
            <Button
              variant="secondary"
              leftIcon={isRevealed ? EyeOff : Eye}
              loading={pending === "show"}
              disabled={pending === "copy"}
              className="flex-[1_1_120px]"
              onClick={() => void handleToggle()}
            >
              {isRevealed ? t("telegramTokenHide") : t("telegramTokenShow")}
            </Button>
            <Button
              variant="secondary"
              leftIcon={Copy}
              loading={pending === "copy"}
              disabled={pending === "show"}
              className="flex-[1_1_120px]"
              onClick={() => void handleCopy()}
            >
              {t("telegramTokenCopy")}
            </Button>
          </div>
        </>
      )}
      <p className="text-[13px] text-text-muted">{t("telegramTokenHint")}</p>
    </Card>
  );
});

MarketTelegramTokenCard.displayName = "MarketTelegramTokenCard";
