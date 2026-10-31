import { useEffect, useRef, useState, type RefObject } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useMyTelegramGroups,
  useNotifications,
  type NotificationGroupType,
  type NotificationParams,
} from "../../../entities/notification";
import { isNetworkFailure } from "../../../auth/networkError";
import { queryKeys } from "../../../shared/config/queryKeys";
import { notify } from "../../../shared/lib/notify";
import { useRequestGroupLink } from "../api/useTelegramLink";
import { GROUP_LINK_POLL_MS, toLinkWindow } from "../lib/linkTime";
import type { GroupLinkCode } from "../model/types";
import { MarketGroupLinkDialog } from "./MarketGroupLinkDialog";

type GroupLinkSession = {
  open: boolean;
  groupType: NotificationGroupType;
  code: GroupLinkCode;
  /** Sessiya boshlangan lahza: kuzatuv faqat shundan keyin olingan javobga ishonadi (keshdagi eski qator emas). */
  openedAt: number;
  expiresAtMs: number;
  totalMs: number;
};

export type UseMarketGroupLinkOptions = {
  /**
   * Superadmin/admin — tanlangan market id (`market_id` majburiy). Market o'zi — berilmaydi: server o'z marketini
   * yechadi (`POST /telegram/link-code`).
   */
  marketId?: string;
  /** Oyna sarlavhasi ostida ko'rinadigan market nomi. */
  marketName: string;
  /**
   * Ulanishni oynada kuzatish (oyna ochiq va havola amalda ekan har 4 s): `marketId` bilan (superadmin/admin) —
   * `GET /notifications?market_id&group_type`, faol qator paydo bo'lsa; `marketId` siz (market o'zi, TG-C) —
   * `GET /notifications/me/telegram-groups`, shu tur ulangan va faol bo'lsa (BOT-3 #6: nofaol guruhni «Qayta ulash» —
   * qator allaqachon bor, faqat faollashganini kutadi). Ikkalasida oyna o'zi yopiladi, «Guruh ulandi».
   */
  watch?: boolean;
  /**
   * Oyna yopilgach fokus qaytadigan joy (tur bo'yicha). Kuzatuvda «Ulash» guruh ulangach yo'qoladi — fokus `<body>`
   * ga tushmasligi uchun o'sha tur qatori beriladi. Berilmasa — oynani ochgan tugmaga.
   */
  returnFocusRefs?: Partial<Record<NotificationGroupType, RefObject<HTMLElement | null>>>;
};

/**
 * Market guruhini bir martalik havola bilan ulash oqimi (TG-B): `start(tur)` — havola so'raladi (tugmada kutish),
 * kelgach `MarketGroupLinkDialog` ochiladi; muddat tugasa — «Havola muddati tugadi» + «Yangi havola olish» (kuzatuv
 * to'xtaydi); kuzatilsa — guruh ulanganda oyna o'zi yopiladi, «Guruh ulandi» va `notifications` so'rovlari (market
 * o'z holati ham — `notifications.all` ostida) yangilanadi. Oyna yopilsa kuzatuv to'xtaydi.
 * Xato matni — faqat i18n (backend matni foydalanuvchiga chiqmaydi); javob kelmasa — interceptor xabari yetarli.
 */
