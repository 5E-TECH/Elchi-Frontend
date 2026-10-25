// dizayn-v2: superadmin-notifications-create-dialog, superadmin-notifications-create-link-dialog, superadmin-notifications-create-expired-dialog, superadmin-notifications-create-exists-dialog, superadmin-notifications-create-exists-inactive-dialog
import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { Bell, ExternalLink, Link2, RefreshCw, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  GroupTypeChoice,
  inactiveReasonKey,
  NoticeAlert,
  useNotificationMarkets,
  useNotifications,
  type Notification,
  type NotificationGroupType,
} from "../../../entities/notification";
import { isNetworkFailure } from "../../../auth/networkError";
import { queryKeys } from "../../../shared/config/queryKeys";
import { formatTimeLocalized } from "../../../shared/lib/formatDateTime";
import { notify } from "../../../shared/lib/notify";
import { Button, buttonClasses, Dialog, Field, Select, Spinner } from "../../../shared/ui/primitives";
import { useToggleNotificationConfirm } from "../../notification-toggle";
// Havola so'rovi, turlari, kutish oralig'i, muddat hisobi, sanoq va QR — umumiy `features/telegram-link` (TG-A);
// bu feature'da nusxasi yo'q (TOZ-1).
import {
  GROUP_LINK_POLL_MS,
  LinkCountdown,
  LinkQrImage,
  toLinkWindow,
  useRequestGroupLink,
  type GroupLinkCode,
} from "../../telegram-link";

interface NotificationFormModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Olingan havola + mahalliy soat bo'yicha muddati va sanoq uzunligi (`toLinkWindow`: soat farqi yoki `expires_at`
 * yo'qligi). `totalMs` ham saqlanadi — server muddati 10 daqiqadan uzun ko'rinsa (soat ortda) sanoq «10:00» da qotmaydi.
 */
type ActiveGroupLink = GroupLinkCode & ReturnType<typeof toLinkWindow>;

/** «Shu tur ulangan, lekin nofaol» matni — sababga qarab; sabab noma'lum bo'lsa umumiy (`create.existsInactive`). */
const existsInactiveKey = (row: Pick<Notification, "inactive_reason">) => {
  const reason = inactiveReasonKey(row.inactive_reason);
  return reason === "unknown" ? "create.existsInactive" : `create.existsInactiveReason.${reason}`;
};

/**
 * «Bildirishnoma qo'shish» — market guruhini bir martalik havola bilan ulash (Trello 6jXw0DDr, 4TfLyTrL).
 *
 * Oqim: market + xabar turi → «Ulash havolasini olish» (`POST /telegram/link-code`, `purpose: "market_group"`)
 * → QR + «Telegram'da ochish» (`t.me/<bot>?startgroup=<kod>`, 10 daqiqa, bir marta). Foydalanuvchi guruhni
 * tanlaydi, bot guruhga qo'shilib uni o'zi ulaydi. Oyna shu paytda har 4 soniyada `GET /notifications
 * ?market_id&group_type` ni so'raydi: qator paydo bo'lsa — oyna yopiladi, «Guruh ulandi».
 *
 * Mavjud (market, tur) ulanishini bot HECH QACHON almashtirmaydi — bunday holatda havola berilmaydi:
 * - faol ulanish (`*-create-exists-dialog`) — «avval eskisini ro'yxatdan o'chiring», asosiy tugma o'chiq;
 * - nofaol ulanish (`*-create-exists-inactive-dialog`, NG-S3) — asosiy tugma «Faollashtirish»: ochiq oyna
 *   ustida faollashtirish tasdig'i (`features/notification-toggle`, faqat `PATCH {is_active: true}`);
 *   muvaffaqiyatda oyna yopiladi, bekor qilinsa fokus «Faollashtirish» ga qaytadi. Nofaollik sababi
 *   (`inactive_reason`, G085w5Qr — NG-C) bo'yicha matn: bot chiqarilgan — maketdagi «… nofaol — bot guruhdan
 *   chiqarilgan (ID: …)»; boshqa ma'lum sabab — o'z matni; noma'lum — umumiy «xabarlar unga yuborilmayapti».
 *
 * Havola tayyor (`*-create-link-dialog`): QR oq ramkada (desktopda chapda, telefonda qadamlardan keyin),
 * qadamlar, ajratgich ostida teskari sanoq (`LinkCountdown` `inline`, `role="timer"`) va kutish holati. Muddat —
 * «Telegram guruhi» kartasidagidek mahalliy soat bo'yicha (`toLinkWindow`): kompyuter soati farq qilsa havola darhol
 * «eskirgan» bo'lib ochilmaydi, `expires_at` kelmasa — backend muddati (10 daqiqa).
 * Xato — faqat i18n matn (backend `message` ko'rsatilmaydi).
 */
