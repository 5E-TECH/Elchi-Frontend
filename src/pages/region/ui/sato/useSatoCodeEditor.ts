import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../shared/api/api";
import { API_ENDPOINTS } from "../../../../shared/api";
import { notify } from "../../../../shared/lib/notify";
import { httpStatusOf } from "../../model/districtMerge";
import {
  isValidSatoCode,
  normalizeSatoOwner,
  satoDraftFor,
  type SatoDistrictRow,
} from "../../model/satoModel";

/** Saqlash xatosi: raqam emas · kod band (egasi ma'lum / noma'lum) · boshqa xato. Server matni ko'rsatilmaydi. */
export type SatoEditorError =
  | { kind: "invalid" }
  | { kind: "taken"; district: string; region: string | null }
  | { kind: "takenUnknown" }
  | { kind: "failed" };

export type SatoCodeEditorState = {
  editingId: string | null;
  /** Ekran o'quvchiga e'lon («<tuman> — SATO kodi: <xato>»); xato yo'q — bo'sh satr. */
  announcement: string;
  draft: string;
  error: SatoEditorError | null;
  saving: boolean;
  start: (row: SatoDistrictRow) => void;
  cancel: () => void;
  setDraft: (value: string) => void;
  save: (row: SatoDistrictRow) => Promise<void>;
};

/** Tahrirlash tugmasi — fokus shu yerga qaytadi (`data-sato-edit`). */
const editTriggerOf = (id: string) =>
  typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>(`[data-sato-edit="${id.replace(/["\\]/g, "\\$&")}"]`);

/**
 * Inline kod muharriri (bir vaqtda bitta qator): `PATCH district/sato/:id { sato_code }` (admin + superadmin).
 * 409 («kod band») bo'lsa `GET district/sato/:code` bilan egasi olinadi → «Bu kod band: <tuman>, <viloyat>».
 * Muvaffaqiyatda — xabar, muharrir yopiladi, `onSaved` (preview va `/district` birga qayta yuklanadi).
 */
export const useSatoCodeEditor = ({
  onSaved,
  fallbackFocus,
}: {
  onSaved: () => Promise<unknown> | void;
  /** Saqlangach qator boshqa tabga o'tib ketsa — fokus shu elementga (qidiruv maydoni). */
  fallbackFocus?: () => HTMLElement | null;
}): SatoCodeEditorState => {
  const { t } = useTranslation("region");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draft, setDraftState] = useState("");
  const [error, setError] = useState<SatoEditorError | null>(null);
  const [saving, setSaving] = useState(false);
  const editingRef = useRef<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ id: string; fallback: boolean } | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const trigger = editTriggerOf(focusTarget.id);
    if (trigger) trigger.focus();
    else if (focusTarget.fallback) fallbackFocus?.()?.focus();
    setFocusTarget(null);
  }, [focusTarget, fallbackFocus]);

  const stop = useCallback((id: string | null, fallback = false) => {
    editingRef.current = null;
    setEditingId(null);
    setError(null);
    setDraftState("");
    if (id) setFocusTarget({ id, fallback });
  }, []);

  const start = useCallback((row: SatoDistrictRow) => {
    editingRef.current = row.id;
    setEditingId(row.id);
    setEditingName(row.name);
    setDraftState(satoDraftFor(row));
    setError(null);
  }, []);

  const cancel = useCallback(() => stop(editingRef.current), [stop]);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setError(null);
  }, []);

  const errorText = useSatoEditorErrorText();

  const save = useCallback(
    async (row: SatoDistrictRow) => {
      const code = draft.trim();
      if (!isValidSatoCode(code)) {
        setError({ kind: "invalid" });
        return;
      }
      if (code === row.satoCode) {
        stop(row.id);
        return;
      }
      setSaving(true);
      try {
        await api.patch(API_ENDPOINTS.DISTRICTS.SATO_UPDATE(row.id), { sato_code: code });
      } catch (cause) {
        const status = httpStatusOf(cause);
        let next: SatoEditorError = { kind: "failed" };
        if (status === 400) next = { kind: "invalid" };
        if (status === 409) {
          next = { kind: "takenUnknown" };
          try {
            const owner = normalizeSatoOwner((await api.get(API_ENDPOINTS.DISTRICTS.SATO_BY_CODE(code))).data);
            if (owner && owner.id !== row.id) next = { kind: "taken", district: owner.name, region: owner.regionName };
          } catch {
            // Egasini olib bo'lmadi — umumiy «kod band» matni.
          }
        }
        setSaving(false);
        // Muharrir ochiq — xato maydon ostida; so'rov davomida yopilgan bo'lsa (qidiruv, tab, boshqa qator) —
        // xato yo'qolmasin: qalqib chiquvchi xabar (faqat i18n matn).
        if (editingRef.current === row.id) setError(next);
        else notify.error(t("v2.sato.editor.failedTitle", { name: row.name }), { description: errorText(next) ?? undefined });
        return;
      }
      // Muvaffaqiyat: «Saqlanmoqda…» shu yerda tugaydi (qayta yuklash kutilmaydi — boshqa qator band ko'rinmasin).
      setSaving(false);
      const stillEditing = editingRef.current === row.id;
      if (stillEditing) stop(null);
      notify.success(t("v2.sato.editor.saved"), {
        description: t("v2.sato.editor.savedText", { name: row.name, code }),
      });
      try {
        await onSaved();
        // react-query obunachilarga yangi ma'lumotni `setTimeout(0)` partiyasida beradi — eski qator hali DOM da
        // turgan paytda fokuslanmasin (keyin u o'chib, fokus `<body>` ga tushadi).
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch {
        // Qayta yuklash xatosi sahifadagi holatda ko'rinadi.
      }
      // Fokus qayta yuklashdan KEYIN: qator boshqa tabga o'tgan bo'lsa — qidiruv maydoniga (eskisi o'chib ketadi).
      if (stillEditing && editingRef.current === null) setFocusTarget({ id: row.id, fallback: true });
    },
    [draft, errorText, onSaved, stop, t],
  );

  const errorMessage = errorText(error);
  const announcement =
    editingId && errorMessage ? t("v2.sato.editor.errorAnnounce", { name: editingName, error: errorMessage }) : "";

  return { editingId, announcement, draft, error, saving, start, cancel, setDraft, save };
};

/** Xato → i18n matn (server `message` hech qachon ko'rsatilmaydi). */
export const useSatoEditorErrorText = () => {
  const { t } = useTranslation("region");
  return useCallback((error: SatoEditorError | null): string | null => {
    if (!error) return null;
    if (error.kind === "invalid") return t("v2.sato.editor.invalid");
    if (error.kind === "taken")
      return error.region
        ? t("v2.sato.editor.taken", { district: error.district, region: error.region })
        : t("v2.sato.editor.takenNoRegion", { district: error.district });
    if (error.kind === "takenUnknown") return t("v2.sato.editor.takenUnknown");
    return t("v2.sato.editor.failed");
  }, [t]);
};
