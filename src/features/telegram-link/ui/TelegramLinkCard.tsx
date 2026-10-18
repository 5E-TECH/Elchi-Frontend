// dizayn-v2: (maket yo'q) common-profile
import { useEffect, useRef, useState } from "react";
import { Send, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActionErrorMessage } from "../../../shared/lib/actionError";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, StatusBadge, useConfirm } from "../../../shared/ui/primitives";
import {
  useRefetchMyProfile,
  useTelegramLinkCode,
  useUnlinkTelegram,
} from "../api/useTelegramLink";
import type { TelegramLinkCode } from "../model/types";
import { TelegramLinkDialog } from "./TelegramLinkDialog";

/** Oyna ochiq turganda profil shu oraliqda qayta o'qiladi — bot ulagani darhol ko'rinadi. */
export const TELEGRAM_LINK_POLL_MS = 3_000;
/** Havola muddati (backend: bir martalik, 10 daqiqa). */
const LINK_TTL_MS = 10 * 60_000;
/** Server muddati bundan uzoq yoki o'tib ketgan bo'lsa — kompyuter soati noto'g'ri, 10 daqiqa olinadi. */
const MAX_TRUSTED_TTL_MS = 15 * 60_000;

type LinkSession = { code: TelegramLinkCode; expiresAtMs: number };
type DialogState = { open: boolean; session: LinkSession };

/**
 * Muddat mahalliy soat bo'yicha: serverning `expires_at` i qolgan vaqtga aylantiriladi (soat farqi bo'lsa
 * havola «eskirgan» bo'lib ochilmasin).
 */
const toSession = (code: TelegramLinkCode, now = Date.now()): LinkSession => {
  const serverExpiry = toValidDate(code.expiresAt)?.getTime();
  const ttl = serverExpiry == null ? Number.NaN : serverExpiry - now;
  const trusted = Number.isFinite(ttl) && ttl > 0 && ttl <= MAX_TRUSTED_TTL_MS;
  return { code, expiresAtMs: now + (trusted ? ttl : LINK_TTL_MS) };
};

const formatUsername = (username?: string | null) => {
  const value = typeof username === "string" ? username.trim().replace(/^@+/, "") : "";
  return value ? `@${value}` : null;
};

export type TelegramLinkCardProps = {
  /** `GET /auth/my-profile` → `telegram_linked`. */
  linked: boolean;
  username?: string | null;
  linkedAt?: string | null;
};

/**
 * «Telegram» kartasi (o'z profilida): shaxsiy Telegram'ni Elchi botiga ulash va uzish.
 * Maket yo'q — eng yaqini `common-profile` «Xavfsizlik» kartasi: sarlavha, qator = neytral ikonka + qalin
 * nom + 13 px izoh + holat belgisi, o'ngda ikkinchi darajali tugma (telefonda — matn ostida, to'liq en).
 */
export const TelegramLinkCard = ({ linked, username, linkedAt }: TelegramLinkCardProps) => {
  const { t } = useTranslation("telegramLink");
  const confirm = useConfirm();
  const linkCode = useTelegramLinkCode();
  const unlink = useUnlinkTelegram();
  const refetchProfile = useRefetchMyProfile();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [expiredToken, setExpiredToken] = useState<string | null>(null);
  const [linkedNotices, setLinkedNotices] = useState(0);
  const shownNotices = useRef(0);

  const session = dialog?.session ?? null;
  const dialogOpen = dialog?.open === true;
  const expired = session != null && expiredToken === session.code.token;

  // Bot ulagach profil `telegram_linked: true` bo'ladi — oyna yopiladi va xabar chiqadi
  // (holat render paytida moslanadi: qaysi so'rov yangilagani muhim emas — so'rash, oynaga qaytish …).
  if (linked && dialog?.open) {
    setDialog({ ...dialog, open: false });
    setLinkedNotices((count) => count + 1);
  }

  useEffect(() => {
    if (linkedNotices <= shownNotices.current) return;
    shownNotices.current = linkedNotices;
    notify.success(t("linkedToast"), { description: t("linkedToastText") });
  }, [linkedNotices, t]);

  // Havola muddati tugaganda — «Havola eskirdi».
  useEffect(() => {
    if (!dialogOpen || !session) return;
    const { token } = session.code;
    const timer = window.setTimeout(
      () => setExpiredToken(token),
      Math.max(0, session.expiresAtMs - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [dialogOpen, session]);

  // Oyna ochiq va havola amalda — profilni qayta o'qib, bot ulaganini kutamiz.
  const polling = dialogOpen && !expired && !linked;
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      void refetchProfile();
    }, TELEGRAM_LINK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, refetchProfile]);

  const requestCode = async () => {
    try {
      const code = await linkCode.mutateAsync();
      setDialog({ open: true, session: toSession(code) });
    } catch (error) {
      // `null` — javob kelmadi: «Tarmoq xatosi» ni interceptor allaqachon ko'rsatgan.
      const message = getActionErrorMessage(error, "");
      if (message === null) return;
      notify.error(t("linkError"), message ? { description: message } : undefined);
    }
  };

  const closeDialog = () => {
    setDialog((current) => (current ? { ...current, open: false } : current));
    // Yopish oldidan ulangan bo'lishi mumkin — holat darhol yangilansin.
    void refetchProfile();
  };

  const handleUnlink = async () => {
    const ok = await confirm({
      tone: "danger",
      icon: Unlink,
      title: t("unlinkTitle"),
      description: t("unlinkDescription"),
      confirmLabel: t("unlinkConfirm"),
      loadingLabel: t("unlinking"),
      onConfirm: () => unlink.mutateAsync(),
    });
    if (ok) notify.success(t("unlinkedToast"));
  };

  const linkedMeta = linked
    ? [
        formatUsername(username),
        linkedAt && toValidDate(linkedAt)
          ? t("linkedSince", { date: formatDateLocalized(linkedAt) })
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <>
      <Card title={t("title")} bodyClassName="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted">
            <Send aria-hidden="true" size={18} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-text">{t("rowTitle")}</span>
              {linked ? (
                <StatusBadge tone="success" label={t("statusLinked")} />
              ) : (
                <StatusBadge tone="neutral" label={t("statusUnlinked")} />
              )}
            </div>
            <p className="m-0 text-[13px] leading-[18px] text-text-muted">
              {linked ? t("linkedDescription") : t("unlinkedDescription")}
            </p>
            {linkedMeta ? (
              <p className="m-0 text-[13px] leading-[18px] text-text-muted">{linkedMeta}</p>
            ) : null}
          </div>
        </div>
        {linked ? (
          <Button variant="secondary" className="max-md:w-full" onClick={handleUnlink}>
            {t("unlink")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="max-md:w-full"
            loading={linkCode.isPending && !dialogOpen}
            loadingText={t("linkLoading")}
            onClick={requestCode}
          >
            {t("link")}
          </Button>
        )}
      </Card>
      {session ? (
        <TelegramLinkDialog
          open={dialogOpen}
          code={session.code}
          expiresAtMs={session.expiresAtMs}
          expired={expired}
          renewing={linkCode.isPending}
          onRenew={requestCode}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
};
