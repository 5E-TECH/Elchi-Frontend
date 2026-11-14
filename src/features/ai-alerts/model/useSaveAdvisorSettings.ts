import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AI_ADVISOR_ERROR_CODES,
  readAdvisorError,
  updateAdvisorSettings,
  type AdvisorSettingsState,
  type AiAdvisorSettingsPatch,
} from "../../../entities/ai-advisor";
import { queryKeys } from "../../../shared/config/queryKeys";

/**
 * Qoidalar sozlamasini saqlash — `PATCH ai/advisor/settings {version, rules}` (hammasi yoki hech narsa). Tana faqat
 * `version` va o'zgargan `rules.<R>.{enabled | chegara}`: `severity` (Q1, 400), `telegram`, `budget`, `schedule`
 * (hozircha 400) — tipda ham yo'q.
 *
 * Javob — to'liq sozlamalar: zond keshiga `available` qilib yoziladi (qayta GET kerak emas). 409
 * `SETTINGS_CONFLICT` (boshqa oynada o'zgargan) — sozlamalar qayta o'qiladi, oyna yangi `version` bilan ishlaydi.
 */
export const useSaveAdvisorSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AiAdvisorSettingsPatch) => updateAdvisorSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData<AdvisorSettingsState>(queryKeys.aiAdvisor.settings, { kind: "available", data: settings });
    },
    onError: (error) => {
      const { status, code } = readAdvisorError(error);
      if (status === 409 && (code === null || code === AI_ADVISOR_ERROR_CODES.SETTINGS_CONFLICT)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.aiAdvisor.settings });
      }
    },
  });
};
