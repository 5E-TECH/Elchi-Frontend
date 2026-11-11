import { useCallback, useMemo, useState } from "react";
import {
  evaluateShiftAccountRow,
  prepareShiftPhoto,
  useCashboxCardBalances,
  useShiftCheckSettings,
  useShiftAiTimedOut,
  useShiftReport,
  useUploadShiftAccountPhoto,
  validateShiftPhoto,
  type CloseShiftAccount,
  type ShiftAccountCheck,
  type ShiftAccountRowError,
  type ShiftAiStatus,
  type ShiftCheckCardSettings,
} from "../../../../entities/payments";
import { getApiErrorMessage } from "../../../../shared/lib/apiError";
import { PrepareImageError } from "../../../../shared/lib/downscaleImage";
import { parseOptionalAmountInput } from "../lib/amountInput";

/**
 * Smena yopish oynasidagi «Kartalar va hisob raqamlar» holati (kiZgTybn). Faqat `account_check_enabled` bo'lsa
 * ishlaydi — aks holda `enabled: false` va oyna avvalgidek (naqd + sanalgan karta).
 *
 *  - Kartalar va qoidalar — `GET finance/shift/settings` (`photo_required` / `ai_enabled` hisoblangan);
 *  - kutilgan qoldiq — `GET finance/cashbox/cards` (jonli), bo'lmasa qoralamadagi snapshot;
 *  - qoralama (rasm, AI holati) — `GET finance/shift/:id/report` → `accounts[]`; realtime
 *    `finance.shift.account_checked` `[shift]` so'rovlarini yangilaydi (AI holati jonli o'zgaradi), `pending` da 5 s.
 *  - Sozlama oyna har ochilganda serverdan qayta o'qiladi (`fresh`) — o'qilguncha «Smenani yopish» kutadi
 *    (`settingsLoading`): kesh eskirgan bo'lsa yangi karta yoki yoqilgan kalit oynada ko'rinmay qolardi.
 *  - Rasm tanlanishi bilan brauzerda kichraytiriladi (≤ 5 MB JPEG, `prepareShiftPhoto`) va yuklanadi
 *    (`POST finance/shift/account-photo`), kiritilgan qoldiq bilan birga.
 *  - BE-A: rasm majburiy kartada skrinshot yuklanmaguncha «Smenani yopish» o'chiq — `missingPhotos` (sababi oynada);
 *    AI `pending` hech qachon to'smaydi (backend ~15 s kutadi, keyin baribir yopadi).
 *  - Yopish 400 ««Karta»: … izoh majburiy» (yoki «… rasm majburiy») qaytarsa — `applyCloseError`: kartalar
 *    qoldig'i va qoralamalar qayta o'qiladi (mijozdagi kutilgan qoldiq eskirgan bo'lishi mumkin), o'sha karta
 *    ajratiladi va izoh majburiy bo'ladi (backend shunday dedi — mijoz hisobi farqni ko'rmasa ham).
 *    «Har karta qoldig'ini tasdiqlang: …» yoki «accounts[i]: …» — oynadagi kartalar ro'yxati eskirgan (karta qo'shilgan,
 *    faollashgan yoki o'chirilgan): sozlama, qoldiqlar va qoralamalar qayta o'qiladi, oyna ochiq qoladi.
 */

export type ShiftAccountLocalPhoto = { name: string; size: number; at: Date };

export type ShiftAccountRow = {
  card: ShiftCheckCardSettings;
  draft: ShiftAccountCheck | null;
  enteredInput: string;
  entered: number | null;
  expected: number | null;
  comment: string;
  photoRequired: boolean;
  aiEnabled: boolean;
  hasPhoto: boolean;
  photoUrl: string | null;
  localPhoto: ShiftAccountLocalPhoto | null;
  uploading: boolean;
  photoError: ShiftPhotoIssue | null;
  uploadMessage: string | null;
  aiStatus: ShiftAiStatus;
  aiReadBalance: number | null;
  difference: number | null;
  enteredOk: boolean | null;
  commentRequired: boolean;
  errors: ShiftAccountRowError[];
  /** Yopish 400 da backend ko'rsatgan karta — qator ajratiladi. */
  serverIssue: "comment" | "photo" | null;
  /** AI `pending` kutish muddatidan (3 daqiqa) o'tdi — «AI natijasi kelmadi». */
  aiTimedOut: boolean;
};

