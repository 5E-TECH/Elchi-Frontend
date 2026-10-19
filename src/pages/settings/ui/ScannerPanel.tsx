// dizayn-v2: common-settings-scanner
import { useId, type ReactNode } from "react";
import {
  Flashlight,
  Info,
  Play,
  Repeat,
  Scan,
  ScanLine,
  Usb,
  Vibrate,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  AppSettings,
  ScannerCameraFacing,
  ScannerFrameSize,
  ScannerSoundId,
} from "../../../entities/settings";
import { cx } from "../../../shared/lib/cx";
import { Badge, buttonClasses, IconButton } from "../../../shared/ui/primitives";
import { SCANNER_SOUND_IDS } from "../../../shared/lib/scanner/feedback";
import { ChoiceCard, FootNote, RadioDot, SectionHead, SwitchRow } from "./settingsUi";

type CameraSettings = AppSettings["scanner"]["camera"];
type FeedbackSettings = AppSettings["scanner"]["feedback"];

const FACINGS: ScannerCameraFacing[] = ["environment", "user"];
const FRAMES: { id: ScannerFrameSize; icon: 16 | 20 | 24 }[] = [
  { id: "sm", icon: 16 },
  { id: "md", icon: 20 },
  { id: "lg", icon: 24 },
];

/** `.el-h3` + izoh — karta ichidagi kichik bo'lim sarlavhasi (radio guruh nomi). */
const SubHead = ({ id, hintId, title, hint }: { id: string; hintId: string; title: string; hint: string }) => (
  <div className="flex flex-col gap-0.5">
    <span id={id} className="text-sm font-semibold text-text">
      {title}
    </span>
    <span id={hintId} className="text-[13px] text-text-muted">
      {hint}
    </span>
  </div>
);

/** `.el-stat-icon` — kalit qatoridagi neytral ikonka (sunken fon ustida — `surface`). */
const RowIcon = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span
    aria-hidden="true"
    className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted"
  >
    <Icon size={20} />
  </span>
);

/** Radio tanlov: `.el-choice-card` (radio nuqta + nom + izoh, o'ngda ixtiyoriy rasmcha). */
const Choice = ({
  name,
  value,
  checked,
  onSelect,
  title,
  hint,
  aside,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  aside?: ReactNode;
}) => (
  <ChoiceCard
    name={name}
    value={value}
    checked={checked}
    onSelect={onSelect}
    className="min-h-16 items-center gap-3 px-3.5 py-2.5"
  >
    <RadioDot />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-sm font-semibold text-text">{title}</span>
      <span className="text-xs text-text-muted">{hint}</span>
    </span>
    {aside}
  </ChoiceCard>
);

/**
 * «KAMERA» kartasi (maket `common-settings-scanner`, skaner ishi 4-bosqichi): «Kamerani sinash» → `/scan`,
 * asosiy kamera (orqa / old), kalitlar (chiroq — avtomatik, uzluksiz skanerlash, ovoz, tebranish) va ramka
 * o'lchami. Qiymatlar `entities/settings` da (hisobga yoziladi) + `localStorage` ko'zgusi — kamera
 * (`ScannerCamera`) va skan signali shundan o'qiydi; har tanlov darhol saqlanadi.
 */
