// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-empty, superadmin-ai-assistant-answering, superadmin-ai-assistant-limit-reached, superadmin-ai-assistant-unavailable, superadmin-ai-assistant-offline, superadmin-ai-assistant-tab-select, superadmin-ai-assistant-alerts, superadmin-ai-assistant-alerts-filters-mobile, superadmin-ai-assistant-alert-dialog, superadmin-ai-assistant-alert-dialog-receipt, superadmin-ai-assistant-alert-resolve-confirm
import { lazy, Suspense, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";
import { useAdvisorAvailability } from "../../entities/ai-advisor";
import { Button, Card, PageHeader, SkeletonLines } from "../../shared/ui/primitives";
import { useIsPhone } from "../../shared/ui/primitives/date/useIsPhone";
import { ALERT_ID_PARAM } from "./model/alertFilters";
import { readTab, tabPanelProps, tabSearch, type AiTab } from "./model/tabs";
import { AssistantTabs } from "./ui/AssistantTabs";
import { ChatPanel, type NewChatAction } from "./ui/ChatPanel";

/** Faqat maslahatchi backend'i bor muhitda va «Ogohlantirishlar» ochilganda yuklanadi (faqat suhbatli prod — yo'q). */
const AlertsPanel = lazy(() => import("./ui/alerts/AlertsPanel"));
/** Ogohlantirish oynasi — birinchi `?alert` da yuklanadi, keyin o'rnatilgan qoladi (yopilish harakati). */
const AlertDialog = lazy(() => import("./ui/alerts/AlertDialog"));

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  AI MOLIYAVIY YORDAMCHI — `/ai-assistant` qobig'i (F7PWp6cK suhbat; T2 6gKt64FN; 60PWUbgC ogohlantirishlar)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Faqat superadmin (`canViewAiAdvisor`). Sarlavha + (backend bo'lsa) tablar + panellar.
 *
 *  Mavjudlik (D2): bitta zond — `GET ai/advisor/overview` (`useAdvisorAvailability`, natija keshlanadi). Faqat 2xx va
 *  to'g'ri shakl — `available`; 404/405/501, boshqa shakl, 401/403, tarmoq / 5xx / 429 — `unavailable`. Unda sahifa
 *  avvalgidek FAQAT suhbat: tablar, «Sozlamalar», xato yo'q; `?tab`, `?alert` va filtrlar e'tiborga olinmaydi
 *  (URL'dan o'chirilmaydi ham). Zond kutilayotganda: `?tab=chat` (sukut) — suhbat darhol, tablar keyin chiqadi;
 *  `?tab=alerts` — sarlavha + skelet, suhbat ko'rinmaydi.
 *
 *  Tablar (D1, `AssistantTabs`): «Suhbat · Ogohlantirishlar» (nishon — `overview.alerts.new`); «Hisobotlar»,
 *  «Tavsiyalar», «Sarf» — backend yo'q. URL (D4): `?tab=alerts`; `chat` — sukut, yozilmaydi; tab almashinuvi —
 *  tarixga yoziladi (`push`), «Ogohlantirishlar» dan chiqishda ochiq oyna (`alert`) olinadi, filtrlar qoladi.
 *
 *  Panellar (D5): suhbat doim o'rnatilgan — boshqa tabda `hidden` (qoralama, jonli SSE oqimi, fokus mantig'i
 *  saqlanadi). «Ogohlantirishlar» — `React.lazy`, birinchi kerak bo'lganda. Ogohlantirish oynasi (`?alert=:id`,
 *  `ui/alerts/AlertDialog.tsx`) — faqat «Ogohlantirishlar» tabida, birinchi `?alert` da yuklanadi.
 *
 *  Sarlavha (D12, D13): izoh — tablar bo'lsa `subtitleAdvisor` («…savol va ogohlantirishlar…», maketdagi «hisobot» va
 *  «tavsiyalar» olib tashlangan), aks holda avvalgisi. Amallar: «Suhbat» — «Yangi suhbat» (ghost, MessageSquarePlus;
 *  suhbat holati yuklangach); «Sozlamalar» (qoidalar oynasi) — sozlamalar zondi muvaffaqiyatli bo'lsa (S6).
 */
const AiAssistantPage = () => {
  const { t } = useTranslation("aiAdvisor");
  const [searchParams, setSearchParams] = useSearchParams();
  const isPhone = useIsPhone();
  const availability = useAdvisorAvailability();
  const probe = availability.data;
  const available = probe?.kind === "available";
  const probing = probe === undefined;
  const overview = probe?.kind === "available" ? probe.data : null;

  // Backend yo'q — faqat suhbat (URL'dagi tab e'tiborga olinmaydi).
  const tab: AiTab = available || probing ? readTab(searchParams) : "chat";

  // Oyna birinchi `?alert` da yuklanadi va keyin o'rnatilgan qoladi (yopilish harakati, ma'lumot keshda).
  const alertParam = available && tab === "alerts" ? searchParams.get(ALERT_ID_PARAM) : null;
  const [alertDialogMounted, setAlertDialogMounted] = useState(false);
  if (alertParam !== null && !alertDialogMounted) setAlertDialogMounted(true);

  const [newChat, setNewChat] = useState<NewChatAction | null>(null);
  const registerNewChat = useCallback((action: NewChatAction | null) => setNewChat(() => action), []);

  const selectTab = (next: AiTab) => {
    if (next === tab) return;
    setSearchParams((current) => tabSearch(current, next));
  };

  const panelProps = (value: AiTab) => (available ? tabPanelProps(value, { phone: isPhone, label: t(`tabs.${value}`) }) : undefined);

  const alertsLoading = (
    <Card padding="none" title={t("alerts.list.title")} description={t("alerts.list.description")}>
      <div role="status" aria-label={t("alerts.list.loading")} className="px-5 py-4">
        <SkeletonLines lines={4} />
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={available ? t("subtitleAdvisor") : t("subtitle")}
        actions={
          tab === "chat" && newChat ? (
            <Button variant="ghost" leftIcon={MessageSquarePlus} onClick={() => newChat()}>
              {t("newChat")}
            </Button>
          ) : undefined
        }
      />

      {overview ? <AssistantTabs tab={tab} onChange={selectTab} newAlerts={overview.alerts.new} /> : null}

      <ChatPanel hidden={tab !== "chat"} panelProps={panelProps("chat")} onNewChatChange={registerNewChat} />

      {tab === "alerts" ? (
        available ? (
          <div {...panelProps("alerts")} className="flex min-w-0 flex-col">
            <Suspense fallback={alertsLoading}>
              <AlertsPanel />
            </Suspense>
          </div>
        ) : (
          alertsLoading
        )
      ) : null}

      {available && alertDialogMounted ? (
        <Suspense fallback={null}>
          <AlertDialog active={tab === "alerts"} />
        </Suspense>
      ) : null}
    </div>
  );
};

export default AiAssistantPage;
