// dizayn-v2: superadmin-ai-assistant, superadmin-ai-assistant-empty, superadmin-ai-assistant-answering, superadmin-ai-assistant-limit-reached, superadmin-ai-assistant-unavailable, superadmin-ai-assistant-offline, superadmin-ai-assistant-conversations-sheet, superadmin-ai-assistant-daily-cap
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Compass, History, MessageSquarePlus, Power, RefreshCw } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  QueryBoundary,
  Skeleton,
  SkeletonLines,
} from "../../../shared/ui/primitives";
import { getErrorKind, getErrorStatus, type ErrorKind } from "../../../shared/lib/errorKind";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  isConversationId,
  messageKind,
  useAiAccessMe,
  useAiConversations,
  type AiAccessState,
} from "../../../entities/ai-advisor";
import { turnItemKey, useAiChat, visibleHistory } from "../../../features/ai-chat";
import { useOnline } from "../model/useOnline";
import { AnswerCard, FailedNote, UserBubble } from "./ChatMessages";
import { Composer, type ComposerBlock } from "./Composer";
import { ConversationsCard, ConversationsDialog, type ConversationsState } from "./Conversations";
import { CapAlert, LimitAlert, LimitCard, LimitRow } from "./Limit";
import { PendingReply } from "./PendingTurnView";
import { EmptyChat, SuggestionChips } from "./Suggestions";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  «SUHBAT» PANELI — `/ai-assistant` (F7PWp6cK backend; T2 6gKt64FN maketlari)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Sahifa qobig'i (`../index.tsx`) sarlavha va tablarni chizadi; bu panel — `access/me` holati (`QueryBoundary`) va
 *  suhbat tanasi. Backend maslahatchisi yo'q muhitda DOM avvalgi (faqat suhbat) sahifa bilan bir xil: qobiq ildizida
 *  sarlavha, keyin shu panel. «Ogohlantirishlar» tabida panel o'chirilmaydi — `hidden` (qoralama, jonli SSE oqimi va
 *  fokus mantig'i saqlanadi). «Yangi suhbat» sarlavhada — panel uni barqaror funksiya sifatida qobiqqa beradi
 *  (`onNewChatChange`; holat yuklangach, chiqib ketganda — `null`).
 *
 *  Faqat superadmin (ega qarori 1 — «Kirish huquqi» oynasi yo'q). Maketdan chizilmaydi (backend yo'q): davr segmenti
 *  va davr qatori, «Keshdan» / «Yangilash», «Chuqur tahlil», KPI / jadval / ogohlantirish bloklari (javob —
 *  markdown), «To'lovlarga o'tish», «Foydali / Foydasiz», «Oylik budjet».
 *
 *  Tuzilma (maket): ustun `flex-[1_1_560px]` (suhbat, tavsiyalar, kiritish) + yon ustun `flex-[0_1_320px]`
 *  (suhbatlar, limit; < 1024 yashirin — o'rnida «Suhbatlar N» tugmasi + ingichka limit qatori, ro'yxat — pastki
 *  varaqada). Suhbat — `?conversation=<id>` (birinchi savolda `meta` dan keyin `replace` bilan yoziladi).
 *  Funksiya o'chiq (`feature_disabled` / `ai_disabled`, 503) — «AI yordamchi hozir ishlamayapti», tarix ochiq; izoh
 *  ostida sabab qatori (maket yo'q — eng yaqini `-unavailable`): `feature_disabled` — serverda yoqilmagan,
 *  `ai_disabled` — AI xizmati ulanmagan (kalit yo'q yoki o'chiq). Muhit o'zgaruvchilari nomi ko'rsatilmaydi.
 *  Holat (`access/me`) yuklanmasa — izoh xato turidan (`ErrorState`): server / vaqt chegarasi «internet» deyilmaydi.
 *  Kunlik AI chegarasi (`assistant_usd_cap` | `cap_exceeded`, maket `-daily-cap`) — panel ustida `warning`
 *  ogohlantirish (`CapAlert`), «Yangi suhbat» dan keyin ham; «Ogohlantirishlar ochiq; …» gapi — faqat maslahatchi
 *  backend'i bo'lsa (`advisorAvailable`).
 *
 *  Fokus: savol yuborilganda / to'xtatilganda bosilgan boshqaruv (tugma, tavsiya, «Qayta yuborish») yo'qolsa yoki
 *  o'chsa, fokus `<body>` ga tushmaydi — jonli javobda «To'xtatish» ga, aks holda matn maydoniga o'tadi (sensorli
 *  ekranda maydonga emas — klaviatura ochilib javobni yopmasin).
 */

