import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { getAiAccessMe, getAiConversation, getAiConversations } from "../api/aiAssistantApi";
import type { AiAccessState, AiConversationList, AiLimits } from "./types";

/** Suhbatlar ro'yxati — bir sahifada 50 ta, «Ko'proq» bilan keyingisi (backend chegarasi 1..100). */
export const AI_CONVERSATIONS_PAGE_SIZE = 50;

/** Raqamli ID (backend `^\d{1,19}$`) — boshqasi so'ralmaydi (400 o'rniga «Suhbat topilmadi»). */
export const isConversationId = (value: string | null | undefined): value is string =>
  typeof value === "string" && /^\d{1,19}$/.test(value);

/**
 * Bugungi limit va funksiya holati. Oyna fokusga qaytganda yangilanadi (boshqa tabda savol berilgan, kun almashgan).
 * Xato sahifaning o'zida (`ErrorState`), global xabarsiz.
 */
export const useAiAccessMe = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.aiAssistant.accessMe,
    queryFn: getAiAccessMe,
    enabled,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    meta: { silentError: true },
  });

export const useAiConversations = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useInfiniteQuery({
    queryKey: queryKeys.aiAssistant.conversations,
    queryFn: ({ pageParam }) => getAiConversations({ limit: AI_CONVERSATIONS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last: AiConversationList, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return last.items.length > 0 && loaded < last.total ? loaded : undefined;
    },
    enabled,
    meta: { silentError: true },
  });

export const useAiConversation = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.aiAssistant.conversation(id ?? ""),
    queryFn: () => getAiConversation(id as string),
    enabled: isConversationId(id),
    meta: { silentError: true },
  });

/** `done.limits` → `access/me` keshi (qayta so'ramasdan hisoblagich yangilanadi). */
export const writeAiLimits = (queryClient: QueryClient, limits: AiLimits) => {
  queryClient.setQueryData<AiAccessState>(queryKeys.aiAssistant.accessMe, (prev) =>
    prev
      ? {
          ...prev,
          dailyLimit: limits.dailyLimit,
          usedToday: limits.usedToday,
          remainingToday: limits.remainingToday,
        }
      : prev,
  );
};

/** Savol saqlangandan keyin (javob, xato yoki uzilish — `meta` dan keyin): ro'yxat, suhbat va limit yangilanadi. */
export const invalidateAiAfterQuestion = (
  queryClient: QueryClient,
  conversationId: string | null,
  { accessMe = true }: { accessMe?: boolean } = {},
) => {
  const jobs = [queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.conversations })];
  if (conversationId) {
    jobs.push(queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.conversation(conversationId) }));
  }
  if (accessMe) jobs.push(queryClient.invalidateQueries({ queryKey: queryKeys.aiAssistant.accessMe }));
  return Promise.all(jobs);
};

/**
 * `access/me` ni hozir qayta so'rash (429 / 503 dan keyin). `meta` hook bilan bir xil: `fetchQuery` so'rov sozlamasini
 * shu chaqiruvnikiga almashtiradi — `silentError` siz xato global «Ma'lumotni yuklab bo'lmadi» xabarini chiqarardi.
 */
export const refetchAiAccessMe = (queryClient: QueryClient) =>
  queryClient.fetchQuery({
    queryKey: queryKeys.aiAssistant.accessMe,
    queryFn: getAiAccessMe,
    staleTime: 0,
    meta: { silentError: true },
  });
