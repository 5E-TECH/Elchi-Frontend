import { useId, useMemo, type ComponentProps, type ReactNode } from "react";
import { CircleX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";
import { FieldContext, type FieldContextValue } from "./fieldContext";

/**
 * ────────────────────────────────────────────────────────────────────────────
 *  FORMA MAYDONI — dizayn v2 (`.el-field` · `.el-label` · `.el-req` · `.el-hint` · `.el-error-text`,
 *  `design/CODE-MAP.md` 2.2, taxta `tizim-states-forms` 01)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Har maydon bitta tartibda: yorliq USTIDA, ko'rsatma yoki xato matni OSTIDA. Yorliq doim ko'rinadi —
 *  maydon ichidagi namuna matni (placeholder) uning o'rnini bosmaydi.
 *    majburiy   — yorliq oxirida qizil yulduzcha `*` (`required`);
 *    ixtiyoriy  — yorliqdan keyin kulrang «(ixtiyoriy)» (`optional`);
 *    xato       — ko'rsatma O'RNIDA chiqadi (maydon balandligi o'zgarmaydi): qizil matn + `CircleX`;
 *                 holat faqat rang bilan emas — chegara, ikonka va matn birga aytadi;
 *    o'chirilgan — sababi ko'rsatmada («Yopilgan buyurtmada tahrirlanmaydi»).
 *
 *  `id` bog'lanishi avtomatik (`fieldContext`): ichidagi `TextInput`/`Select`/`DateRange` yorliqqa
 *  (`htmlFor` / `aria-labelledby`), ko'rsatma yoki xatoga (`aria-describedby`, `aria-errormessage`)
 *  ulanadi, `aria-invalid` va `aria-required` oladi.
 */

export type FieldProps = Omit<ComponentProps<"div">, "children" | "id"> & {
  /** Yorliq (maketdagi matn, gap registri: «Mijoz ismi»). */
  label: ReactNode;
  /** Boshqaruv: `TextInput`, `Select`, `DateRange` yoki `useFieldControl()` ishlatgan boshqa element. */
  children: ReactNode;
  /** Boshqaruv `id` si (sukut — avtomatik). */
  id?: string;
  /** Majburiy: yorliqda qizil `*`, boshqaruvda `aria-required`. */
  required?: boolean;
  /** Ixtiyoriy: yorliqdan keyin kulrang «(ixtiyoriy)». `required` bilan birga ishlatilmaydi. */
  optional?: boolean;
  /** Ko'rsatma (ostida, `text-muted`). Xato bo'lsa yashirinadi — xato uning o'rnida. */
  hint?: ReactNode;
  /** Xato matni. Berilsa maydon xato holatida (`aria-invalid`). */
  error?: ReactNode;
  /** Matnsiz xato holati (masalan xato matni forma tepasida). */
  invalid?: boolean;
  /** Boshqaruvni o'chiradi (sababini `hint` da yozing). */
  disabled?: boolean;
  /** Faqat o'qish: matn to'liq kontrastda, fon `sunken`. */
  readOnly?: boolean;
  /**
   * Yorliq elementi: `label` (sukut, `htmlFor` — matn maydoni) yoki `span` (tugma ko'rinishidagi
   * boshqaruv — Select/DateRange `aria-labelledby` bilan; yorliq bosilganda ro'yxat ochilib ketmasin).
   */
  labelAs?: "label" | "span";
  /** Yorliq faqat ekran o'quvchi uchun (asboblar panelidagi qidiruv; ko'rinadigan yorliq maketda yo'q). */
  hideLabel?: boolean;
  /** Ko'rsatma o'zgarishi o'qilsin (`aria-live="polite"`) — belgi hisoblagichi kabi. */
  hintLive?: boolean;
  /** Yorliq qatorining o'ng tomoni (masalan «Barchasini tanlash» havolasi). */
  labelAside?: ReactNode;
};

/**
 * Dizayn v2 forma maydoni.
 *
 *   <Field label={t("fields.name")} required hint={t("hints.name")} error={errors.name?.message}>
 *     <TextInput value={name} onValueChange={setName} placeholder={t("placeholders.name")} />
 *   </Field>
 */
export const Field = ({
  label,
  children,
  id,
  required = false,
  optional = false,
  hint,
  error,
  invalid,
  disabled = false,
  readOnly = false,
  labelAs = "label",
  hideLabel = false,
  hintLive = false,
  labelAside,
  className,
  ...rest
}: FieldProps) => {
  const { t } = useTranslation("ui");
  const autoId = useId();
  const controlId = id ?? `field-${autoId}`;
  const labelId = `${controlId}-label`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const isInvalid = hasError || Boolean(invalid);
  const showHint = !hasError && hint !== undefined && hint !== null && hint !== false && hint !== "";
  const hintId = showHint ? `${controlId}-hint` : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;

  const context = useMemo<FieldContextValue>(
    () => ({ controlId, labelId, hintId, errorId, invalid: isInvalid, required, disabled, readOnly }),
    [controlId, labelId, hintId, errorId, isInvalid, required, disabled, readOnly],
  );

  const labelContent = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className="text-danger-fg">
          {" *"}
        </span>
      ) : optional ? (
        <span className="font-normal text-text-muted">{` (${t("field.optional")})`}</span>
      ) : null}
    </>
  );
  const labelClass = cx("min-w-0 text-[13px] font-semibold text-text", hideLabel && "sr-only");
  const labelElement =
    labelAs === "label" ? (
      <label id={labelId} htmlFor={controlId} className={labelClass}>
        {labelContent}
      </label>
    ) : (
      <span id={labelId} className={labelClass}>
        {labelContent}
      </span>
    );

  return (
    <div
      data-field=""
      data-invalid={isInvalid || undefined}
      className={cx("flex min-w-0 flex-col gap-1.5", className)}
      {...rest}
    >
      {labelAside ? (
        <div className={cx("flex min-w-0 items-baseline justify-between gap-2", hideLabel && "justify-end")}>
          {labelElement}
          {labelAside}
        </div>
      ) : (
        labelElement
      )}

      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>

      {hasError ? (
        <div id={errorId} className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
          <CircleX aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      ) : showHint ? (
        <div id={hintId} aria-live={hintLive ? "polite" : undefined} className="text-xs text-text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
};
