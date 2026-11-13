import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  normalizeAccessState,
  normalizeConversation,
  normalizeConversationList,
} from "../model/normalize";
import type { AiAccessState, AiConversation, AiConversationList } from "../model/types";

/** O'z holatim: ruxsat sababi, funksiya yoqilganmi, bugungi limit (`GET ai/assistant/access/me`). */
export const getAiAccessMe = async (): Promise<AiAccessState> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ASSISTANT.ACCESS_ME);
  return normalizeAccessState(data);
};

/** O'z suhbatlarim, yangisi birinchi (`GET ai/assistant/conversations`, `limit` 1..100). */
export const getAiConversations = async (params: { limit: number; offset: number }): Promise<AiConversationList> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ASSISTANT.CONVERSATIONS, { params });
  return normalizeConversationList(data);
};

/** Suhbat xabarlari (`GET ai/assistant/conversations/:id`; begona/yo'q — 404, ID raqam emas — 400). */
export const getAiConversation = async (id: string): Promise<AiConversation> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ASSISTANT.CONVERSATION(id));
  const conversation = normalizeConversation(data);
  if (!conversation) throw new Error("AI suhbat javobi noto'g'ri");
  return conversation;
};
