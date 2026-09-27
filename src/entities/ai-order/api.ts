import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/api";
import { API_ENDPOINTS } from "../../shared/api";
import { ORDER_KEY } from "../order/api/orderApi";
import type {
  AiConfirmRequest,
  AiConfirmResponse,
  AiParseImage,
  AiParseRequest,
  AiParseResponse,
} from "./types";

/**
 * ⚠️ `api` instansida GLOBAL TIMEOUT YO'Q. AI tahlili o'nlab soniya davom
 * etadi, shuning uchun har chaqiruvda ANIQ chegara beriladi (server 60s
 * ceiling + zaxira; Cloudflare ~100s da 524 qaytaradi).
 */
export const AI_REQUEST_TIMEOUT_MS = 90_000;

/** Gateway javobni `{ statusCode, message, data }` ga o'raydi. */
const unwrap = <T>(payload: unknown): T => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const base64ToBlob = (image: AiParseImage) => {
  const binary = atob(image.data_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: image.media_type });
};

/**
 * ⚠️ Rasm MULTIPART bilan ketadi, JSON base64 bilan EMAS: gateway body
 * limiti 100kb, 1568px JPEG esa base64 da 200–500KB — JSON yo'li 413 beradi.
 */
const toParseFormData = ({ text, market_id, images }: AiParseRequest) => {
  const form = new FormData();
  if (text) form.append("text", text);
  if (market_id) form.append("market_id", market_id);
  for (const image of images ?? []) form.append("images", base64ToBlob(image), image.name);
  return form;
};

/**
 * Matn/rasmdan preview oladi — hech narsa yaratmaydi. Operator "Bekor
 * qilish" bosganda `signal` so'rovni to'xtatadi: mutatsiya xato holatiga
 * o'tadi (`isPending=false`), lekin global "tarmoq xatosi" toast'i chiqmaydi.
 */
export const useAiParse = () =>
  useMutation({
    mutationFn: (request: AiParseRequest) =>
      api
        .post(API_ENDPOINTS.ORDERS.AI_PARSE, toParseFormData(request), {
          timeout: AI_REQUEST_TIMEOUT_MS,
          signal: request.signal,
        })
        .then((res) => unwrap<AiParseResponse>(res.data)),
  });

/** Operator tasdiqlagan buyurtmalarni yaratadi — har biriga alohida natija. */
export const useAiConfirm = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (payload: AiConfirmRequest) =>
      api
        .post(API_ENDPOINTS.ORDERS.AI_CONFIRM, payload, { timeout: AI_REQUEST_TIMEOUT_MS })
        .then((res) => unwrap<AiConfirmResponse>(res.data)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [ORDER_KEY], refetchType: "active" }),
        client.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" }),
      ]);
    },
  });
};
