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
  type MergeOutcome,
  type MergeState,
} from "../model/districtMerge";

/** «Faoliyat jurnali» (`canViewOps`: admin, superadmin). */
export const ACTIVITY_LOGS_PATH = "/activity-logs";

type InFlightMerge = { target: MergeDistrict; startedAt: number; request: Promise<MergeOutcome> };

/**
 * Ketayotgan birlashtirishlar (manba id → so'rov). Sahifadan tashqarida: jarayonda «Orqaga» bosilib sahifa
 * yopilsa ham so'rov davom etadi — qaytib kelgan foydalanuvchi shu manbani ochsa, ikkinchi POST ketmaydi,
 * jarayon oynasi o'sha so'rovga ulanadi (backend `mergeDistricts` da qulf yo'q).
 */
const IN_FLIGHT = new Map<string, InFlightMerge>();

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

  /** So'rov natijasi → oyna holati (har ochilgan oyna o'zi ulanadi; yon ta'sirlar — `submit` da bir marta). */
  const track = useCallback((request: Promise<MergeOutcome>) => {
    request.then(
      (outcome) => dispatch({ type: "succeed", outcome }),
      (error: unknown) => {
        const failure = classifyMergeError(error);
        dispatch({ type: "fail", failure });
        // Xato oynalari (409 / 503 / chala qoldi) backend N1 dan keyin (DM-2) — hozircha umumiy xabar.
        if (failure.kind === "error") dispatch({ type: "close" });
      },
    );
  }, []);

  const resume = useCallback(
    (source: MergeDistrict, running: InFlightMerge) => {
      dispatch({ type: "resume", source, target: running.target, startedAt: running.startedAt });
      track(running.request);
    },
    [track],
  );

  const submit = useCallback(
    (target: MergeDistrict) => {
      if (state.phase !== "confirm") return;
      const { source } = state;
      if (target.id === source.id || target.regionId !== source.regionId) return;
      const running = IN_FLIGHT.get(source.id);
      if (running) {
        resume(source, running);
        return;
      }
      const startedAt = Date.now();
      dispatch({ type: "submit", target, at: startedAt });
      const request = mergeDistrictRequest(source.id, target.id);
      IN_FLIGHT.set(source.id, { target, startedAt, request });
      request.then(
        () => {
          IN_FLIGHT.delete(source.id);
          refresh();
        },
        (error: unknown) => {
          IN_FLIGHT.delete(source.id);
          if (classifyMergeError(error).kind === "error") {
            // «Qaytarildi» deb da'vo qilinmaydi, server matni ko'rsatilmaydi.
            notify.error(t("v2.districts.error.title"), {
              description: t("v2.districts.error.text", { from: source.name }),
              action: { label: t("v2.districts.error.journal"), onClick: () => navigate(ACTIVITY_LOGS_PATH) },
            });
          }
          refresh();
        },
      );
      track(request);
    },
    [navigate, refresh, resume, state, t, track],
  );

  const open = useCallback(
    (source: MergeDistrict, targetId?: string | null) => {
      const running = IN_FLIGHT.get(source.id);
      if (running) resume(source, running);
      else dispatch({ type: "open", source, targetId });
    },
    [resume],
  );
  const select = useCallback((targetId: string | null) => dispatch({ type: "select", targetId }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  return { state, open, select, submit, close, refresh };
};