/** «Yangi suhbat» amali qobiq sarlavhasi uchun (`carry` — yangi suhbat maydoniga o'tadigan matn). */
export type NewChatAction = () => void;

/** Yangi savol ko'rinadigan joyga suriladi (oqim davomida majburan surilmaydi). */
const scrollIntoViewOnMount = (node: HTMLDivElement | null) => {
  node?.scrollIntoView?.({ block: "nearest" });
};

const isDisabledControl = (element: Element) =>
  (element instanceof HTMLButtonElement || element instanceof HTMLTextAreaElement) && element.disabled;

/** Faqat sensorli ekran (telefon, planshet): matn maydoniga dasturiy fokus klaviaturani ochib, javobni yopadi. */
const isTouchOnly = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

/** Maketdagi hisoblagich «0 / 1000» (backend 2000 gacha qabul qiladi — ega savoli 5). */
export const AI_QUESTION_MAX_CHARS = 1000;

const ConversationSkeleton = ({ label }: { label: string }) => (
  <div role="status" aria-label={label} className="flex flex-col gap-4">
    <Skeleton shape="block" height={44} width="64%" className="self-end rounded-[14px]" />
    <div className="flex items-start gap-3">
      <Skeleton shape="circle" width={32} height={32} className="flex-none max-md:hidden" />
      <div className="min-w-0 flex-1">
        <SkeletonLines lines={3} />
      </div>
    </div>
  </div>
);

const useConversationsState = (): ConversationsState => {
  const query = useAiConversations();
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  return {
    items,
    total: Math.max(total, items.length),
    isPending: query.isPending,
    isError: query.isError && !query.data,
    refetch: () => void query.refetch(),
    refetching: query.isRefetching,
    hasMore: Boolean(query.hasNextPage),
    loadMore: () => void query.fetchNextPage(),
    loadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError,
    complete: !query.hasNextPage && (query.data?.pages.length ?? 0) > 1,
  };
};

type AssistantBodyProps = {
  access: AiAccessState;
  onRetryAccess: () => void;
  retryingAccess: boolean;
  onNewChatChange?: (action: NewChatAction | null) => void;
  advisorAvailable: boolean;
};

