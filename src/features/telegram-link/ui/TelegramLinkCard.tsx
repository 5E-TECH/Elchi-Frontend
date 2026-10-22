// dizayn-v2: common-profile-telegram, common-profile-telegram-linked, common-profile-telegram-unlink-dialog
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, Unlink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateLocalized, toValidDate } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Button, Card, StatusBadge, useConfirm } from "../../../shared/ui/primitives";
import {
  useRefetchMyProfile,
  useTelegramLinkCode,
  useUnlinkTelegram,
} from "../api/useTelegramLink";
import type { TelegramLinkCode } from "../model/types";
import { LINK_TTL_MS } from "../lib/linkTime";
import { TelegramLinkDialog } from "./TelegramLinkDialog";

/** Oyna ochiq turganda profil shu oraliqda qayta o'qiladi — bot ulagani darhol ko'rinadi. */
export const TELEGRAM_LINK_POLL_MS = 3_000;
/** Server muddati bundan uzoq yoki o'tib ketgan bo'lsa — kompyuter soati noto'g'ri, 10 daqiqa olinadi. */
const MAX_TRUSTED_TTL_MS = 15 * 60_000;

/** `totalMs` — sanoq va progressning to'liq muddati (server 10 daqiqadan uzoq bersa — shuncha, sanoq qotib qolmasin). */
type LinkSession = { code: TelegramLinkCode; expiresAtMs: number; totalMs: number };
type DialogState = { open: boolean; session: LinkSession };

/**
 * Muddat mahalliy soat bo'yicha: serverning `expires_at` i qolgan vaqtga aylantiriladi (soat farqi bo'lsa
 * havola «eskirgan» bo'lib ochilmasin).
 */
const toSession = (code: TelegramLinkCode, now = Date.now()): LinkSession => {
  const serverExpiry = toValidDate(code.expiresAt)?.getTime();
  const ttl = serverExpiry == null ? Number.NaN : serverExpiry - now;
  const trusted = Number.isFinite(ttl) && ttl > 0 && ttl <= MAX_TRUSTED_TTL_MS;
  const total = trusted ? ttl : LINK_TTL_MS;
  return { code, expiresAtMs: now + total, totalMs: Math.max(LINK_TTL_MS, total) };
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
 * «Telegram» kartasi (o'z profilida): shaxsiy Telegram'ni Elchi botiga ulash va uzish. Maketlar
 * `common-profile-telegram` (ulanmagan), `-linked` (qalin «@username» · «{sana} da ulangan», «Telegram ulandi»
 * xabari), `-unlink-dialog` (tasdiq): qator = neytral ikonka + qalin nom + holat belgisi + 13 px izoh, o'ngda
 * ikkinchi darajali tugma (telefonda — matn ostida, to'liq en). Oynalar — `TelegramLinkDialog`.
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
      // Javob kelmadi — «Internet aloqasi yo'q» ni interceptor allaqachon ko'rsatgan. Backend matni
      // foydalanuvchiga chiqmaydi — faqat i18n izoh (403 — bu rolga ulash yopiq).
      if (axios.isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED") return;
      const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
      notify.error(t("linkError"), {
        description: t(forbidden ? "linkErrorForbidden" : "linkErrorRetry"),
      });
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

  const linkedHandle = linked ? formatUsername(username) : null;
  const linkedSince =
    linked && linkedAt && toValidDate(linkedAt)
      ? t("linkedSince", { date: formatDateLocalized(linkedAt) })
      : null;

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
            {linkedHandle || linkedSince ? (
              <p className="m-0 flex flex-wrap gap-x-1.5 text-[13px] leading-[18px] text-text-muted">
                {linkedHandle ? <span className="font-semibold text-text">{linkedHandle}</span> : null}
                {linkedHandle && linkedSince ? <span aria-hidden="true">·</span> : null}
                {linkedSince ? <span>{linkedSince}</span> : null}
              </p>
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
          totalMs={session.totalMs}
          expired={expired}
          renewing={linkCode.isPending}
          onRenew={requestCode}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
};
