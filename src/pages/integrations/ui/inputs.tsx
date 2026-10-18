// dizayn-v2: superadmin-integrations-panel-security, superadmin-integrations-new-partner-dialog
import { useState, type KeyboardEvent } from "react";
import { Copy, Eye, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "../../../shared/lib/clipboard";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import {
  Button,
  IconButton,
  Pressable,
  TextInput,
  useFieldControl,
} from "../../../shared/ui/primitives";

/**
 * Integratsiyalar formalari uchun kichik boshqaruvlar (CODE-MAP 2.2):
 *  - `SecretInput` — parol turidagi `TextInput` + «Sekretni ko'rsatish» tugmasi;
 *  - `TagsInput` — IP ro'yxati: yozib Enter (yoki vergul/bo'shliq) bosiladi → `.el-chip`, × bilan olinadi;
 *  - `CopyValue` — bir marta ko'rsatiladigan kalit: monoshrift qiymat + «Nusxa olish».
 */

export const SecretInput = ({
  value,
  onValueChange,
  placeholder,
  disabled,
  autoComplete = "new-password",
}: {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) => {
  const { t } = useTranslation("integrations");
  const [shown, setShown] = useState(false);
  return (
    <TextInput
      type={shown ? "text" : "password"}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      suffix={
        <IconButton
          size="sm"
          icon={shown ? EyeOff : Eye}
          label={t(shown ? "console.secretHide" : "console.secretShow")}
          aria-pressed={shown}
          disabled={disabled}
          onClick={() => setShown((v) => !v)}
          className="-mr-2"
        />
      }
    />
  );
};

/** Vergul, bo'shliq yoki yangi qator bilan ajratilgan qiymatlarni bo'laklaydi. */
const splitTokens = (raw: string) =>
  raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const TagsInput = ({
  value,
  onChange,
  placeholder,
  disabled,
  listLabel,
  removeLabel,
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Chiplar ro'yxati nomi (maket: «Kiritilgan IP manzillar»). */
  listLabel: string;
  /** × tugmasi nomi (maket: «203.0.113.10 manzilini olib tashlash»). */
  removeLabel: (item: string) => string;
}) => {
  const [draft, setDraft] = useState("");
  const control = useFieldControl({ disabled });

  const commit = (raw: string) => {
    const tokens = splitTokens(raw);
    if (!tokens.length) return;
    const next = [...value];
    for (const token of tokens) if (!next.includes(token)) next.push(token);
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {value.length > 0 ? (
        <ul aria-label={listLabel} className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong bg-surface pl-3 pr-1 text-[13px] font-medium text-text max-md:h-11"
            >
              <span className="font-mono">{item}</span>
              <Pressable
                aria-label={removeLabel(item)}
                disabled={control.disabled}
                onClick={() => onChange(value.filter((v) => v !== item))}
                className={cx(
                  "relative inline-flex size-6 items-center justify-center rounded-full text-text-muted hover:bg-sunken hover:text-text",
                  "disabled:cursor-not-allowed disabled:opacity-45 max-md:size-9",
                  // Telefonda bosiladigan maydon 44 px (ko'rinishi 36 px).
                  "max-md:after:absolute max-md:after:-inset-1 max-md:after:content-['']",
                )}
              >
                <X size={14} aria-hidden="true" />
              </Pressable>
            </li>
          ))}
        </ul>
      ) : null}
      <TextInput
        value={draft}
        onValueChange={setDraft}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
        onPaste={(event) => {
          const text = event.clipboardData.getData("text");
          if (/[,\s]/.test(text.trim())) {
            event.preventDefault();
            commit(`${draft} ${text}`);
          }
        }}
        placeholder={placeholder}
        disabled={control.disabled}
        inputMode="text"
        autoComplete="off"
      />
    </div>
  );
};

export const CopyValue = ({ value, label, onCopied }: { value: string; label?: string; onCopied?: () => void }) => {
  const { t } = useTranslation("integrations");
  const copy = () => {
    void copyToClipboard(value).then((ok) => {
      if (ok) {
        notify.success(t("console.copied"));
        onCopied?.();
      } else {
        notify.error(t("console.copyFailed"));
      }
    });
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[10px] border border-border bg-sunken px-3 py-2">
      <code className="min-w-0 flex-[1_1_200px] break-all font-mono text-[13px] text-text">{value}</code>
      <Button variant="secondary" size="sm" leftIcon={Copy} onClick={copy} className="max-md:min-h-11">
        {label ?? t("console.copy")}
      </Button>
    </div>
  );
};