const AssistantBody = ({ access, onRetryAccess, retryingAccess, onNewChatChange, advisorAvailable }: AssistantBodyProps) => {
  const { t } = useTranslation("aiAdvisor");
  const [searchParams, setSearchParams] = useSearchParams();
  const rawConversation = searchParams.get("conversation");
  const conversationId = isConversationId(rawConversation) ? rawConversation : null;
  const online = useOnline();
  const conversations = useConversationsState();
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const lastFocusRef = useRef<Element | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);

  const setConversation = useCallback(
    (id: string | null, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("conversation", id);
          else next.delete("conversation");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const chat = useAiChat({
    conversationId,
    onConversationStarted: (id) => setConversation(id, true),
    onRestoreDraft: setDraft,
    onFieldError: setFieldError,
  });

  // AI o'chiq — sababi bilan (egasi qaysi sozlamani tekshirishni bilsin).
  const unavailableReason =
    !access.allowed && (access.reason === "feature_disabled" || access.reason === "ai_disabled") ? access.reason : null;
  const unavailable = unavailableReason !== null;
  // Rol yoki ruxsat yo'q (superadmin uchun kutilmaydi — backend sozlamasi o'zgarsa): yozish yopiq, tarix — backend 403.
  const denied = !access.allowed && !unavailable;
  const limitReached = access.allowed && access.remainingToday <= 0;
  // Limit ma'lumoti faqat ma'noli bo'lsa (ruxsat bor yoki AI vaqtincha o'chiq — maket `-unavailable`); ruxsat yo'q
  // (`role_forbidden` → backend `daily_limit: 0`) — «0 / 0 savol, Limit tugadi» yolg'on, hech bir o'lchamda chizilmaydi.
  const showLimit = access.allowed || (unavailable && access.dailyLimit > 0);
  const block: ComposerBlock =
    unavailable || denied ? "off" : !online ? "offline" : limitReached ? "limit" : chat.capped ? "cap" : null;

  /** Tavsiya savoli — darhol yuboriladi (yozilgan matn maydonda qoladi, savol qabul qilinmasa ham ustiga yozilmaydi). */
  const send = (text: string) => {
    if (block || chat.live) return;
    void chat.send(text);
  };

  /** Maydondagi savol — qabul qilinmasa (`busy`, 400, limit) matn maydonga qaytadi. */
  const sendDraft = () => {
    if (block || chat.live || !draft.trim()) return;
    const text = draft;
    setDraft("");
    void chat.send(text, { restoreDraft: true });
  };

  /** «Yangi suhbat»; `carry` — saqlanmagan savol (suhbat to'lgan / topilmadi) yangi suhbatning maydoniga o'tadi. */
  const newChat = (carry = "") => {
    chat.reset();
    setDraft(carry);
    setFieldError(null);
    setConversation(null);
  };

  // Sarlavhadagi «Yangi suhbat» — barqaror funksiya (har chizishda qayta ro'yxatdan o'tmaydi), ichida joriy `newChat`.
  const newChatRef = useRef(newChat);
  useLayoutEffect(() => {
    newChatRef.current = newChat;
  });
  useEffect(() => {
    if (!onNewChatChange) return undefined;
    onNewChatChange(() => newChatRef.current());
    return () => onNewChatChange(null);
  }, [onNewChatChange]);

  const onColumnFocus = (event: FocusEvent<HTMLDivElement>) => {
    // Portal (pastki varaqa) ichidagi fokus — o'zi qaytaradi.
    lastFocusRef.current = columnRef.current?.contains(event.target) ? event.target : null;
  };

  // Fokus qutqaruvi: oxirgi fokusli boshqaruv o'chirildi / o'chdi va fokus `<body>` ga tushdi. Bir marta: qutqarib
  // bo'lmasa (maydon o'chiq, sensorli ekran) eski yozuv unutiladi — keyinroq foydalanuvchi fokusi tortib olinmaydi.
  useLayoutEffect(() => {
    const last = lastFocusRef.current;
    if (!last || (last.isConnected && !isDisabledControl(last))) return;
    lastFocusRef.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && active !== last) return;
    const target = chat.live ? stopRef.current : fieldRef.current;
    if (!target || target.disabled || (target === fieldRef.current && isTouchOnly())) return;
    target.focus({ preventScroll: true });
  });

  const selected = rawConversation !== null;
  const invalidSelection = selected && !conversationId;
  const detail = chat.detail;
  const detailStatus = getErrorStatus(detail.error);
  const notFound = !chat.pending && (invalidSelection || (detail.isError && (detailStatus === 404 || detailStatus === 400)));
  const history = useMemo(() => visibleHistory(detail.data?.messages ?? [], chat.pending), [chat.pending, detail.data]);
  const showLog = (conversationId !== null || chat.pending !== null) && !notFound;
  const showChips = showLog && !chat.live && block === null;

  const notFoundState = (
    <EmptyState
      framed
      icon={Compass}
      title={t("chat.notFoundTitle")}
      description={t("chat.notFoundText")}
      action={
        <Button variant="ghost" leftIcon={MessageSquarePlus} onClick={() => newChat()}>
          {t("newChat")}
        </Button>
      }
    />
  );

  const pending = chat.pending;
  let logBody: ReactNode = null;
  if (showLog) {
    if (!chat.pending && detail.isPending) logBody = <ConversationSkeleton label={t("chat.loading")} />;
    else if (!chat.pending && detail.isError && !detail.data)
      logBody = (
        <ErrorState
          framed
          error={detail.error}
          title={t("chat.loadFailedTitle")}
          onRetry={() => void detail.refetch()}
          retrying={detail.isRefetching}
        />
      );
    else {
      // Bitta kalitli ro'yxat: joriy savol tarixga o'tganda (`messageKey`) o'sha tugunlar qoladi — `role="log"`
      // savol va javobni ikkinchi marta o'qimaydi.
      const items = history.map((message) => {
        const key = chat.messageKey(message.id);
        if (message.role === "user") return <UserBubble key={key} text={message.text} at={message.createdAt} />;
        return messageKind(message) === "answer" ? (
          <AnswerCard key={key} text={message.text} sources={message.sources} at={message.createdAt} />
        ) : (
          <FailedNote key={key} stop={message.stop} at={message.createdAt} />
        );
      });
      if (pending) {
        items.push(
          <UserBubble key={turnItemKey(pending.key, "q")} text={pending.question} at={pending.askedAt} bubbleRef={scrollIntoViewOnMount} />,
          pending.phase === "done" && pending.answer ? (
            <AnswerCard
              key={turnItemKey(pending.key, "a")}
              text={pending.answer.text}
              sources={pending.answer.sources}
              at={pending.answer.at}
            />
          ) : (
            <PendingReply key={turnItemKey(pending.key, "a")} turn={pending} online={online} onRetry={chat.retry} onNewChat={newChat} />
          ),
        );
      }
      logBody = items;
    }
  }

  return (
    <>
      {chat.capCode && !unavailable && !denied ? <CapAlert code={chat.capCode} advisorAvailable={advisorAvailable} /> : null}

      <div className="flex flex-wrap items-start gap-6">
        <div ref={columnRef} onFocusCapture={onColumnFocus} className="flex min-w-0 flex-[1_1_560px] flex-col gap-5">
          <div className="hidden flex-wrap items-center gap-x-4 gap-y-3 max-lg:flex">
            <Button variant="secondary" leftIcon={History} aria-haspopup="dialog" onClick={() => setSheetOpen(true)} className="flex-none">
              {t("conversations.open")}
              {/* Son — ro'yxat kelgandan keyin (yuklanish / xatoda «0» yolg'on bo'lardi; yon kartadagi badge kabi). */}
              {conversations.isPending || conversations.isError ? null : (
                <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted">
                  {formatNumberLocalized(conversations.total)}
                </span>
              )}
            </Button>
            {showLimit ? <LimitRow access={access} /> : null}
          </div>

          {unavailableReason ? (
            <EmptyState
              framed
              icon={Power}
              title={t("unavailable.title")}
              description={
                <>
                  {t("unavailable.text")}
                  <span className="mt-1 block text-xs">{t(`unavailable.reasons.${unavailableReason}`)}</span>
                </>
              }
              action={
                <Button variant="secondary" leftIcon={RefreshCw} loading={retryingAccess} onClick={onRetryAccess}>
                  {t("unavailable.retry")}
                </Button>
              }
            />
          ) : null}

          {denied ? (
            <ErrorState framed kind="forbidden" description={t(`errors.codes.${access.reason ?? "role_forbidden"}`)} />
          ) : null}

          {notFound ? notFoundState : null}

          {showLog ? (
            <div role="log" aria-label={t("chat.logLabel")} aria-live="polite" className="flex flex-col gap-6">
              {logBody}
            </div>
          ) : !notFound && !unavailable && !denied ? (
            <EmptyChat onPick={send} disabled={block !== null} />
          ) : null}

          {limitReached && !unavailable ? <LimitAlert access={access} /> : null}

          {showChips ? <SuggestionChips onPick={send} /> : null}

          <Composer
            value={draft}
            onChange={(value) => {
              setDraft(value);
              if (fieldError) setFieldError(null);
            }}
            onSend={sendDraft}
            onStop={chat.stop}
            live={chat.live}
            block={block}
            error={fieldError}
            maxLength={AI_QUESTION_MAX_CHARS}
            fieldRef={fieldRef}
            stopRef={stopRef}
          />
        </div>

        <aside aria-label={t("conversations.title")} className="flex min-w-0 flex-[0_1_320px] flex-col gap-6 max-lg:hidden">
          <ConversationsCard state={conversations} selectedId={conversationId} />
          {showLimit ? <LimitCard access={access} /> : null}
        </aside>
      </div>

      <ConversationsDialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        state={conversations}
        selectedId={conversationId}
        onNewChat={() => {
          newChat();
          setSheetOpen(false);
        }}
      />
    </>
  );
};

