// dizayn-v2: superadmin-users-detail, admin-users-detail
import { memo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getMarketTelegramToken, marketTelegramTokenQueryKey } from "../../../entities/user/api/userApi";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { notify } from "../../../shared/lib/notify";
import { Button, Card } from "../../../shared/ui/primitives";

/** Uzunligi ham oshkor bo'lmasin — doim bir xil sondagi nuqta. */
const MASKED_TOKEN = "•".repeat(16);

interface MarketTelegramTokenCardProps {
  /** Oldindan ma'lum token (eski javoblar `market_tg_token` bilan kelardi). */
  token?: string | null;
  /**
   * Market id: token bo'lmasa — «Ko'rsatish» / «Nusxalash» bosilganda `GET /markets/:id/tg-token` dan
   * olinadi (faqat superadmin; har ko'rish backend jurnaliga yoziladi — shuning uchun oldindan so'ralmaydi).
   */
  marketId?: string;
}

type TokenState = { status: "idle" | "loading" | "error" } | { status: "ready"; value: string | null };

/**
 * TELEGRAM TOKEN — dizayn v2 kartasi (maket `superadmin-users-detail`: «••••» + «Ko'rsatish» · «Nusxalash» +
 * izoh). Market Telegram guruhiga botni qo'shib, shu tokenni yuboradi — bot guruhni o'sha marketga bog'laydi.
 *
 * ⚠️ Token — maxfiy kalit: sukut bo'yicha yashirin, faqat «Ko'rsatish» bosilganda ochiladi; yashirin holatda ham
 * «Nusxalash» haqiqiy tokenni oladi. Kartani kim ko'rishini chaqiruvchi hal qiladi.
 */
export const MarketTelegramTokenCard = memo(({ token, marketId }: MarketTelegramTokenCardProps) => {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const [isRevealed, setIsRevealed] = useState(false);
  const preloaded = typeof token === "string" && token.trim() ? token.trim() : null;
  const [fetched, setFetched] = useState<TokenState>({ status: "idle" });
  const canFetch = !preloaded && Boolean(marketId);

  const value = preloaded ?? (fetched.status === "ready" ? fetched.value : null);
  const missing = !preloaded && (!marketId || (fetched.status === "ready" && fetched.value === null));
  const busy = fetched.status === "loading";

  /** Token qiymatini oladi (bor bo'lsa — darhol). */
  const resolveToken = async (): Promise<string | null> => {
    if (value) return value;
    if (!canFetch || !marketId) return null;
    setFetched({ status: "loading" });
    try {
      const next = await queryClient.fetchQuery({
        queryKey: marketTelegramTokenQueryKey(marketId),
        queryFn: () => getMarketTelegramToken(marketId),
        staleTime: 60_000,
        meta: { silentError: true },
      });
      setFetched({ status: "ready", value: next });
      return next;
    } catch {
      setFetched({ status: "error" });
      return null;
    }
  };

  const handleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      return;
    }
    if (await resolveToken()) setIsRevealed(true);
  };

  const handleCopy = async () => {
    const next = await resolveToken();
    if (!next) return;
    const copied = await copyToClipboard(next);
    if (copied) notify.success(t("telegramTokenCopied"));
    else notify.error(t("telegramTokenCopyFailed"));
  };

  return (
    <Card
      as="section"
      title={
        <span className="inline-flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <KeyRound size={18} strokeWidth={2} />
          </span>
          {t("telegramTokenTitle")}
        </span>
      }
      divided
      bodyClassName="flex flex-col gap-3"
    >
      {missing ? (
        <p className="m-0 text-sm text-text-muted">{t("telegramTokenMissing")}</p>
      ) : (
        <>
          <code
            data-testid="telegram-token-value"
            aria-label={isRevealed ? undefined : t("v2.token.maskedLabel")}
            className="block min-w-0 rounded-[10px] bg-sunken px-4 py-3 font-mono text-sm break-all text-text"
          >
            {isRevealed && value ? value : MASKED_TOKEN}
          </code>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              leftIcon={isRevealed ? EyeOff : Eye}
              aria-pressed={isRevealed}
              loading={busy}
              onClick={() => void handleReveal()}
            >
              {isRevealed ? t("telegramTokenHide") : t("telegramTokenShow")}
            </Button>
            <Button variant="secondary" leftIcon={Copy} disabled={busy} onClick={() => void handleCopy()}>
              {t("telegramTokenCopy")}
            </Button>
          </div>
          {fetched.status === "error" ? (
            <p role="alert" className="m-0 text-[13px] text-danger-fg">
              {t("v2.token.loadError")}
            </p>
          ) : null}
        </>
      )}
      <p className="m-0 text-[13px] text-text-muted">{t("v2.token.hint")}</p>
    </Card>
  );
});

MarketTelegramTokenCard.displayName = "MarketTelegramTokenCard";
