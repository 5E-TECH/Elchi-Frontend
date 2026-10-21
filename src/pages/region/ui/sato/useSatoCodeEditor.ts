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
    setDraftState(satoDraftFor(row));
    setError(null);
  }, []);

  const cancel = useCallback(() => stop(editingRef.current), [stop]);

  const setDraft = useCallback((value: string) => {
    setDraftState(value);
    setError(null);
  }, []);

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
        if (editingRef.current === row.id) stop(row.id, true);
        notify.success(t("v2.sato.editor.saved"), {
          description: t("v2.sato.editor.savedText", { name: row.name, code }),
        });
        await onSaved();
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
        if (editingRef.current === row.id) setError(next);
      } finally {
        setSaving(false);
      }
    },
    [draft, onSaved, stop, t],
  );

  return { editingId, draft, error, saving, start, cancel, setDraft, save };
};

/** Xato → i18n matn (server `message` hech qachon ko'rsatilmaydi). */
export const useSatoEditorErrorText = () => {
  const { t } = useTranslation("region");
  return (error: SatoEditorError | null): string | null => {
    if (!error) return null;
    if (error.kind === "invalid") return t("v2.sato.editor.invalid");
    if (error.kind === "taken")
      return error.region
        ? t("v2.sato.editor.taken", { district: error.district, region: error.region })
        : t("v2.sato.editor.takenNoRegion", { district: error.district });
    if (error.kind === "takenUnknown") return t("v2.sato.editor.takenUnknown");
    return t("v2.sato.editor.failed");
  };
};
