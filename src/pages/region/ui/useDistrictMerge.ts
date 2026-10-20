import { useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { notify } from "../../../shared/lib/notify";
import {
  classifyMergeError,
  mergeDistrictRequest,
  mergeReducer,
  MERGE_IDLE,
  type MergeDistrict,
  type MergeState,
} from "../model/districtMerge";

/** «Faoliyat jurnali» (`canViewOps`: admin, superadmin). */
export const ACTIVITY_LOGS_PATH = "/activity-logs";

export type DistrictMergeController = {
  state: MergeState;
  /** Oynani ochadi; `targetId` — oldindan tanlangan maqsad (SATO takroriylari, SA-2). */
  open: (source: MergeDistrict, targetId?: string | null) => void;
  select: (targetId: string | null) => void;
  submit: (target: MergeDistrict) => void;
  close: () => void;
  refresh: () => void;
};

/**
 * Birlashtirish holati va so'rovi (`model/districtMerge.ts` mashinasi ustida). `onRefresh` — tumanlar
 * ro'yxatini qayta olish: natija, xato va «Tumanlarni yangilash» dan keyin chaqiriladi.
 */
export const useDistrictMerge = (onRefresh: () => unknown): DistrictMergeController => {
  const { t } = useTranslation("region");
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(mergeReducer, MERGE_IDLE);

  const refresh = useCallback(() => {
    void onRefresh();
  }, [onRefresh]);

  const submit = useCallback(
    (target: MergeDistrict) => {
      if (state.phase !== "confirm") return;
      const { source } = state;
      if (target.id === source.id || target.regionId !== source.regionId) return;
      dispatch({ type: "submit", target, at: Date.now() });
      mergeDistrictRequest(source.id, target.id).then(
        (outcome) => {
          dispatch({ type: "succeed", outcome });
          refresh();
        },
        (error: unknown) => {
          const failure = classifyMergeError(error);
          dispatch({ type: "fail", failure });
          if (failure.kind === "error") {
            // Xato oynalari (409 / 503 / chala qoldi) backend N1 dan keyin (DM-2) — hozircha umumiy xabar;
            // «qaytarildi» deb da'vo qilinmaydi, server matni ko'rsatilmaydi.
            dispatch({ type: "close" });
            notify.error(t("v2.districts.error.title"), {
              description: t("v2.districts.error.text"),
              action: { label: t("v2.districts.error.journal"), onClick: () => navigate(ACTIVITY_LOGS_PATH) },
            });
            refresh();
          }
        },
      );
    },
    [navigate, refresh, state, t],
  );

  const open = useCallback(
    (source: MergeDistrict, targetId?: string | null) => dispatch({ type: "open", source, targetId }),
    [],
  );
  const select = useCallback((targetId: string | null) => dispatch({ type: "select", targetId }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  return { state, open, select, submit, close, refresh };
};
