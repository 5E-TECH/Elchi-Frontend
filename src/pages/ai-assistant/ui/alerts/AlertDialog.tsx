// dizayn-v2: superadmin-ai-assistant-alert-dialog, superadmin-ai-assistant-alert-dialog-receipt, superadmin-ai-assistant-alert-dialog-courier-debt, superadmin-ai-assistant-alert-dialog-expense, superadmin-ai-assistant-alert-dialog-market-payout, superadmin-ai-assistant-alert-dialog-hq-transfer, superadmin-ai-assistant-alert-dialog-loss, superadmin-ai-assistant-alert-dialog-corrections, superadmin-ai-assistant-alert-resolve-confirm
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleCheck, CircleMinus, SearchX, TriangleAlert } from "lucide-react";
import {
  AI_ADVISOR_LINK_KINDS,
  AlertSeverityBadge,
  AlertStatusBadge,
  alertDialogTitle,
  alertSubline,
  isAlertId,
  isAlertOpen,
  readAdvisorError,
  ruleName,
  type AdvisorTranslate,
  type AiAdvisorAlertDetail,
  type AiAdvisorLink,
} from "../../../../entities/ai-advisor";
import { NoticeAlert } from "../../../../entities/notification/ui/NoticeAlert";
import {
  ExplanationSection,
  ResolutionNote,
  useExplanationPoll,
  useResolutionFlow,
} from "../../../../features/ai-alerts";
import { queryKeys } from "../../../../shared/config/queryKeys";
import { formatDateTimeLocalized } from "../../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  SkeletonLines,
  buttonClasses,
} from "../../../../shared/ui/primitives";
import { useIsPhone } from "../../../../shared/ui/primitives/date/useIsPhone";
import { ALERT_ID_PARAM, isAlertFromList } from "../../model/alertFilters";
import { renderRuleBody } from "./rules";

const LINK_KINDS = new Set<string>(AI_ADVISOR_LINK_KINDS);

/**
 * Epizodli qoidalar (shartnoma §5.1): `first_fact_at` — epizod boshlangan kun 00:00, ya'ni hech narsa bo'lmagan vaqt.
 * Ularning «birinchi / oxirgi» qatori aniqlash vaqtlarini (`first_at` / `last_at`) ko'rsatadi — maket R4
 * «birinchi: 21.10.2026, 09:00 · oxirgi: Kecha, 09:00», ro'yxatdagi «Oxirgi marta» bilan bir xil.
 */
const EPISODE_RULES = new Set<string>(["R2", "R4", "R5"]);

/** Asosiy havola yorlig'i (`aiAdvisor.alerts.links.<kind>`): R3 dagi operatsiya — «Xarajatni ochish»; noma'lum — umumiy. */
const linkLabelKey = (link: AiAdvisorLink, ruleKey: string): string => {
  if (link.kind === "operation" && ruleKey === "R3") return "alerts.links.operationExpense";
  return LINK_KINDS.has(link.kind) ? `alerts.links.${link.kind}` : "alerts.links.other";
};

/** Oyna kengligi — maket 720 px; `Dialog` ning eng kattasi (xl) 640 — sahifa darajasida kengaytiriladi (D6). */
const WIDE = "md:max-w-[720px]";

