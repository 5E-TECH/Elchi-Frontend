import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AI_ADVISOR_ERROR_CODES,
  explainAdvisorAlert,
  readAdvisorError,
  updateAdvisorAlert,
  type AiAdvisorAlertDetail,
  type AiAdvisorExplainResult,
} from "../../../entities/ai-advisor";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * Ogohlantirish amallari (FAQAT superadmin; pul amali yo'q):
 *   «Hal qilindi»  `PATCH ai/advisor/alerts/:id {status: "resolved", note}` — izoh 3–500 (UI oldin tekshiradi);
 *   «Ahamiyatsiz»  `PATCH … {status: "dismissed", note?}` — izoh ixtiyoriy (bo'sh — yuborilmaydi);
 *   «AI izohini olish» `POST …/explain {}` → 202 `pending` (poll) yoki tayyor `ready`.
 *
 * Kesh (plan §3): PATCH javobi — yangilangan tafsilot → `alert(id)` ga yoziladi, `overview` (nishon, banner) va
 * ro'yxatlar (sanoq ham) eskiradi. 409 `ALERT_CLOSED` (boshqa superadmin yopgan) — tafsilot qayta o'qiladi, ro'yxat
 * va nishon ham. Explain 202 — tafsilotga birlashtiriladi (`pending` → `useExplanationPoll` poll qiladi);
 * 429/503 holatni o'zgartirmaydi (matn oynada), 409 — tafsilot qayta o'qiladi.
 */

export type ResolveAlertInput = { id: string; note: string };
export type DismissAlertInput = { id: string; note?: string | null };

const isClosedConflict = (error: unknown) => {
  const { status, code } = readAdvisorError(error);
  return status === 409 && (code === null || code === AI_ADVISOR_ERROR_CODES.ALERT_CLOSED);
};

/** Ixtiyoriy izoh: trim, bo'sh — `undefined` (tanaga kirmaydi). */
const optionalNote = (note: string | null | undefined) => {
  const trimmed = note?.trim();
  return trimmed ? trimmed : undefined;
};

const useAlertStatusMutation = <TInput extends { id: string }>(toBody: (input: TInput) => Parameters<typeof updateAdvisorAlert>[1]) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => updateAdvisorAlert(input.id, toBody(input)),
    onSuccess: (detail, input) => {
      queryClient.setQueryData<AiAdvisorAlertDetail>(queryKeys.aiAdvisor.alert(input.id), detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.overview });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alertLists });
    },
    onError: (error, input) => {
      if (!isClosedConflict(error)) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alert(input.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.overview });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alertLists });
    },
  });
};

/** «Hal qilindi» — izoh trim qilinib yuboriladi (3–500 ni UI tekshiradi, server ham — `NOTE_INVALID`). */
export const useResolveAlert = () =>
  useAlertStatusMutation<ResolveAlertInput>(({ note }) => ({ status: "resolved", note: note.trim() }));

/** «Ahamiyatsiz» — tasdiqsiz; izoh ixtiyoriy. */
export const useDismissAlert = () =>
  useAlertStatusMutation<DismissAlertInput>(({ note }) => {
    const trimmed = optionalNote(note);
    return trimmed === undefined ? { status: "dismissed" } : { status: "dismissed", note: trimmed };
  });

/** 202 javobini tafsilotga qo'shadi: `pending` — poll oralig'i; `ready` — matn va vaqt; xato maydonlari tozalanadi. */
export const mergeExplainResult = (detail: AiAdvisorAlertDetail, result: AiAdvisorExplainResult): AiAdvisorAlertDetail => {
  const cleared = { explanation_error: null, explanation_error_scope: null, explanation_retry_at: null } as const;
  if (result.explanation_status === "ready") {
    return {
      ...detail,
      ...cleared,
      explanation_status: "ready",
      explanation_md: result.explanation_md ?? detail.explanation_md,
      explained_at: result.explained_at ?? detail.explained_at,
      explanation_poll_after_ms: null,
    };
  }
  return {
    ...detail,
    ...cleared,
    explanation_status: "pending",
    explanation_poll_after_ms: result.poll_after_ms ?? detail.explanation_poll_after_ms,
  };
};

export const useExplainAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => explainAdvisorAlert(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData<AiAdvisorAlertDetail>(queryKeys.aiAdvisor.alert(id), (prev) =>
        prev ? mergeExplainResult(prev, result) : prev,
      );
    },
    onError: (error, id) => {
      if (isClosedConflict(error)) void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.alert(id) });
    },
  });
};
