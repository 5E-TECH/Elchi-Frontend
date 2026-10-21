// dizayn-v2: superadmin-notifications-create-dialog
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { Bell, Clock, ExternalLink, Link2, RefreshCw, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  GroupTypeChoice,
  NoticeAlert,
  useNotificationMarkets,
  useNotifications,
  type NotificationGroupType,
} from "../../../entities/notification";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getApiErrorMessage } from "../../../shared/lib/apiError";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Button, buttonClasses, Dialog, Field, Select, Spinner } from "../../../shared/ui/primitives";
import { useRequestGroupLink } from "../api/useRequestGroupLink";
import { GROUP_LINK_POLL_MS } from "../model/constants";
import type { GroupLinkCode } from "../model/types";
import { LinkQrImage as GroupLinkQr } from "../../telegram-link";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Market oldindan tanlangan holda ochish (market sahifasidagi «Telegram guruhi» kartasi). */
  marketId?: string;
}

/**
 * «Bildirishnoma qo'shish» — market guruhini bir martalik havola bilan ulash (Trello 6jXw0DDr, 4TfLyTrL).
 *
 * Oqim: market + xabar turi → «Ulash havolasini olish» (`POST /telegram/link-code`, `purpose: "market_group"`)
 * → QR + «Telegram'da ochish» (`t.me/<bot>?startgroup=<kod>`, 10 daqiqa, bir marta). Foydalanuvchi guruhni
 * tanlaydi, bot guruhga qo'shilib uni o'zi ulaydi. Oyna shu paytda har 4 soniyada `GET /notifications
 * ?market_id&group_type` ni so'raydi: qator paydo bo'lsa — oyna yopiladi, «Guruh ulandi».
 *
 * Mavjud (market, tur) ulanishini bot HECH QACHON almashtirmaydi — bunday holatda havola berilmaydi,
 * foydalanuvchiga ro'yxatda tahrirlash yoki o'chirish aytiladi. Qo'lda «Telegram guruh ID» maydoni va
 * `VITE_TELEGRAM_NOTIFICATION_BOT_USERNAME` endi kerak emas (maketdagi qo'lda oqim o'rniga — kartadagi qaror).
 */
