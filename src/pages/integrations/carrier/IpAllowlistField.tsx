// dizayn-v2: superadmin-integrations-carrier-create-dialog, superadmin-integrations-carrier-edit-dialog, admin-integrations-carrier-create-dialog, admin-integrations-carrier-edit-dialog
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { cx } from "../../../shared/lib/cx";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Field, TextInput } from "../../../shared/ui/primitives";
import { IP_ALLOWLIST_MAX_ENTRIES, type IpAllowlistCheck, type IpLineCheck } from "./ipAllowlist";

/**
 * IP RO'YXATI — har qatorga bitta (ega tanlovi: chip emas, textarea + qatorma-qator tekshiruv; maket
 * `*-carrier-create-dialog` «Tekshiruv: HQ tavsiyasi va IP xatolari», `*-carrier-edit-dialog`).
 *
 * Yorliq yonida «N / 50», textarea ostida har qator natijasi: to'g'ri (yashil belgi) · boshqa shaklda saqlanadi
 * yoki takror (eslatma) · xato (qizil fon, sababi). Maketdagi tartib: ro'yxat → xato xulosasi → ko'rsatma
 * («Qabul qilinadi: …» xato paytida ham ko'rinadi — formatlar aynan tuzatish paytida kerak). `Field` xatoda
 * ko'rsatmani yashiradi, shuning uchun xulosa va ko'rsatma shu yerda chiziladi (`Field` faqat `invalid` oladi);
 * ro'yxat, xato va ko'rsatma textarea'ning `aria-describedby` siga ulangan.
 */
export const IpAllowlistField = ({
  value,
  onValueChange,
  check,
  hint,
}: {
  value: string;
  onValueChange: (next: string) => void;
  check: IpAllowlistCheck;
  hint: string;
}) => {
  const { t, i18n } = useTranslation("integrations");
  const baseId = useId();
  const listId = `${baseId}-list`;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;
  const num = (n: number) => formatNumberLocalized(n, { language: i18n.language });
  const error = check.errorCount
    ? t("carrier.ip.errorsSummary", { count: num(check.errorCount) })
    : check.overLimit
      ? t("carrier.ip.overLimit", { max: num(IP_ALLOWLIST_MAX_ENTRIES) })
      : undefined;
  const rows = Math.min(8, Math.max(3, value.split(/\r?\n/).length));
  const describedBy = [check.lines.length ? listId : "", error ? errorId : "", hintId]
    .filter(Boolean)
    .join(" ");

  return (
    <Field
      label={t("carrier.create.ip")}
      optional
      invalid={Boolean(error)}
      labelAside={
        <span className="text-xs text-text-muted tabular-nums">
          {num(check.count)} / {num(IP_ALLOWLIST_MAX_ENTRIES)}
        </span>
      }
    >
      <TextInput
        multiline
        rows={rows}
        value={value}
        onValueChange={onValueChange}
        spellCheck={false}
        autoComplete="off"
        placeholder={t("carrier.create.ipPlaceholder")}
        aria-describedby={describedBy}
        className="whitespace-pre"
      />
      {check.lines.length ? (
        <ul
          id={listId}
          aria-label={t("carrier.ip.checkAria")}
          className="flex flex-col overflow-hidden rounded-[10px] border border-border"
        >
          {check.lines.map((line, index) => (
            <IpLineRow key={`${line.line}-${line.value}`} line={line} first={index === 0} />
          ))}
        </ul>
      ) : null}
      {error ? (
        <div id={errorId} className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
          <CircleX aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      ) : null}
      <div id={hintId} className="text-xs text-text-muted">
        {hint}
      </div>
    </Field>
  );
};

const IpLineRow = ({ line, first }: { line: IpLineCheck; first: boolean }) => {
  const { t } = useTranslation("integrations");
  const message =
    line.kind === "error"
      ? line.error === "hostBits"
        ? t("carrier.ip.hostBits", { suggestion: line.suggestion })
        : line.error === "ipv6Range"
          ? t("carrier.ip.ipv6Range")
          : line.error === "tooLong"
            ? t("carrier.ip.tooLong")
            : t("carrier.ip.invalid")
      : line.kind === "normalized"
        ? t("carrier.ip.normalized", { value: line.rule })
        : line.kind === "duplicate"
          ? t("carrier.ip.duplicate")
          : null;
  const tone = line.kind === "error" ? "error" : line.kind === "ok" ? "ok" : "note";
  const Icon = tone === "error" ? CircleX : tone === "ok" ? CircleCheck : Info;
  return (
    <li
      className={cx(
        "flex items-start gap-2.5 px-3 py-[7px]",
        !first && "border-t border-border",
        tone === "error" && "bg-danger-soft",
      )}
    >
      <span className="w-4 flex-none text-right text-xs leading-5 text-text-muted tabular-nums">
        {line.line}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-5 text-text [overflow-wrap:anywhere]">
          {line.value}
        </span>
        {message ? (
          <span
            className={cx(
              "text-xs",
              tone === "error" ? "font-semibold text-danger-fg" : "font-medium text-text-muted",
            )}
          >
            {message}
          </span>
        ) : null}
      </span>
      <span
        className={cx(
          "mt-0.5 inline-flex flex-none",
          tone === "error" ? "text-danger-fg" : tone === "ok" ? "text-success-fg" : "text-info-fg",
        )}
      >
        <Icon size={16} aria-hidden="true" />
        <span className="sr-only">
          {t(
            tone === "error"
              ? "carrier.ip.error"
              : tone === "ok"
                ? "carrier.ip.ok"
                : "carrier.ip.note",
          )}
        </span>
      </span>
    </li>
  );
};
