// dizayn-v2: common-settings-scanner
import { useId } from "react";
import { Info, Play, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScannerSoundId } from "../../../entities/settings";
import { cx } from "../../../shared/lib/cx";
import { Badge, IconButton } from "../../../shared/ui/primitives";
import { SCANNER_SOUND_IDS } from "../../scan/lib/scanShared";
import { FootNote, RadioDot, SectionHead } from "./settingsUi";

type SoundType = "success" | "error";

/**
 * Ovoz tanlovi: har variant — `.el-choice-card` (radio + nom) va yonida «Eshitib ko'rish» `IconButton`
 * (tanlovni o'zgartirmaydi — maket footeri). Radio va tugma alohida: tugma `label` ichida emas.
 */
const SoundGroup = ({
  type,
  value,
  onSelect,
  onPreview,
}: {
  type: SoundType;
  value: ScannerSoundId;
  onSelect: (sound: ScannerSoundId) => void;
  onPreview: (sound: ScannerSoundId) => void;
}) => {
  const { t } = useTranslation("settings");
  const headId = useId();
  const name = useId();
  return (
    <div role="radiogroup" aria-labelledby={headId} className="flex flex-col gap-4 p-5 max-md:p-4">
      <SectionHead
        id={headId}
        title={t(`scanner.${type}_sound`)}
        hint={t(`scanner.${type}_sound_hint`)}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        {SCANNER_SOUND_IDS.map((sound) => {
          const label = t(`scanner.sound_${sound}`);
          return (
            <div
              key={sound}
              className={cx(
                "flex min-h-14 items-center gap-2 rounded-xl border border-border-strong bg-surface py-1.5 pl-3.5 pr-1.5",
                "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
                "has-[:checked]:border-action has-[:checked]:bg-action-soft has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-focus",
              )}
            >
              <label className="group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name={name}
                  value={sound}
                  checked={value === sound}
                  onChange={() => onSelect(sound)}
                  className="sr-only"
                />
                <RadioDot />
                <span className="truncate text-sm font-semibold text-text">{label}</span>
              </label>
              <IconButton
                size="sm"
                icon={Play}
                label={t(`scanner.preview_${type}`, { sound: label })}
                onClick={() => onPreview(sound)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * «SKANER» — maket `common-settings-scanner` (spec D5: alohida tab, ovozlar Interfeysdan ko'chdi). «Kamera»
 * kartasi (asosiy kamera, chiroq, tebranish, ramka) — kamera ishida (ega qarori 2026-10-16), bu yerda yo'q.
 * Ovoz tanlovi — `onSelect` (localStorage + persist), eshitib ko'rish — `onPreview` (tanlov o'zgarmaydi).
 */
export const ScannerPanel = ({
  sounds,
  onSelect,
  onPreview,
}: {
  sounds: Record<SoundType, ScannerSoundId>;
  onSelect: (type: SoundType, sound: ScannerSoundId) => void;
  onPreview: (type: SoundType, sound: ScannerSoundId) => void;
}) => {
  const { t } = useTranslation("settings");
  return (
    <>
      <SoundGroup
        type="success"
        value={sounds.success}
        onSelect={(sound) => onSelect("success", sound)}
        onPreview={(sound) => onPreview("success", sound)}
      />
      <div className="border-t border-border">
        <SoundGroup
          type="error"
          value={sounds.error}
          onSelect={(sound) => onSelect("error", sound)}
          onPreview={(sound) => onPreview("error", sound)}
        />
      </div>
      {/* USB skaner — telefonda yo'q (maket `el-hide-mobile`). */}
      <div className="flex items-start gap-4 border-t border-border p-5 max-md:hidden">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
        >
          <Usb size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-base font-bold text-text">{t("scanner.usb_title")}</h2>
            <Badge tone="success" dot>
              {t("scanner.usb_ready")}
            </Badge>
          </div>
          <p className="text-[13px] text-text-muted">{t("scanner.usb_hint")}</p>
        </div>
      </div>
      <div className="border-t border-border px-5 py-3 max-md:px-4">
        <FootNote icon={<Info size={16} />}>{t("scanner.footer")}</FootNote>
      </div>
    </>
  );
};