/**
 * access/me yuklanmagandagi izoh: internet matni faqat tarmoq xatosida; server (5xx, 504 gateway) va vaqt chegarasi —
 * `ErrorState` ning o'z izohi; 403 — rol izohi; qolgan 4xx (masalan 429 «Too Many Requests») — xom backend matni emas,
 * sahifaning umumiy izohi.
 */
const accessErrorText = (kind: ErrorKind, t: TFunction<"aiAdvisor">): string | undefined => {
  if (kind === "offline") return t("access.errorText");
  if (kind === "forbidden") return t("errors.codes.role_forbidden");
  if (kind === "generic") return t("access.errorGeneric");
  return undefined;
};

export type ChatPanelProps = {
  /** «Ogohlantirishlar» tabida — panel o'chirilmaydi, faqat yashiriladi (qoralama va jonli oqim saqlanadi). */
  hidden?: boolean;
  /** Tablar chizilganda — `tabpanel` (yoki telefonda `region`) atributlari; faqat suhbat rejimida — yo'q. */
  panelProps?: HTMLAttributes<HTMLDivElement>;
  /** Sarlavhadagi «Yangi suhbat» uchun barqaror amal (holat yuklangach beriladi, chiqib ketganda `null`). */
  onNewChatChange?: (action: NewChatAction | null) => void;
  /** Maslahatchi backend'i bor (overview zondi) — kunlik AI chegarasi matnida «Ogohlantirishlar ochiq; …». */
  advisorAvailable?: boolean;
};

