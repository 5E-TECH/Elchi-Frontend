import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNotifications, type NotificationGroupType } from "../../../entities/notification";
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
   * Ulanishni oynada kuzatish (har 4 s `GET /notifications?market_id&group_type`; endpoint faqat superadmin/admin).
   * Qator paydo bo'lsa — oyna yopiladi, «Guruh ulandi». `marketId` siz e'tiborga olinmaydi.
   */
  watch?: boolean;
};

/**
 * Market guruhini bir martalik havola bilan ulash oqimi (TG-B): `start(tur)` — havola so'raladi (tugmada kutish),
 * kelgach `MarketGroupLinkDialog` ochiladi; muddat tugasa — «Havola muddati tugadi» + «Yangi havola olish»;
 * kuzatilsa — guruh ulanganda oyna o'zi yopiladi va `notifications` so'rovlari yangilanadi.
 * Xato matni — faqat i18n (backend matni foydalanuvchiga chiqmaydi); javob kelmasa — interceptor xabari yetarli.
 */
export const useMarketGroupLink = ({ marketId, marketName, watch = false }: UseMarketGroupLinkOptions) => {
  const { t } = useTranslation("telegramLink");
  const queryClient = useQueryClient();
  const request = useRequestGroupLink();
  const [session, setSession] = useState<GroupLinkSession | null>(null);
  const [expiredToken, setExpiredToken] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<NotificationGroupType | null>(null);

  const open = session?.open === true;
  const expired = session != null && expiredToken === session.code.token;
  const watching = watch && Boolean(marketId);

  // Havola muddati tugaganda — «Havola muddati tugadi».
  useEffect(() => {
    if (!open || !session) return;
    const { token } = session.code;
    const timer = window.setTimeout(() => setExpiredToken(token), Math.max(0, session.expiresAtMs - Date.now()));
    return () => window.clearTimeout(timer);
  }, [open, session]);

  // Havola amalda — bot guruhni ulaganini kutish (oyna fonda bo'lsa ham: foydalanuvchi Telegram'da).
  const connectionQuery = useNotifications(
    { market_id: marketId, group_type: session?.groupType, page: 1, limit: 1 },
    {
      enabled: watching && open && !expired,
      refetchInterval: GROUP_LINK_POLL_MS,
      refetchIntervalInBackground: true,
      silentError: true,
    },
  );
  const connected =
    watching &&
    open &&
    session != null &&
    (connectionQuery.data?.data ?? []).some(
      (row) => row.market_id === String(marketId) && row.group_type === session.groupType,
    );

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
    if (request.isPending) return;
    setPendingType(groupType);
    try {
      const code = await request.mutateAsync({
        purpose: "market_group",
        group_type: groupType,
        ...(marketId ? { market_id: marketId } : {}),
      });
      setSession({ open: true, groupType, code, ...toLinkWindow(code.expires_at) });
    } catch (error) {
      // Javob kelmadi — «Internet aloqasi yo'q» ni interceptor ko'rsatgan. 403 — bu hisobga ulash yopiq.
      if (axios.isAxiosError(error) && !error.response && error.code !== "ERR_CANCELED") return;
      const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
      notify.error(t("linkError"), { description: t(forbidden ? "linkErrorForbidden" : "linkErrorRetry") });
    } finally {
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