const CreateGroupLinkDialog = ({ open, onClose }: NotificationFormModalProps) => {
  const { t } = useTranslation("notificationGroups");
  const queryClient = useQueryClient();
  const { options, getName, isLoading: marketsLoading } = useNotificationMarkets(open);
  const requestLink = useRequestGroupLink();
  const confirmToggle = useToggleNotificationConfirm();
  const linkTitleId = useId();

  const [marketId, setMarketId] = useState<string | null>(null);
  const [groupType, setGroupType] = useState<NotificationGroupType>("create");
  const [marketMissing, setMarketMissing] = useState(false);
  const [link, setLink] = useState<ActiveGroupLink | null>(null);
  const [expiredLink, setExpiredLink] = useState<ActiveGroupLink | null>(null);
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
    const timer = window.setTimeout(() => setExpiredLink(link), Math.max(0, link.expiresAtMs - Date.now()));
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
      if (seq === requestSeq.current) setLink({ ...next, ...toLinkWindow(next.expires_at) });
    } catch (error) {
      if (seq !== requestSeq.current) return;
      // Javob kelmadi — «Internet aloqasi yo'q» ni interceptor allaqachon ko'rsatgan; ataylab bekor qilingan
      // so'rov — jim. Backend matni foydalanuvchiga chiqmaydi — faqat i18n izoh (403 — bu market uchun ulash yopiq).
      if (axios.isCancel(error) || isNetworkFailure(error)) return;
      const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
      notify.error(t("create.linkError"), {
        description: t(forbidden ? "create.linkErrorForbidden" : "create.linkErrorRetry"),
      });
    }
  };

  // NG-S3: shu tur ulangan, lekin nofaol — ochiq oyna ustida faollashtirish tasdig'i.
  const inactiveConnection = connection && !connection.is_active && !link ? connection : null;
  const handleActivate = async () => {
    if (!inactiveConnection) return;
    const ok = await confirmToggle(inactiveConnection, marketName);
    if (ok) onClose();
  };

  const activeLink = link && !expired ? link : null;

  const primaryAction = inactiveConnection ? (
    <Button
      variant="primary"
      leftIcon={Bell}
      aria-haspopup="dialog"
      onClick={() => void handleActivate()}
      className="flex-[999_1_200px]"
    >
      {t("toggle.activate.confirm")}
    </Button>
  ) : activeLink ? (
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

      {inactiveConnection ? (
        <NoticeAlert tone="warning" role="alert" title={t("create.existsInactiveTitle")}>
          {t(existsInactiveKey(inactiveConnection), { market: marketName, groupId: inactiveConnection.group_id })}
        </NoticeAlert>
      ) : connection && !link ? (
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
          aria-labelledby={linkTitleId}
          className="flex min-w-0 flex-wrap items-start gap-4 rounded-xl bg-sunken p-4"
        >
          {activeLink.deep_link ? (
            // QR oq ramkada (tungi mavzuda ham oq — kamera o'qiydi). Desktopda chapda; telefonda havola tugmasi
            // asosiy yo'l — QR qadamlardan keyin, markazda (boshqa qurilmadan skanerlash uchun).
            <div className="flex shrink-0 max-md:order-last max-md:w-full max-md:justify-center">
              <div className="flex rounded-xl bg-on-nav p-2.5">
                <LinkQrImage value={activeLink.deep_link} alt={t("create.qrAlt")} size={156} rounded={false} />
              </div>
            </div>
          ) : null}
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
            <h3 id={linkTitleId} className="m-0 text-sm font-semibold text-text">
              {t("create.linkTitle")}
            </h3>
            {activeLink.deep_link ? (
              <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-text-muted">
                <li>{t("create.step1")}</li>
                <li>{t("create.step2")}</li>
                <li>{t("create.step3")}</li>
              </ol>
            ) : (
              <div className="flex flex-col gap-1.5 text-[13px] text-text-muted">
                <p className="m-0">{t("create.command")}</p>
                <code className="rounded-lg bg-surface px-3 py-2 font-mono text-sm break-all text-text select-all">
                  {activeLink.command}
                </code>
              </div>
            )}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <LinkCountdown
                variant="inline"
                expiresAtMs={activeLink.expiresAtMs}
                totalMs={activeLink.totalMs}
                untilLabel={t("create.expiresAt", { time: formatTimeLocalized(activeLink.expiresAtMs) })}
              />
              <p role="status" className="m-0 flex items-center gap-2 text-[13px] font-semibold text-text">
                <Spinner size="sm" />
                {t("create.waiting")}
              </p>
            </div>
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
const NotificationFormModal = ({ open, onClose }: NotificationFormModalProps) => {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((value) => value + 1);
  }

  return <CreateGroupLinkDialog key={session} open={open} onClose={onClose} />;
};

export default NotificationFormModal;