const CameraSection = ({
  camera,
  feedback,
  canTestCamera,
  onCamera,
  onFeedback,
}: {
  camera: CameraSettings;
  feedback: FeedbackSettings;
  canTestCamera: boolean;
  onCamera: (patch: Partial<CameraSettings>) => void;
  onFeedback: (patch: Partial<FeedbackSettings>) => void;
}) => {
  const { t } = useTranslation("settings");
  const headId = useId();
  const facingId = useId();
  const facingHintId = useId();
  const frameId = useId();
  const frameHintId = useId();
  const facingName = useId();
  const frameName = useId();

  const toggles: {
    key: string;
    icon: LucideIcon;
    checked: boolean;
    onToggle: (next: boolean) => void;
  }[] = [
    { key: "torch", icon: Flashlight, checked: camera.torchAuto, onToggle: (next) => onCamera({ torchAuto: next }) },
    {
      key: "continuous",
      icon: Repeat,
      checked: camera.continuous,
      onToggle: (next) => onCamera({ continuous: next }),
    },
    { key: "sound", icon: Volume2, checked: feedback.sound, onToggle: (next) => onFeedback({ sound: next }) },
    {
      key: "vibration",
      icon: Vibrate,
      checked: feedback.vibration,
      onToggle: (next) => onFeedback({ vibration: next }),
    },
  ];

  return (
    <section aria-labelledby={headId} className="flex flex-col gap-5 p-5 max-md:p-4">
      <SectionHead
        id={headId}
        title={t("scanner.camera.title")}
        hint={t("scanner.camera.hint")}
        aside={
          canTestCamera ? (
            <Link to="/scan" className={buttonClasses({ variant: "secondary", className: "flex-none" })}>
              <ScanLine aria-hidden="true" size={18} />
              {t("scanner.camera.test")}
            </Link>
          ) : null
        }
      />

      <div role="radiogroup" aria-labelledby={facingId} aria-describedby={facingHintId} className="flex flex-col gap-2.5">
        <SubHead
          id={facingId}
          hintId={facingHintId}
          title={t("scanner.camera.facing")}
          hint={t("scanner.camera.facing_hint")}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3">
          {FACINGS.map((facing) => (
            <Choice
              key={facing}
              name={facingName}
              value={facing}
              checked={camera.facing === facing}
              onSelect={() => onCamera({ facing })}
              title={t(`scanner.camera.facing_${facing}`)}
              hint={t(`scanner.camera.facing_${facing}_hint`)}
            />
          ))}
        </div>
      </div>

      <ul className="m-0 list-none overflow-hidden rounded-xl bg-sunken p-0 [&>li+li]:border-t [&>li+li]:border-border">
        {toggles.map(({ key, icon, checked, onToggle }) => (
          <li key={key}>
            <SwitchRow
              checked={checked}
              onToggle={onToggle}
              title={t(`scanner.camera.${key}`)}
              hint={t(`scanner.camera.${key}_hint`)}
              leading={<RowIcon icon={icon} />}
            />
          </li>
        ))}
      </ul>

      <div role="radiogroup" aria-labelledby={frameId} aria-describedby={frameHintId} className="flex flex-col gap-2.5">
        <SubHead
          id={frameId}
          hintId={frameHintId}
          title={t("scanner.camera.frame")}
          hint={t("scanner.camera.frame_hint")}
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
          {FRAMES.map(({ id, icon }) => (
            <Choice
              key={id}
              name={frameName}
              value={id}
              checked={camera.frame === id}
              onSelect={() => onCamera({ frame: id })}
              title={t(`scanner.camera.frame_${id}`)}
              hint={t(`scanner.camera.frame_${id}_hint`)}
              aside={
                <span
                  aria-hidden="true"
                  className="inline-flex h-[46px] w-[34px] flex-none items-center justify-center rounded-lg border border-border-strong bg-sunken text-text-muted"
                >
                  <Scan size={icon} />
                </span>
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
};

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
 * «SKANER» — maket `common-settings-scanner` (spec D5: alohida tab, ovozlar Interfeysdan ko'chdi): «Kamera»
 * kartasi (skaner ishi 4-bosqichi), ovozlar, USB skaner. Ovoz tanlovi — `onSelect` (localStorage + persist),
 * eshitib ko'rish — `onPreview` (tanlov o'zgarmaydi); kamera — `onCamera`, ovoz/tebranish kaliti — `onFeedback`.
 */
export const ScannerPanel = ({
  sounds,
  camera,
  feedback,
  canTestCamera = true,
  onSelect,
  onPreview,
  onCamera,
  onFeedback,
}: {
  sounds: Record<SoundType, ScannerSoundId>;
  camera: CameraSettings;
  feedback: FeedbackSettings;
  /** «Kamerani sinash» (`/scan`) — skanerlaydigan rollarda (marketda universal skaner yo'q). */
  canTestCamera?: boolean;
  onSelect: (type: SoundType, sound: ScannerSoundId) => void;
  onPreview: (type: SoundType, sound: ScannerSoundId) => void;
  onCamera: (patch: Partial<CameraSettings>) => void;
  onFeedback: (patch: Partial<FeedbackSettings>) => void;
}) => {
  const { t } = useTranslation("settings");
  return (
    <>
      <CameraSection
        camera={camera}
        feedback={feedback}
        canTestCamera={canTestCamera}
        onCamera={onCamera}
        onFeedback={onFeedback}
      />
      <div className="border-t border-border">
        <SoundGroup
          type="success"
          value={sounds.success}
          onSelect={(sound) => onSelect("success", sound)}
          onPreview={(sound) => onPreview("success", sound)}
        />
      </div>
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