export const useMarketGroupLink = ({
  marketId,
  marketName,
  watch = false,
  returnFocusRefs,
}: UseMarketGroupLinkOptions) => {
  const { t } = useTranslation("telegramLink");
  const queryClient = useQueryClient();
  const request = useRequestGroupLink();
  const [session, setSession] = useState<GroupLinkSession | null>(null);
  const [expiredToken, setExpiredToken] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<NotificationGroupType | null>(null);
  // Bir xil «tick» dagi ikki bosish ikki havola so'ramasin (`isPending` render yopilmasida hali `false`).
  const starting = useRef(false);

  const open = session?.open === true;
  const expired = session != null && expiredToken === session.code.token;
  const watchingStaff = watch && Boolean(marketId);
  const watchingSelf = watch && !marketId;
  const watching = watchingStaff || watchingSelf;

  // Havola muddati tugaganda — «Havola muddati tugadi».
  useEffect(() => {
    if (!open || !session) return;
    const { token } = session.code;
    const timer = window.setTimeout(() => setExpiredToken(token), Math.max(0, session.expiresAtMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [open, session]);

  // Havola amalda — bot guruhni ulaganini kutish (oyna fonda bo'lsa ham: foydalanuvchi Telegram'da).
  const watchParams = (groupType: NotificationGroupType | undefined): NotificationParams => ({
    market_id: marketId,
    group_type: groupType,
    page: 1,
    limit: 1,
  });
  const polling = open && !expired;
  const pollOptions = { refetchInterval: GROUP_LINK_POLL_MS, refetchIntervalInBackground: true, silentError: true };
  const connectionQuery = useNotifications(watchParams(session?.groupType), {
    ...pollOptions,
    enabled: watchingStaff && polling,
  });
  // Market o'zi — kartadagi holat so'rovi bilan bir kalit: oyna ochiq paytda u ham shu oraliqda yangilanadi.
  const myGroupsQuery = useMyTelegramGroups({ ...pollOptions, enabled: watchingSelf && polling });
  const watchedQuery = watchingSelf ? myGroupsQuery : connectionQuery;
  const connected =
    watching &&
    open &&
    session != null &&
    // Kesh (oldingi sessiya, «Bildirishnomalar» oynasi, karta — xuddi shu kalit) eski javobni darhol qaytaradi: faqat
    // shu sessiyada olingan javob hisoblanadi.
    watchedQuery.dataUpdatedAt >= session.openedAt &&
    (watchingSelf
      ? (myGroupsQuery.data ?? []).some((row) => row.group_type === session.groupType && row.linked && row.is_active)
      : (connectionQuery.data?.data ?? []).some(
          (row) => row.market_id === String(marketId) && row.group_type === session.groupType && row.is_active,
        ));

  // Guruh paydo bo'ldi — oyna yopiladi (holat render paytida moslanadi), xabar va yangilash — effektda bir marta.
  const [notice, setNotice] = useState<{ seq: number; groupType: NotificationGroupType } | null>(null);
  const shownNotice = useRef(0);
  if (connected && session) {
    setSession({ ...session, open: false });
    setNotice({ seq: (notice?.seq ?? 0) + 1, groupType: session.groupType });
  }

  useEffect(() => {
    if (!notice || notice.seq <= shownNotice.current) return;
    shownNotice.current = notice.seq;
    notify.success(t("group.connected"), {
      description: t("group.connectedText", {
        market: marketName,
        type: t(notice.groupType === "cancel" ? "group.typeCancel" : "group.typeCreate"),
      }),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  }, [notice, marketName, queryClient, t]);

  const start = async (groupType: NotificationGroupType) => {
    if (starting.current || request.isPending) return;
    starting.current = true;
    setPendingType(groupType);
    try {
      const code = await request.mutateAsync({
        purpose: "market_group",
        group_type: groupType,
        ...(marketId ? { market_id: marketId } : {}),
      });
      if (watchingStaff) {
        queryClient.removeQueries({ queryKey: queryKeys.notifications.list(watchParams(groupType)), exact: true });
      }
      setSession({ open: true, groupType, code, openedAt: Date.now(), ...toLinkWindow(code.expires_at) });
    } catch (error) {
      // Javob kelmadi — «Internet aloqasi yo'q» ni interceptor ko'rsatgan; ataylab bekor qilingan so'rov — jim
      // (bildirishnoma qo'shish oynasi bilan bir xil, TOZ-1). 403 — bu hisobga ulash yopiq.
      if (axios.isCancel(error) || isNetworkFailure(error)) return;
      const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
      notify.error(t("linkError"), { description: t(forbidden ? "linkErrorForbidden" : "linkErrorRetry") });
    } finally {
      starting.current = false;
      setPendingType(null);
    }
  };

  const close = () => {
    setSession((current) => (current ? { ...current, open: false } : current));
    // Yopish oldidan ulangan bo'lishi mumkin — karta holati darhol yangilansin.
    if (watching) void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  };

  const dialog = session ? (
    <MarketGroupLinkDialog
      open={open}
      code={session.code}
      marketName={marketName}
      groupType={session.groupType}
      expiresAtMs={session.expiresAtMs}
      totalMs={session.totalMs}
      expired={expired}
      renewing={request.isPending}
      watching={watching}
      returnFocus={returnFocusRefs?.[session.groupType]}
      onRenew={() => void start(session.groupType)}
      onClose={close}
    />
  ) : null;

  return {
    start,
    /** Havolasi so'ralayotgan tur (o'sha qatordagi «Ulash» kutishda). */
    pendingType: request.isPending ? pendingType : null,
    dialog,
  };
};