const CreateGroupLinkDialog = ({ open, onClose, marketId: initialMarketId }: NotificationFormModalProps) => {
  const { t } = useTranslation("notificationGroups");
  const queryClient = useQueryClient();
  const { options, getName, isLoading: marketsLoading } = useNotificationMarkets(open);
  const requestLink = useRequestGroupLink();

  const [marketId, setMarketId] = useState<string | null>(initialMarketId ?? null);
  const [groupType, setGroupType] = useState<NotificationGroupType>("create");
  const [marketMissing, setMarketMissing] = useState(false);
  const [link, setLink] = useState<GroupLinkCode | null>(null);
  const [expiredLink, setExpiredLink] = useState<GroupLinkCode | null>(null);
  const marketRef = useRef<HTMLElement>(null);
  /** Tanlov almashsa, kechikkan javob eski (market, tur) havolasini ko'rsatmasin. */
  const requestSeq = useRef(0);

  // Tanlangan (market, tur) uchun ulanish: havoladan oldin — «allaqachon ulangan» tekshiruvi,
  // havoladan keyin — ulanishni kutish (har 4 s, oyna fonda bo'lsa ham).
  const linkQuery = useNotifications(
    { market_id: marketId ?? undefined, group_type: groupType, page: 1, limit: 1 },
    {
      enabled: open && Boolean(marketId),
      refetchInterval: open && link ? GROUP_LINK_POLL_MS : false,
      refetchIntervalInBackground: true,
    },
  );
  const connection = marketId
    ? (linkQuery.data?.data.find((row) => row.market_id === marketId && row.group_type === groupType) ?? null)
    : null;
  const checking = Boolean(marketId) && linkQuery.isLoading;
  const expired = link !== null && expiredLink === link;
  const marketName = marketId ? (getName(marketId) ?? `#${marketId}`) : "";

  // Havola muddati tugadi — «Yangi havola olish».
  useEffect(() => {
    if (!link) return;
    const left = Date.parse(link.expires_at) - Date.now();
    if (!Number.isFinite(left)) return;
    const timer = window.setTimeout(() => setExpiredLink(link), Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [link]);

  // Havola olingach qator paydo bo'ldi — bot guruhni uladi.
  const connected = Boolean(open && link && connection);
  const announceConnected = useEffectEvent(() => {
    notify.success(t("create.connected"), {
      description: t("create.connectedDescription", {
        market: marketName,
        type: t(groupType === "create" ? "form.typeCreate" : "form.typeCancel"),
      }),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    onClose();
  });
  useEffect(() => {
    if (connected) announceConnected();
  }, [connected]);

  const clearLink = () => {
    requestSeq.current += 1;
    setLink(null);
    requestLink.reset();
  };

  const handleMarketChange = (value: string | null) => {
    setMarketId(value);
    if (value) setMarketMissing(false);
    clearLink();
  };

  const handleTypeChange = (value: NotificationGroupType) => {
    setGroupType(value);
    clearLink();
  };

  const handleRequestLink = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!marketId) {
      setMarketMissing(true);
      marketRef.current?.focus();
      return;
    }
    if (connection || requestLink.isPending) return;
    const seq = ++requestSeq.current;
    try {
      const next = await requestLink.mutateAsync({ purpose: "market_group", group_type: groupType, market_id: marketId });
      if (seq === requestSeq.current) setLink(next);
    } catch (error) {
      if (seq !== requestSeq.current) return;
      notify.error(t("create.linkError"), { description: getApiErrorMessage(error) || undefined });
    }
  };

  const activeLink = link && !expired ? link : null;

  const primaryAction = activeLink ? (
    activeLink.deep_link ? (
      <a
        href={activeLink.deep_link}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses({ variant: "primary", className: "flex-[999_1_200px]" })}
      >
        <ExternalLink size={18} aria-hidden="true" className="shrink-0" />
        {t("create.open")}
      </a>
    ) : null
  ) : (
    <Button
      type="submit"
      variant="primary"
      leftIcon={expired ? RefreshCw : Link2}
      loading={requestLink.isPending}
      loadingText={t("create.gettingLink")}
      disabled={Boolean(connection) || checking}
      className="flex-[999_1_200px]"
    >
      {expired ? t("create.newLink") : t("create.getLink")}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={Bell}
      title={t("create.title")}
      busy={requestLink.isPending}
      onSubmit={(event) => void handleRequestLink(event)}
      formProps={{ noValidate: true }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="flex-[1_1_120px]">
            {t("form.cancel")}
          </Button>
          {primaryAction}
        </>
      }
    >
      <NoticeAlert tone="info" role="note" title={t("create.introTitle")}>
        {t("create.intro")}
      </NoticeAlert>

      <Field
        label={t("form.market")}
        labelAs="span"
        required
        error={marketMissing ? t("form.errors.market") : undefined}
      >
        <Select
          ref={marketRef}
          searchable
          icon={Store}
          options={options}
          value={marketId}
          onChange={(value) => handleMarketChange(value)}
          placeholder={t("form.marketPlaceholder")}
          listLabel={t("form.marketList")}
          loading={marketsLoading}
          loadingText={t("form.marketsLoading")}
          noOptionsText={t("form.marketsEmpty")}
        />
      </Field>

      <Field label={t("form.type")} labelAs="span" required hint={t("form.typeHint")}>
        <GroupTypeChoice name="notification-create-type" value={groupType} onChange={handleTypeChange} />
      </Field>

      {connection && !link ? (
        <NoticeAlert tone="warning" role="alert" title={t("create.existsTitle")}>
          {t("create.exists", { market: marketName, groupId: connection.group_id })}
        </NoticeAlert>
      ) : null}

      {link && expired ? (
        <NoticeAlert tone="warning" role="alert" title={t("create.expired")}>
          {t("create.expiredHint")}
        </NoticeAlert>
      ) : null}

      {activeLink ? (
        <section
          aria-label={t("create.linkTitle")}
          className="flex min-w-0 items-start gap-4 rounded-xl bg-sunken p-4 max-md:flex-col max-md:items-center"
        >
          {activeLink.deep_link ? (
            // Telefonda havola tugmasi asosiy yo'l — QR qadamlardan keyin (boshqa qurilmadan skanerlash uchun).
            <GroupLinkQr value={activeLink.deep_link} alt={t("create.qrAlt")} className="max-md:order-last" />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3 max-md:self-stretch">
            <h3 className="text-sm font-semibold text-text">{t("create.linkTitle")}</h3>
            {activeLink.deep_link ? (
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-text-muted">
                <li>{t("create.step1")}</li>
                <li>{t("create.step2")}</li>
                <li>{t("create.step3")}</li>
              </ol>
            ) : (
              <div className="flex flex-col gap-1.5 text-[13px] text-text-muted">
                <p>{t("create.command")}</p>
                <code className="rounded-lg bg-surface px-3 py-2 font-mono text-sm break-all text-text select-all">
                  {activeLink.command}
                </code>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
              <Clock size={16} aria-hidden="true" className="shrink-0" />
              {t("create.expiresAt", { time: formatTimeLocalized(activeLink.expires_at) })}
            </p>
            <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-text">
              <Spinner size="sm" />
              {t("create.waiting")}
            </p>
          </div>
        </section>
      ) : null}
    </Dialog>
  );
};

/**
 * Har ochilishda holat yangidan (market, tur, havola) — ichki oyna har ochilishda qayta o'rnatiladi;
 * yopilish harakati paytida esa eski holat ko'rinib turadi.
 */
const NotificationFormModal = ({ open, onClose, marketId }: NotificationFormModalProps) => {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((value) => value + 1);
  }

  return <CreateGroupLinkDialog key={session} open={open} onClose={onClose} marketId={marketId} />;
};

export default NotificationFormModal;
