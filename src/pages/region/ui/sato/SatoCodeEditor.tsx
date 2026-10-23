// dizayn-v2: superadmin-regions-sato-codes-edit, admin-regions-sato-codes-edit
import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Field, TextInput } from "../../../../shared/ui/primitives";
import type { SatoDistrictRow } from "../../model/satoModel";
import { useSatoEditorErrorText, type SatoCodeEditorState } from "./useSatoCodeEditor";

type EditorProps = { row: SatoDistrictRow; editor: SatoCodeEditorState };

/*
 * Saqlash paytida maydon `readOnly` (`disabled` EMAS): o'chirilgan fokusli element fokusni `<body>` ga beradi va
 * 409/400/500 dan keyin Esc/Enter ishlamay qoladi. Enter — `saving` bilan himoyalangan.
 */
const useKeys = ({ row, editor }: EditorProps) => (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!editor.saving) void editor.save(row);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    editor.cancel();
  }
};

/** Jadval katagi (desktop/planshet): kod maydoni + ko'rsatma yoki xato (maket `*-sato-codes-edit`). */
export const SatoCodeField = ({ row, editor }: EditorProps) => {
  const { t } = useTranslation("region");
  const errorText = useSatoEditorErrorText()(editor.error);
  const onKeyDown = useKeys({ row, editor });
  return (
    <Field
      label={t("v2.sato.editor.fieldAria", { name: row.name })}
      hideLabel
      hint={errorText ? undefined : t("v2.sato.editor.hint")}
      error={errorText ?? undefined}
      className="min-w-0 max-w-[420px]"
    >
      {/* Kenglik o'rovchida: `TextInput` tashqi qutisi `w-full` (maket — ~200px maydon, xato matni kengroq). */}
      <div data-sato-code-box="" className="w-[200px] max-w-full">
        <TextInput
          mode="number"
          autoFocus
          autoComplete="off"
          value={editor.draft}
          onValueChange={editor.setDraft}
          onKeyDown={onKeyDown}
          readOnly={editor.saving}
        />
      </div>
    </Field>
  );
};

/** Jadval katagi: «Bekor» va «Saqlash». */
export const SatoCodeActions = ({ row, editor }: EditorProps) => {
  const { t } = useTranslation("region");
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="ghost" size="sm" onClick={editor.cancel} disabled={editor.saving}>
        {t("v2.sato.editor.cancel")}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={Check}
        loading={editor.saving}
        loadingText={t("v2.sato.editor.saving")}
        onClick={() => void editor.save(row)}
      >
        {t("v2.sato.editor.save")}
      </Button>
    </div>
  );
};

/** Telefon kartasidagi muharrir (maket telefon: yorliq «SATO kodi *», maydon, «Bekor» · «Saqlash» teng). */
export const SatoCodeEditorBlock = ({ row, editor }: EditorProps) => {
  const { t } = useTranslation("region");
  const errorText = useSatoEditorErrorText()(editor.error);
  const onKeyDown = useKeys({ row, editor });
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-sunken p-3">
      <Field
        label={t("v2.sato.editor.label")}
        required
        hint={errorText ? undefined : t("v2.sato.editor.hint")}
        error={errorText ?? undefined}
      >
        <TextInput
          mode="number"
          autoFocus
          autoComplete="off"
          value={editor.draft}
          onValueChange={editor.setDraft}
          onKeyDown={onKeyDown}
          readOnly={editor.saving}
          aria-label={t("v2.sato.editor.fieldAria", { name: row.name })}
        />
      </Field>
      <div className="mt-1 flex gap-2">
        <Button variant="ghost" size="lg" className="flex-1" onClick={editor.cancel} disabled={editor.saving}>
          {t("v2.sato.editor.cancel")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          leftIcon={Check}
          loading={editor.saving}
          loadingText={t("v2.sato.editor.saving")}
          onClick={() => void editor.save(row)}
        >
          {t("v2.sato.editor.save")}
        </Button>
      </div>
    </div>
  );
};