type RowInput = { entered?: string; comment?: string };

/** Rasm xatosi: tur, hajm, HEIC o'qilmadi, rasm buzuq (kichraytirishda) yoki yuklash rad etildi. */
export type ShiftPhotoIssue = "type" | "size" | "heic" | "decode" | "upload";

/** Kichraytirish xatosi (`PrepareImageError`) → rasm muammosi; boshqa xato — `null`. BE-B oynasi ham ishlatadi. */
export const toShiftPhotoIssue = (error: unknown): ShiftPhotoIssue | null => {
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

/** Yopish 400 xabari: `«Humo»: farq bor yoki AI natijasi mos emas — izoh majburiy` (backend `${label}: …`). */
export type ShiftCloseServerIssue = { cardName: string; kind: "comment" | "photo" };

export const parseShiftCloseError = (message: string | null | undefined): ShiftCloseServerIssue | null => {
  const match = /«([^»]+)»\s*:\s*(.+)$/u.exec(String(message ?? "").trim());
  if (!match) return null;
  const reason = match[2].toLowerCase();
  if (reason.includes("izoh majburiy")) return { cardName: match[1].trim(), kind: "comment" };
  if (reason.includes("rasm") && reason.includes("majburiy")) return { cardName: match[1].trim(), kind: "photo" };
  return null;
};

/**
 * Yopish 400 xabari oynadagi kartalar ro'yxati eskirganini bildiradimi: «Har karta qoldig'ini tasdiqlang: Asosiy karta,
 * Humo» (karta tushib qolgan — yangi yoki faollashgan karta) yoki «accounts[0]: karta bu smena kassasiga tegishli emas» /
 * «accounts[1]: karta takrorlangan».
 */
export const isShiftCardsOutdatedError = (message: string | null | undefined): boolean => {
  const text = String(message ?? "").trim();
  return /^Har karta qoldig'ini tasdiqlang\s*:/u.test(text) || /^accounts\[\d+\]\s*:/u.test(text);
};

export const useShiftAccountsForm = ({ open, shiftId }: { open: boolean; shiftId?: string | null }) => {
  const settingsQuery = useShiftCheckSettings(open, { fresh: true });
  const enabled = Boolean(settingsQuery.data?.account_check_enabled);
  // Oyna ochilgan paytdagi sozlama vaqti: shundan yangi javob kelguncha (qayta o'qish) «Smenani yopish» kutadi.
  // Keyingi fon yangilanishlari (realtime, 400 dan keyin) tugmani o'chirmaydi.
  const [openSnapshot, setOpenSnapshot] = useState({ open, updatedAt: settingsQuery.dataUpdatedAt });
  if (openSnapshot.open !== open) setOpenSnapshot({ open, updatedAt: settingsQuery.dataUpdatedAt });
  const settingsFresh = settingsQuery.dataUpdatedAt > openSnapshot.updatedAt;
  const balancesQuery = useCashboxCardBalances(open && enabled);
  const reportQuery = useShiftReport(shiftId, { enabled: open && enabled, pollPending: true });
  const upload = useUploadShiftAccountPhoto();
  // AI `pending` 3 daqiqadan oshdi — so'rov to'xtagan, qatorda «AI natijasi kelmadi».
  const aiTimedOut = useShiftAiTimedOut(shiftId, reportQuery.data?.accounts);

  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [photos, setPhotos] = useState<Record<string, ShiftAccountLocalPhoto>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, { kind: ShiftPhotoIssue; message: string | null }>>({});
  /** Backend 400 da ko'rsatgan karta (ajratiladi): `card_id` → sabab. */
  const [serverIssues, setServerIssues] = useState<Record<string, "comment" | "photo">>({});

  const balances = useMemo(
    () => new Map((balancesQuery.data ?? []).map((card) => [card.id, card.balance])),
    [balancesQuery.data],
  );
  const drafts = useMemo(
    () => new Map((reportQuery.data?.accounts ?? []).map((row) => [row.card_id, row])),
    [reportQuery.data],
  );

  const rows: ShiftAccountRow[] = useMemo(
    () =>
      (enabled ? (settingsQuery.data?.cards ?? []) : []).map((card) => {
        const draft = drafts.get(card.card_id) ?? null;
        const input = inputs[card.card_id];
        // Qayta ochilganda qoralamadagi (rasm bilan yuborilgan) qiymat va izoh tiklanadi.
        const enteredInput =
          input?.entered ?? (draft?.entered_balance !== null && draft?.entered_balance !== undefined ? String(Math.round(draft.entered_balance)) : "");
        const entered = parseOptionalAmountInput(enteredInput);
        const expected = balances.get(card.card_id) ?? draft?.expected_balance ?? null;
        const comment = input?.comment ?? draft?.comment ?? "";
        const hasPhoto = Boolean(draft?.has_photo) || Boolean(photos[card.card_id]);
        const aiStatus: ShiftAiStatus = draft?.ai_status ?? (card.ai_enabled ? "not_required" : "disabled");
        const aiReadBalance = draft?.ai_read_balance ?? null;
        const evaluated = evaluateShiftAccountRow({
          entered,
          expected,
          photoRequired: card.photo_required,
          hasPhoto,
          aiStatus,
          aiReadBalance,
          comment,
        });
        const serverIssue = serverIssues[card.card_id] ?? null;
        // Backend izohni majburiy dedi — mijoz hisobi farqni ko'rmasa ham (kutilgan qoldiq yopish paytida o'zgargan).
        const serverComment = serverIssue === "comment";
        const commentRequired = evaluated.commentRequired || serverComment;
        const errors =
          serverComment && !comment.trim() && !evaluated.errors.includes("comment")
            ? [...evaluated.errors, "comment" as const]
            : evaluated.errors;
        const photoError = photoErrors[card.card_id];
        return {
          card,
          draft,
          enteredInput,
          entered,
          expected,
          comment,
          photoRequired: card.photo_required,
          aiEnabled: card.ai_enabled,
          hasPhoto,
          photoUrl: draft?.photo_url ?? null,
          localPhoto: photos[card.card_id] ?? null,
          uploading: Boolean(uploading[card.card_id]),
          photoError: photoError?.kind ?? null,
          uploadMessage: photoError?.message ?? null,
          aiStatus,
          aiReadBalance,
          ...evaluated,
          commentRequired,
          errors,
          serverIssue,
          aiTimedOut: aiStatus === "pending" && aiTimedOut.has(card.card_id),
        };
      }),
    [aiTimedOut, balances, drafts, enabled, inputs, photoErrors, photos, serverIssues, settingsQuery.data, uploading],
  );

  const setRowInput = useCallback((cardId: string, patch: Partial<RowInput>) => {
    setInputs((current) => ({
      ...current,
      [cardId]: { ...current[cardId], ...patch },
    }));
  }, []);

  const uploadPhoto = useCallback(
    async (cardId: string, file: File) => {
      if (!shiftId) return;
      const fail = (kind: ShiftPhotoIssue, message: string | null = null) =>
        setPhotoErrors((current) => ({ ...current, [cardId]: { kind, message } }));
      setPhotoErrors((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });
      setUploading((current) => ({ ...current, [cardId]: true }));
      try {
        // Avval kichraytiriladi (telefon surati 5 MB dan katta bo'ladi), keyin tur / hajm tekshiriladi.
        let photo: File;
        try {
          photo = await prepareShiftPhoto(file);
        } catch (error) {
          fail(toShiftPhotoIssue(error) ?? "decode");
          return;
        }
        const invalid = validateShiftPhoto(photo);
        if (invalid) {
          fail(invalid);
          return;
        }
        const input = inputs[cardId];
        await upload.mutateAsync({
          shiftId,
          cardId,
          photo,
          enteredBalance: parseOptionalAmountInput(input?.entered ?? ""),
          comment: input?.comment,
        });
        // Ko'rsatiladigan nom — kassir tanlagan fayl, hajm — yuborilgani.
        setPhotos((current) => ({ ...current, [cardId]: { name: file.name, size: photo.size, at: new Date() } }));
      } catch (error) {
        fail("upload", getApiErrorMessage(error) || null);
      } finally {
        setUploading((current) => ({ ...current, [cardId]: false }));
      }
    },
    [inputs, shiftId, upload],
  );

  const reset = useCallback(() => {
    setInputs({});
    setPhotos({});
    setUploading({});
    setPhotoErrors({});
    setServerIssues({});
  }, []);

  const { refetch: refetchBalances } = balancesQuery;
  const { refetch: refetchReport } = reportQuery;
  const { refetch: refetchSettings } = settingsQuery;
  /**
   * Yopish 400 xabarini qo'llaydi: karta topilsa — ajratiladi, kutilgan qoldiqlar va qoralamalar qayta o'qiladi;
   * kartalar ro'yxati eskirgan bo'lsa (`isShiftCardsOutdatedError`) — sozlama ham qayta o'qiladi (yangi karta qator
   * bo'lib chiqadi). `true` — xabar oynaga tegishli (oyna ochiq qoladi).
   */
  const applyCloseError = useCallback(
    (message: string | null | undefined): boolean => {
      if (isShiftCardsOutdatedError(message)) {
        setServerIssues({});
        void refetchSettings();
        void refetchBalances();
        void refetchReport();
        return true;
      }
      const issue = parseShiftCloseError(message);
      if (!issue) return false;
      const target = (settingsQuery.data?.cards ?? []).find((card) => card.name.trim() === issue.cardName);
      if (!target) {
        // Karta oynada yo'q (shu orada qo'shilgan yoki nomi o'zgargan) — ro'yxat qayta o'qiladi.
        void refetchSettings();
        return false;
      }
      setServerIssues({ [target.card_id]: issue.kind });
      void refetchBalances();
      void refetchReport();
      return true;
    },
    [refetchBalances, refetchReport, refetchSettings, settingsQuery.data],
  );

  const isUploading = rows.some((row) => row.uploading);
  const hasErrors = rows.some((row) => row.errors.length > 0);
  /** Rasm majburiy, lekin skrinshot yuklanmagan kartalar — «Smenani yopish» o'chiq (sababi oynada). */
  const missingPhotos = rows.filter((row) => row.photoRequired && !row.hasPhoto && !row.uploading).map((row) => row.card);

  /** `accounts[]` (POST finance/shift/close) va sanalgan karta = Σ kiritilgan; tasdiqlash o'chiq — `null`. */
  const buildPayload = (): { accounts: CloseShiftAccount[]; countedCard: number | null } | null => {
    if (!enabled) return null;
    const accounts = rows.map((row) => ({
      card_id: row.card.card_id,
      entered_balance: row.entered ?? 0,
      ...(row.comment.trim() ? { comment: row.comment.trim() } : {}),
    }));
    const countedCard = accounts.length
      ? Math.round(accounts.reduce((sum, account) => sum + account.entered_balance, 0) * 100) / 100
      : null;
    return { accounts, countedCard };
  };

  return {
    enabled,
    /** Sozlamalar hali o'qilmoqda (oyna ochilgandan beri yangi javob yo'q) — yopish tugmasi kutadi. */
    settingsLoading: open && !settingsFresh && (settingsQuery.isLoading || settingsQuery.isFetching),
    cardsLoading: enabled && balancesQuery.isLoading,
    rows,
    isUploading,
    hasErrors,
    missingPhotos,
    canUpload: Boolean(shiftId),
    setRowInput,
    uploadPhoto,
    reset,
    buildPayload,
    applyCloseError,
    refetchSettings,
  };
};

export type ShiftAccountsForm = ReturnType<typeof useShiftAccountsForm>;
