import { api } from "../../../shared/api/api";
import { API_ENDPOINTS } from "../../../shared/api";
import {
  normalizeAccessList,
  normalizeAccessState,
  normalizeConversation,
  normalizeConversationList,
} from "../model/normalize";
import type { AiAccessList, AiAccessState, AiAccessUpdate, AiConversation, AiConversationList } from "../model/types";

/** O'z holatim: ruxsat sababi, funksiya yoqilganmi, bugungi limit (`GET ai/assistant/access/me`). */
export const getAiAccessMe = async (): Promise<AiAccessState> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ASSISTANT.ACCESS_ME);
  return normalizeAccessState(data);
};

/** Adminlar ruxsatlari — FAQAT superadmin (`GET ai/assistant/access`). Admin ismi va telefoni — `GET users?role=admin`. */
export const getAiAccessList = async (): Promise<AiAccessList> => {
  const { data } = await api.get(API_ENDPOINTS.AI_ASSISTANT.ACCESS);
  return normalizeAccessList(data);
};

/**
 * Bitta adminga ruxsat berish / olish va kunlik limit — FAQAT superadmin (`PATCH ai/assistant/access`).
 * `daily_limit: null` — sukut. Boshqa rol — 400, foydalanuvchi topilmasa — 404.
 */
export const updateAiAccess = async ({ userId, enabled, dailyLimit }: AiAccessUpdate): Promise<void> => {
  await api.patch(API_ENDPOINTS.AI_ASSISTANT.ACCESS, { user_id: userId, enabled, daily_limit: dailyLimit });
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