export type AlertDialogProps = {
  /** «Ogohlantirishlar» tabi ochiq — boshqa tabda `?alert` e'tiborga olinmaydi. */
  active: boolean;
};

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  OGOHLANTIRISH OYNASI — `?alert=:id` (maketlar `superadmin-ai-assistant-alert-dialog` R1, `-courier-debt` R2,
 *  `-expense` R3, `-market-payout` R4, `-hq-transfer` R5, `-loss` R6, `-receipt` R7, `-corrections` R8 — tana
 *  `rules/`; `-alert-resolve-confirm`; noma'lum qoida — umumiy ko'rinish)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Ochish — ro'yxatdagi havola (`push` + `ALERT_FROM_LIST_STATE`); yopish — shu yozuvdan orqaga (`navigate(-1)`), chuqur
 *  havola / jonli xabarda — `alert` olinadi (`replace`). `React.lazy`: birinchi `?alert` da
 *  yuklanadi, keyin o'rnatilgan qoladi (yopilish harakati, ma'lumot keshda).
 *
 *  ⚠️ D16: `GET alerts/:id` ogohlantirishni «Ko'rildi» qiladi — faqat oyna ochiq bo'lsa so'raladi (prefetch / hover yo'q);
 *  har ochilishdagi birinchi muvaffaqiyatli javobdan keyin `overview` (tab nishoni, banner) eskiradi, ro'yxatlar —
 *  oyna yopilgach.
 *
 *  Tuzilma: sarlavha (ikonka — jiddiylik toni, «Qoida · birinchi: … · oxirgi: …» yoki bitta takrorda «Qoida · vaqt») → belgilar (jiddiylik, holat,
 *  «N marta takrorlandi») → qoida tanasi (faktlar, dalillar) → «qaytgan muammo» izohi → AI izohi → izoh maydoni.
 *  Pastda: chapda asosiy havola (`links[].primary`), o'ngda «Ahamiyatsiz» + «Hal qilindi»; telefonda ustma-ust
 *  («Hal qilindi», «Ahamiyatsiz», havola). Yopilgan ogohlantirish (D8) — izoh bloki va faqat «Yopish».
 *  Holatlar: yuklanish — skelet; 404 / noto'g'ri ID — «Ogohlantirish topilmadi» (maket yo'q); xato — «Qayta urinish».
 */
const AlertDialog = ({ active }: AlertDialogProps) => {
  const { t, i18n } = useTranslation("aiAdvisor");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const tt = t as unknown as AdvisorTranslate;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = active ? searchParams.get(ALERT_ID_PARAM) : null;
  const open = raw !== null;

  // Yopilayotganda oxirgi ogohlantirish ko'rinib turadi (harakat tugaguncha).
  const [shownRaw, setShownRaw] = useState(raw);
  if (raw !== null && raw !== shownRaw) setShownRaw(raw);
  const id = isAlertId(shownRaw) ? shownRaw : null;

  const { query, expired, restart } = useExplanationPoll(id, { enabled: open });
  const alert: AiAdvisorAlertDetail | undefined = query.data && query.data.id === id ? query.data : undefined;

  // Yopish: ro'yxatdan ochilgan bo'lsa (`ALERT_FROM_LIST_STATE`, `push`) — tarixda orqaga (ro'yxat yozuvi
  // takrorlanmaydi, «Orqaga» sahifadan chiqadi); chuqur havola / jonli xabar — `alert` olinadi (`replace`).
  // Bir yozuvdan bir marta: Esc va `onDone` ketma-ket kelsa ham ikki qadam orqaga ketilmaydi.
  const location = useLocation();
  const navigate = useNavigate();
  const closedKey = useRef<string | null>(null);
  useEffect(() => {
    // Yangi yozuv (yoki «Oldinga» bilan qaytilgan o'sha yozuv) — yana yopish mumkin.
    closedKey.current = null;
  }, [location.key]);
  const close = useCallback(() => {
    if (closedKey.current === location.key) return;
    closedKey.current = location.key;
    if (isAlertFromList(location.state)) {
      navigate(-1);
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ALERT_ID_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [location.key, location.state, navigate, setSearchParams]);

  // D16: ochilishdan keyingi birinchi javob — nishon va banner darhol yangilanadi (bir marta); ro'yxat — oyna
  // yopilgach (har yo'l: tugma, Esc, «Orqaga», tab almashuvi): `?status=new` da ochilgan qator oyna ortida
  // yo'qolmaydi va fokus o'z havolasiga qaytadi.
  const openedAt = useRef(0);
  const refreshedFor = useRef<string | null>(null);
  const listStale = useRef(false);
  useEffect(() => {
    if (!open || id === null) return;
    openedAt.current = Date.now();
    refreshedFor.current = null;
  }, [open, id]);
  useEffect(() => {
    if (!open || id === null || !query.isSuccess || refreshedFor.current === id) return;
    if (query.dataUpdatedAt < openedAt.current) return;
    refreshedFor.current = id;
    listStale.current = true;
    void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.overview });
  }, [id, open, query.dataUpdatedAt, query.isSuccess, queryClient]);
  useEffect(() => {
    if (open || !listStale.current) return;
    listStale.current = false;
    void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alertLists });
  }, [open, queryClient]);
  useEffect(
    () => () => {
      if (listStale.current) void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alertLists });
    },
    [queryClient],
  );

  const flow = useResolutionFlow({ alert, onDone: close });
  const isPhone = useIsPhone();

  const closeButton = (
    <Button variant="secondary" onClick={close}>
      {t("alerts.dialog.close")}
    </Button>
  );

  // ── Ogohlantirish yo'q: noto'g'ri ID, yuklanish, 404, xato ─────────────────────────────────────────────
  // `QueryBoundary` emas (asosli istisno): holatga qarab oynaning pastki qatori ham o'zgaradi (topilmadi / xato —
  // «Yopish», yuklanish — yo'q), `QueryBoundary` esa faqat tanani almashtiradi. Holat primitivlari o'sha:
  // `EmptyState`, `ErrorState` + «Qayta urinish», `SkeletonLines` — qo'lda yozilgan matn yo'q.
  if (!alert) {
    const notFound =
      id === null || (query.isError && [400, 404].includes(readAdvisorError(query.error).status ?? 0));
    const body = notFound ? (
      <EmptyState icon={SearchX} title={t("alerts.dialog.notFoundTitle")} description={t("alerts.dialog.notFoundText")} />
    ) : query.isError ? (
      <ErrorState
        error={query.error}
        title={t("alerts.dialog.errorTitle")}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    ) : (
      <div role="status" aria-label={t("alerts.dialog.loading")} className="flex flex-col gap-4">
        <SkeletonLines lines={3} />
        <SkeletonLines lines={4} />
      </div>
    );
    return (
      <Dialog
        open={open}
        onClose={close}
        size="xl"
        className={WIDE}
        title={t("alerts.dialog.label")}
        footer={notFound || query.isError ? closeButton : undefined}
        initialFocus="panel"
      >
        {body}
      </Dialog>
    );
  }

  // ── Ogohlantirish ──────────────────────────────────────────────────────────────────────────────────────
  const openAlert = isAlertOpen(alert.status);
  // Maketlar: takrorlangan ogohlantirish (R1 «3 marta», R4 «2 marta») — «birinchi: … · oxirgi: …» (R1 — fakt
  // vaqtlari; epizodli R2, R4, R5 — aniqlash vaqtlari, `EPISODE_RULES`); bitta takror — aniqlash vaqti (`last_at`:
  // R3 «Kecha, 18:20», R6 «21.10.2026, 08:00»). R6 sarlavhasida joy yo'q — «Zarar · butun tizim» (ro'yxat
  // ost-qatoridagidek).
  const rule = alert.rule_key === "R6" ? alertSubline(alert, tt) : ruleName(alert.rule_key, tt);
  const episodic = EPISODE_RULES.has(alert.rule_key);
  const first = formatDateTimeLocalized(episodic ? alert.first_at : alert.first_fact_at, { language });
  const last = formatDateTimeLocalized(episodic ? alert.last_at : alert.last_fact_at, { language });
  const description =
    alert.occurrences > 1 && first !== last
      ? t("alerts.dialog.times", { rule, first, last })
      : t("alerts.dialog.time", { rule, at: formatDateTimeLocalized(alert.last_at, { language }) });
  const primary = alert.links.find((link) => link.primary) ?? null;

  const primaryLink = primary ? (
    <Link to={primary.href} className={buttonClasses({ variant: "link" })}>
      {t(linkLabelKey(primary, alert.rule_key))}
      <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
    </Link>
  ) : null;
  const dismissButton = (
    <Button variant="secondary" leftIcon={CircleMinus} loading={flow.dismissing} onClick={flow.dismiss}>
      {t("alerts.dialog.dismiss")}
    </Button>
  );
  const resolveButton = (
    <Button leftIcon={CircleCheck} aria-haspopup="dialog" disabled={flow.dismissing} onClick={() => void flow.resolve()}>
      {t("alerts.dialog.resolve")}
    </Button>
  );

  // Maket: desktop — chapda havola, o'ngda «Ahamiyatsiz» + «Hal qilindi»; telefon — ustma-ust «Hal qilindi»,
  // «Ahamiyatsiz», havola (DOM tartibi ko'rinish bilan bir xil — fokus tartibi ham).
  const footer = !openAlert ? (
    closeButton
  ) : isPhone ? (
    <div className="flex w-full flex-col items-stretch gap-2">
      {resolveButton}
      {dismissButton}
      {primaryLink}
    </div>
  ) : (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      {primaryLink}
      <div className="ml-auto flex flex-wrap gap-2">
        {dismissButton}
        {resolveButton}
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      className={WIDE}
      icon={TriangleAlert}
      iconTone={alert.severity === "critical" ? "danger" : "warning"}
      iconShape="circle"
      title={alertDialogTitle(alert, tt, language)}
      description={description}
      footer={footer}
      busy={flow.dismissing}
      initialFocus="panel"
      data-testid="ai-alert-dialog"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-2 gap-y-1.5">
          <AlertSeverityBadge severity={alert.severity} />
          <AlertStatusBadge status={alert.status} />
          {alert.occurrences > 1 ? (
            <Badge>
              {t("alerts.dialog.repeated", {
                count: alert.occurrences,
                value: formatNumberLocalized(alert.occurrences, { language }),
              })}
            </Badge>
          ) : null}
        </div>

        {renderRuleBody(alert)}

        {alert.reopened_from ? (
          <NoticeAlert tone="info" title={t("alerts.dialog.reopenedTitle")}>
            {t("alerts.dialog.reopenedText", { status: t(`alerts.status.${alert.reopened_from.status}`) })}
          </NoticeAlert>
        ) : null}

        <ExplanationSection key={alert.id} alert={alert} expired={expired} onRestart={restart} />

        <ResolutionNote
          alert={alert}
          value={flow.note}
          onChange={flow.setNote}
          error={flow.noteError}
          inputRef={flow.noteRef}
          disabled={flow.dismissing}
        />

        {openAlert && flow.dismissError ? <NoticeAlert tone="danger">{flow.dismissError}</NoticeAlert> : null}
      </div>
    </Dialog>
  );
};

export default AlertDialog;