/** «Suhbat» paneli: `access/me` holati (yuklanish / xato) va suhbat tanasi. Sarlavhasiz — uni qobiq chizadi. */
export const ChatPanel = ({ hidden = false, panelProps, onNewChatChange, advisorAvailable = false }: ChatPanelProps) => {
  const { t } = useTranslation("aiAdvisor");
  const access = useAiAccessMe();

  return (
    <div {...panelProps} hidden={hidden} className="flex flex-col gap-6 max-md:gap-4">
      {/* Tana (kunlik AI chegarasi ogohlantirishi + suhbat ustunlari) — bo'limlar orasi sahifadagidek 24 / telefonda 16. */}
      <QueryBoundary
        query={access}
        isEmpty={() => false}
        className="flex flex-col gap-6 max-md:gap-4"
        loadingLabel={t("chat.loading")}
        loading={<SkeletonLines lines={4} />}
        error={(error, retry) => (
          <ErrorState
            framed
            error={error}
            title={t("access.errorTitle")}
            description={accessErrorText(getErrorKind(error), t)}
            onRetry={retry}
            retrying={access.isRefetching}
          />
        )}
      >
        {(data) => (
          <AssistantBody
            access={data}
            onRetryAccess={() => void access.refetch()}
            retryingAccess={access.isRefetching}
            onNewChatChange={onNewChatChange}
            advisorAvailable={advisorAvailable}
          />
        )}
      </QueryBoundary>
    </div>
  );
};
