import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  getReceiptErrorCode,
  receiptSettingGroupOf,
  useReceiptSettings,
  useUploadReceipt,
  type ReceiptKind,
} from "../../../../entities/payments";
import { getApiErrorMessage } from "../../../../shared/lib/apiError";
import { PrepareImageError } from "../../../../shared/lib/downscaleImage";
import { notify } from "../../../../shared/lib/notify";

/**
 * Forma ichidagi «Chek rasmi» maydonining holati (QlLf33Ma, 7-bosqich). Maydon formaga bog'liq emas: `CashboxFormPopup`
 * («Kassadan xarajat») va `cashDetail` (HQ'ga «O'tkazma» qabuli) bitta hook'ni ishlatadi.
 *
 *  - Maydon `GET finance/receipt-settings` bo'yicha chiqadi: rasm yoqiq — ko'rinadi va majburiy; o'chiq — maydon yo'q.
 *    Yuklanmoqda — skelet; o'qilmadi — majburiy deb hisoblanadi (TZ «Holatlar»: backend baribir tekshiradi).
 *  - Rasm tanlanishi bilan yuklanadi (kichraytirish + multipart), `receipt_id` formaga shu yerdan olinadi.
 *  - Operatsiya rad etilsa qoralama saqlanadi: takror yuborishda rasm QAYTA YUKLANMAYDI, o'sha `receipt_id` ketadi.
 *  - `applyServerError` — operatsiya javobidagi `RECEIPT_*`: `RECEIPT_REQUIRED` (forma ochiqligida rasm yoqildi) maydonni
 *    ko'rsatadi va sozlamani qayta o'qiydi; `RECEIPT_NOT_FOUND` / 409 — qoralama tozalanadi, rasm qayta so'raladi.
 *  - `receipt_id` idempotentlik barmoq iziga KIRMAYDI — rasm almashsa ham to'lov ikki marta ketmaydi.
 */

export type ReceiptFileIssue = "type" | "size" | "heic" | "decode";
export type ReceiptFieldIssue =
  | "RECEIPT_REQUIRED"
  | "RECEIPT_NOT_FOUND"
  | "RECEIPT_ALREADY_USED"
  | "RECEIPT_NOT_OWNER"
  | "RECEIPT_KIND_MISMATCH";

type DraftState = {
  status: "empty" | "preparing" | "uploading" | "uploaded" | "failed";
  file: File | null;
  /** Fayl nomi (`preview` tayyor bo'lsa ham asl nomi ko'rsatiladi). */
  name: string | null;
  /** Asl hajm (bayt). */
  size: number | null;
  /** Yuboriladigan (kichraytirilgan) hajm. */
  bytes: number | null;
  preview: string | null;
  progress: number;
  receiptId: string | null;
  photoUrl: string | null;
  fileIssue: ReceiptFileIssue | null;
  uploadMessage: string | null;
};

const EMPTY_DRAFT: DraftState = {
  status: "empty",
  file: null,
  name: null,
  size: null,
  bytes: null,
  preview: null,
  progress: 0,
  receiptId: null,
  photoUrl: null,
  fileIssue: null,
  uploadMessage: null,
};

const toFileIssue = (error: unknown): ReceiptFileIssue | null => {
  if (!(error instanceof PrepareImageError)) return null;
  switch (error.code) {
    case "unsupported":
      return "type";
    case "too_large":
    case "over_limit":
      return "size";
    case "heic_unsupported":
      return "heic";
    default:
      return "decode";
  }
};

const subscribeOnline = (notifyChange: () => void) => {
  window.addEventListener("online", notifyChange);
  window.addEventListener("offline", notifyChange);
  return () => {
    window.removeEventListener("online", notifyChange);
    window.removeEventListener("offline", notifyChange);
  };
};
const readOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

