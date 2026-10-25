import { useCallback, useReducer } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { notify } from "../../../shared/lib/notify";
import {
  classifyMergeError,
  districtUsageKey,
  fetchDistrictUsage,
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
  /** Xato oynasidagi «Qayta urinish» (ko'chirilganlar qaytarilgan bo'lsa) — o'sha juftlik bilan yangi so'rov. */
  retry: () => void;
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

  /** So'rov natijasi → oyna holati (har ochilgan oyna o'zi ulanadi; yon ta'sirlar — `start` da bir marta). */
  const track = useCallback((request: Promise<MergeOutcome>) => {
    request.then(
      (outcome) => dispatch({ type: "succeed", outcome }),
      (error: unknown) => {
        const failure = classifyMergeError(error);
        dispatch({ type: "fail", failure });
        // Mashina o'qiydigan sababsiz rad (400/403/404, eski javob) — oyna yopiladi, umumiy xabar (`start`).
        if (failure.kind === "error" && !failure.details) dispatch({ type: "close" });
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

  /** So'rovni yuboradi (holat allaqachon `progress` da). Yon ta'sirlar (ro'yxatni yangilash, xabar) — shu yerda. */
  const start = useCallback(
    (source: MergeDistrict, target: MergeDistrict, startedAt: number) => {
      const request = mergeDistrictRequest(source.id, target.id);
      IN_FLIGHT.set(source.id, { target, startedAt, request });
      request.then(
        () => {
          IN_FLIGHT.delete(source.id);
          refresh();
        },
        (error: unknown) => {
          IN_FLIGHT.delete(source.id);
          const failure = classifyMergeError(error);
          if (failure.kind === "error" && !failure.details) {
            // Sababsiz rad: «qaytarildi» deb da'vo qilinmaydi, server matni ko'rsatilmaydi.
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
    [navigate, refresh, t, track],
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
      start(source, target, startedAt);
    },
    [resume, start, state],
  );

  const retry = useCallback(() => {
    if (state.phase !== "error" || !state.details || state.details.manualFix) return;
    const { source, target } = state;
    const running = IN_FLIGHT.get(source.id);
    if (running) {
      resume(source, running);
      return;
    }
    const startedAt = Date.now();
    dispatch({ type: "retry", at: startedAt });
    start(source, target, startedAt);
  }, [resume, start, state]);

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

  return { state, open, select, submit, retry, close, refresh };
};

/**
 * Manba tumanning tirik sonlari (`GET district/:id/usage`) — «… ko'chadi» (tanlash) va «Ko'chirilayotganlar»
 * (jarayon). Faqat tanlash oynasida so'raladi; jarayonda keshdagi son ko'rsatiladi (ko'chish davomida kamayib
 * bormasin). Xato (503 — servis javob bermadi) — blok chizilmaydi, sonlar taxmin qilinmaydi.
 */
export const useDistrictUsage = (districtId: string | null, fetchEnabled: boolean) =>
  useQuery({
    queryKey: districtUsageKey(districtId ?? ""),
    queryFn: () => fetchDistrictUsage(districtId ?? ""),
    enabled: districtId != null && fetchEnabled,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