export const useReceiptField = ({
  kind,
  active = true,
  prefetch = false,
}: {
  /** `null` — bu operatsiyada chek yo'q (maydon ham, sozlama so'rovi ham). */
  kind: ReceiptKind | null;
  /** Maydon hozir kerakmi (oyna ochiq, «O'tkazma» tanlangan). */
  active?: boolean;
  /** Sozlama `active` dan oldin ham o'qilsin — maydon skeletsiz chiqadi. */
  prefetch?: boolean;
}) => {
  const { t } = useTranslation("payments");
  const enabled = active && kind !== null;
  const settingsQuery = useReceiptSettings(kind !== null && (active || prefetch));
  const upload = useUploadReceipt();
  const online = useSyncExternalStore(subscribeOnline, readOnline, () => true);

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [fieldIssue, setFieldIssue] = useState<ReceiptFieldIssue | null>(null);
  /** Server chek talab qildi (kesh «o'chiq» desa ham maydon chiqadi) — sozlama qayta o'qilguncha ham ko'rinsin. */
  const [serverRequired, setServerRequired] = useState(false);
  /** Yuklashda `RECEIPT_DISABLED`: sozlama o'qilmagan paytda maydon majburiy edi, aslida rasm o'chiq. */
  const [serverDisabled, setServerDisabled] = useState(false);
  /** Oshsa maydon o'zini ko'rinishga surib fokus oladi (xato chiqqanda). */
  const [focusRequest, setFocusRequest] = useState(0);

  /** Kechikkan javob (bekor qilingan yoki almashtirilgan fayl) holatni buzmasin. */
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const uploadAsync = upload.mutateAsync;
  const { refetch: refetchSettings } = settingsQuery;

  const stopAttempt = useCallback(() => {
    attemptRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Sahifadan chiqilsa yuklash to'xtaydi.
  useEffect(() => stopAttempt, [stopAttempt]);

  const group = kind ? settingsQuery.data?.[receiptSettingGroupOf(kind)] : undefined;
  const settingsLoading = enabled && settingsQuery.isLoading;
  const required = serverRequired || (!serverDisabled && (group?.photo_required ?? true));
  const aiEnabled = group ? group.ai_enabled : true;
  const visible = enabled && (settingsLoading || required || draft.status !== "empty");

  const send = useCallback(
    async (file: File) => {
      if (!kind) return;
      stopAttempt();
      const attempt = attemptRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setFieldIssue(null);
      setDraft({ ...EMPTY_DRAFT, status: "preparing", file, name: file.name, size: file.size });
      try {
        const result = await uploadAsync({
          kind,
          file,
          signal: controller.signal,
          onPrepared: (prepared) => {
            if (attempt !== attemptRef.current) return;
            setDraft((current) => ({ ...current, status: "uploading", preview: prepared.preview, bytes: prepared.bytes }));
          },
          onProgress: (percent) => {
            if (attempt !== attemptRef.current) return;
            setDraft((current) => ({ ...current, progress: percent }));
          },
        });
        if (attempt !== attemptRef.current) return;
        setDraft((current) => ({
          ...current,
          status: "uploaded",
          progress: 100,
          receiptId: result.receipt_id,
          photoUrl: result.photo_url,
        }));
      } catch (error) {
        if (attempt !== attemptRef.current) return;
        const fileIssue = toFileIssue(error);
        if (fileIssue) {
          // Rasm yaroqsiz: qayta urinishning foydasi yo'q — tanlash maydoniga qaytiladi, sababi ostida.
          setDraft({ ...EMPTY_DRAFT, name: file.name, size: file.size, fileIssue });
          return;
        }
        if (getReceiptErrorCode(error) === "RECEIPT_DISABLED") {
          // Rasm shu orada o'chirilgan: maydon kerak emas, forma cheksiz yuboriladi.
          setServerDisabled(true);
          setServerRequired(false);
          setDraft(EMPTY_DRAFT);
          void refetchSettings();
          notify.info(t("receipt.errors.RECEIPT_DISABLED"));
          return;
        }
        setDraft((current) => ({
          ...current,
          status: "failed",
          uploadMessage: getApiErrorMessage(error) || null,
        }));
      }
    },
    [kind, refetchSettings, stopAttempt, t, uploadAsync],
  );

  const selectFile = useCallback((file: File) => void send(file), [send]);

  const retry = useCallback(() => {
    if (draft.file) void send(draft.file);
  }, [draft.file, send]);

  /** To'xtatish yoki olib tashlash — bo'sh holat (qoralama serverda 24 soatda o'zi o'chadi). */
  const remove = useCallback(() => {
    stopAttempt();
    setDraft(EMPTY_DRAFT);
    setFieldIssue(null);
  }, [stopAttempt]);

  const reset = useCallback(() => {
    stopAttempt();
    setDraft(EMPTY_DRAFT);
    setFieldIssue(null);
    setServerRequired(false);
    setServerDisabled(false);
  }, [stopAttempt]);

  const focus = useCallback(() => setFocusRequest((current) => current + 1), []);

  /** Yuborishdan oldin: rasm majburiy, lekin yo'q — maydon xatosi, so'rov ketmaydi. */
  const validate = useCallback(() => {
    if (!enabled || !required || draft.receiptId) return true;
    setFieldIssue("RECEIPT_REQUIRED");
    focus();
    return false;
  }, [draft.receiptId, enabled, focus, required]);

  /**
   * Operatsiya javobidagi chek xatosi. `true` — xato shu yerda ko'rsatildi (umumiy xabar kerak emas).
   * Boshqa xatoda qoralama va `receipt_id` joyida qoladi (takror yuborishda rasm qayta yuklanmaydi).
   */
  const applyServerError = useCallback(
    (error: unknown): boolean => {
      const code = getReceiptErrorCode(error);
      if (!code) return false;
      if (code === "RECEIPT_REQUIRED") {
        setServerRequired(true);
        setServerDisabled(false);
        void refetchSettings();
      }
      if (
        code === "RECEIPT_REQUIRED" ||
        code === "RECEIPT_NOT_FOUND" ||
        code === "RECEIPT_ALREADY_USED" ||
        code === "RECEIPT_NOT_OWNER" ||
        code === "RECEIPT_KIND_MISMATCH"
      ) {
        stopAttempt();
        setDraft(EMPTY_DRAFT);
        setFieldIssue(code);
        focus();
        return true;
      }
      // `RECEIPT_NOT_APPLICABLE` va boshqalar: maydonga bog'liq emas — qoralama yuborilmasin.
      stopAttempt();
      setDraft(EMPTY_DRAFT);
      notify.error(t("common:error"), { description: t(`receipt.errors.${code}`) });
      return true;
    },
    [focus, refetchSettings, stopAttempt, t],
  );

  return useMemo(
    () => ({
      visible,
      required,
      aiEnabled,
      settingsLoading,
      online,
      draft,
      fieldIssue,
      focusRequest,
      /** Yuklanmoqda — saqlash tugmasi o'chiq. */
      busy: enabled && (settingsLoading || draft.status === "preparing" || draft.status === "uploading"),
      /** Operatsiya tanasiga ketadigan qoralama. */
      receiptId: enabled ? draft.receiptId : null,
      selectFile,
      retry,
      remove,
      reset,
      validate,
      applyServerError,
    }),
    [
      aiEnabled,
      applyServerError,
      draft,
      enabled,
      fieldIssue,
      focusRequest,
      online,
      remove,
      required,
      reset,
      retry,
      selectFile,
      settingsLoading,
      validate,
      visible,
    ],
  );
};

export type ReceiptFieldController = ReturnType<typeof useReceiptField>;
