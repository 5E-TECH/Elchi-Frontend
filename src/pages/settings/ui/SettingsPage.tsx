import { memo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  Settings as SettingsIcon,
  Palette,
  LayoutDashboard,
  PanelLeft,
  User as UserIcon,
  Sun,
  Moon,
  Check,
  ChevronRight,
  Volume2,
  Play,
} from "lucide-react";
import HeaderName from "../../../shared/components/headerName";
import PageContainer from "../../../shared/ui/PageContainer";
import Toggle from "../../../shared/ui/Toggle";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import { changeAppLanguage, normalizeLanguage } from "../../../i18n";
import { setSidebar } from "../../../widgets/Sidebar/model/sidebarSlice";
import type { RootState } from "../../../app/config/store";
import {
  useSettings,
  useUpdateSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
  type ThemeMode,
  type Language,
  type DashboardWidgetId,
  type ScannerSoundId,
} from "../../../entities/settings";
import { playScanFeedback, SCANNER_SOUND_IDS } from "../../scan/lib/scanShared";
import {
  writeStoredScannerErrorSound,
  writeStoredScannerSuccessSound,
} from "../../../shared/lib/preferencesStorage";
import { useUser } from "../../../entities/user/api/userApi";
import { unwrapUserResponse } from "../../../entities/user/lib/normalizeUser";
import { UserDetailWidget } from "../../../widgets/user-detail/ui/UserDetailWidget";
import { TYPO, TEXT, toneSoftBg } from "../../../shared/config/designSystem";

type TabId = "appearance" | "dashboard" | "interface" | "profile";

const TABS: { id: TabId; icon: ReactNode }[] = [
  { id: "appearance", icon: <Palette size={18} /> },
  { id: "dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "interface", icon: <PanelLeft size={18} /> },
  { id: "profile", icon: <UserIcon size={18} /> },
];

const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "uz", label: "O'zbekcha", native: "UZ" },
  { key: "ru", label: "Русский", native: "RU" },
  { key: "en", label: "English", native: "EN" },
];

const WIDGET_META: { id: DashboardWidgetId; label: string; hint: string }[] = [
  { id: "stats", label: "w_stats", hint: "w_stats_hint" },
  { id: "topPerformers", label: "w_top", hint: "w_top_hint" },
  { id: "financial", label: "w_financial", hint: "w_financial_hint" },
  { id: "region", label: "w_region", hint: "w_region_hint" },
];

const SOUND_META: { id: ScannerSoundId; label: string }[] = SCANNER_SOUND_IDS.map((id) => ({
  id,
  label: `sound_${id}`,
}));

// ─── Bo'lim sarlavhasi ─────────────────────────────────────────────────────────
const SectionTitle = ({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) => (
  <div className="mb-5 flex items-center gap-3">
    <span
      className="flex h-10 w-10 items-center justify-center rounded-xl"
      style={{ background: toneSoftBg("brand", 14), color: "var(--color-main)" }}
    >
      {icon}
    </span>
    <div>
      <h3 className={`${TYPO.sectionTitle} text-maindark dark:text-primary`}>{title}</h3>
      {hint && (
        <p className="mt-0.5 text-[12px]" style={{ color: TEXT.soft }}>
          {hint}
        </p>
      )}
    </div>
  </div>
);

// ─── Mavzu tanlov kartasi (mini ko'rinish bilan) ───────────────────────────────
const ThemeChoiceCard = ({
  mode,
  active,
  label,
  icon,
  onClick,
}: {
  mode: ThemeMode;
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) => {
  const isDark = mode === "dark";
  const previewBg = isDark ? "#211d34" : "#f4f5fa";
  const previewCard = isDark ? "#2b2741" : "#ffffff";
  const previewAccent = isDark ? "#7c3aed" : "#576adb";
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col gap-3 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: active ? "var(--color-main)" : "var(--color-border-soft)",
        background: "var(--color-card-surface)",
        boxShadow: active ? "0 8px 24px color-mix(in srgb, var(--color-main) 22%, transparent)" : "none",
      }}
    >
      {/* Mini ko'rinish */}
      <div className="overflow-hidden rounded-xl p-2.5" style={{ background: previewBg }}>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: previewAccent }} />
          <span className="h-1.5 flex-1 rounded-full" style={{ background: previewCard }} />
        </div>
        <div className="flex gap-1.5">
          <div className="h-9 flex-1 rounded-lg" style={{ background: previewCard }} />
          <div className="h-9 flex-1 rounded-lg" style={{ background: previewCard }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-maindark dark:text-primary">
          {icon}
          {label}
        </span>
        {active && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: "var(--color-main)", color: "#fff" }}
          >
            <Check size={13} />
          </span>
        )}
      </div>
    </button>
  );
};

const SoundChoiceButton = ({
  id,
  label,
  active,
  tone,
  onSelect,
  onPreview,
  selectedLabel,
}: {
  id: ScannerSoundId;
  label: string;
  active: boolean;
  tone: "success" | "error";
  onSelect: (id: ScannerSoundId) => void;
  onPreview: (id: ScannerSoundId) => void;
  selectedLabel: string;
}) => (
  <button
    type="button"
    onClick={() => onSelect(id)}
    className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5"
    style={{
      borderColor: active ? "var(--color-main)" : "var(--color-border-soft)",
      background: active ? toneSoftBg(tone === "error" ? "danger" : "success", 10) : "var(--color-card-surface)",
      boxShadow: active ? "0 8px 20px color-mix(in srgb, var(--color-main) 16%, transparent)" : "none",
    }}
  >
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: active ? "var(--color-main)" : toneSoftBg(tone === "error" ? "danger" : "success", 14),
          color: active ? "#fff" : tone === "success" ? "var(--color-success)" : "var(--color-danger)",
        }}
      >
        <Volume2 size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-maindark dark:text-primary">{label}</span>
        {active ? (
          <span className="mt-0.5 block text-[11px] font-semibold text-main">{selectedLabel}</span>
        ) : null}
      </span>
    </span>
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onPreview(id);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onPreview(id);
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:border-main hover:text-main"
      style={{
        borderColor: "var(--color-border-soft)",
        color: "var(--color-dashboard-text-muted)",
      }}
      aria-label={label}
    >
      {active ? <Check size={16} /> : <Play size={15} />}
    </span>
  </button>
);

const SettingsPage = () => {
  const { t, i18n } = useTranslation("settings");
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();
  const sidebarOpen = useSelector((s: RootState) => s.sidebar.isOpen);

  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  const { data } = useSettings();
  const settings: AppSettings = data ?? DEFAULT_SETTINGS;
  const update = useUpdateSettings();

  const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) as Language;

  const persist = (patch: AppSettingsPatch) => update.mutate(patch);

  const onTheme = (next: ThemeMode) => {
    setTheme(next);
    persist({ appearance: { theme: next } });
  };
  const onLanguage = (next: Language) => {
    void changeAppLanguage(next);
    persist({ appearance: { language: next } });
  };
  const onWidget = (id: DashboardWidgetId, visible: boolean) => {
    persist({ dashboard: { widgets: { [id]: visible } } });
  };
  const onSidebar = (open: boolean) => {
    dispatch(setSidebar(open));
    persist({ interface: { sidebarOpen: open } });
  };
  const onScannerSound = (type: "success" | "error", sound: ScannerSoundId) => {
    if (type === "success") writeStoredScannerSuccessSound(sound);
    else writeStoredScannerErrorSound(sound);
    persist({ scanner: { sounds: { [type]: sound } } });
  };
  const previewScannerSound = (type: "success" | "error", sound: ScannerSoundId) => {
    const previous = settings.scanner.sounds[type];
    if (type === "success") writeStoredScannerSuccessSound(sound);
    else writeStoredScannerErrorSound(sound);
    void playScanFeedback(type, t(`interface.${type === "success" ? "success_preview" : "error_preview"}`));
    window.setTimeout(() => {
      if (type === "success") writeStoredScannerSuccessSound(previous);
      else writeStoredScannerErrorSound(previous);
    }, 350);
  };

  return (
    <PageContainer>
      <div className="mb-5">
        <HeaderName name={t("title")} description={t("subtitle")} icon={<SettingsIcon />} />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Tab navigatsiyasi ── */}
        <nav className="el-card flex shrink-0 gap-2 overflow-x-auto rounded-2xl p-2.5 lg:w-64 lg:flex-col lg:overflow-visible">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="group flex min-w-[140px] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 lg:min-w-0"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, var(--color-main), var(--color-purple-dark))",
                        boxShadow: "0 8px 20px color-mix(in srgb, var(--color-main) 28%, transparent)",
                      }
                    : undefined
                }
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                      : { background: toneSoftBg("brand", 14), color: "var(--color-main)" }
                  }
                >
                  {tab.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color: active ? "#fff" : "var(--color-maindark)" }}
                  >
                    {t(`tabs.${tab.id}`)}
                  </p>
                  <p
                    className="mt-0.5 truncate text-[11px] leading-tight"
                    style={{ color: active ? "rgba(255,255,255,0.75)" : "var(--color-dashboard-text-soft)" }}
                  >
                    {t(`tabs_desc.${tab.id}`)}
                  </p>
                </div>
                <ChevronRight
                  size={15}
                  className="hidden shrink-0 lg:block"
                  style={{ color: active ? "rgba(255,255,255,0.8)" : "var(--color-dashboard-text-soft)" }}
                />
              </button>
            );
          })}
        </nav>

        {/* ── Tab kontenti ── */}
        <div className="min-w-0 flex-1">
          {activeTab === "appearance" && (
            <div className="space-y-4">
              <div className="el-card rounded-2xl p-5">
                <SectionTitle icon={<Palette size={18} />} title={t("appearance.theme")} hint={t("appearance.theme_hint")} />
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <ThemeChoiceCard
                    mode="light"
                    active={theme === "light"}
                    label={t("appearance.light")}
                    icon={<Sun size={15} />}
                    onClick={() => onTheme("light")}
                  />
                  <ThemeChoiceCard
                    mode="dark"
                    active={theme === "dark"}
                    label={t("appearance.dark")}
                    icon={<Moon size={15} />}
                    onClick={() => onTheme("dark")}
                  />
                </div>
              </div>

              <div className="el-card rounded-2xl p-5">
                <SectionTitle icon={<SettingsIcon size={18} />} title={t("appearance.language")} hint={t("appearance.language_hint")} />
                <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
                  {LANGUAGES.map((lang) => {
                    const active = currentLang === lang.key;
                    return (
                      <button
                        key={lang.key}
                        type="button"
                        onClick={() => onLanguage(lang.key)}
                        className="relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                          borderColor: active ? "var(--color-main)" : "var(--color-border-soft)",
                          background: active ? toneSoftBg("brand", 10) : "var(--color-card-surface)",
                          boxShadow: active ? "0 8px 20px color-mix(in srgb, var(--color-main) 18%, transparent)" : "none",
                        }}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold"
                          style={{
                            background: active ? "var(--color-main)" : toneSoftBg("brand", 14),
                            color: active ? "#fff" : "var(--color-main)",
                          }}
                        >
                          {lang.native}
                        </span>
                        <span className="text-[12px] font-semibold text-maindark dark:text-primary">
                          {lang.label}
                        </span>
                        {active && (
                          <span
                            className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ background: "var(--color-main)", color: "#fff" }}
                          >
                            <Check size={11} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="el-card rounded-2xl p-5">
              <SectionTitle
                icon={<LayoutDashboard size={18} />}
                title={t("dashboard.widgets")}
                hint={t("dashboard.widgets_hint")}
              />
              <div className="space-y-2.5">
                {WIDGET_META.map((w) => {
                  const visible = settings.dashboard.widgets[w.id];
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-colors"
                      style={{
                        borderColor: visible ? "var(--color-border-strong)" : "var(--color-border-soft)",
                        background: visible ? toneSoftBg("brand", 6) : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{
                            background: toneSoftBg(visible ? "success" : "neutral", 14),
                            color: visible ? "var(--color-success)" : "var(--color-dashboard-text-muted)",
                          }}
                        >
                          {visible ? <Check size={16} /> : <LayoutDashboard size={16} />}
                        </span>
                        <div>
                          <p className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>
                            {t(`dashboard.${w.label}`)}
                          </p>
                          <p className="mt-0.5 text-[12px]" style={{ color: TEXT.soft }}>
                            {t(`dashboard.${w.hint}`)}
                          </p>
                        </div>
                      </div>
                      <Toggle checked={visible} onChange={(v) => onWidget(w.id, v)} aria-label={t(`dashboard.${w.label}`)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "interface" && (
            <div className="space-y-4">
              <div className="el-card rounded-2xl p-5">
                <SectionTitle icon={<PanelLeft size={18} />} title={t("tabs.interface")} hint={t("tabs_desc.interface")} />
                <div
                  className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5"
                  style={{ borderColor: "var(--color-border-soft)" }}
                >
                  <div>
                    <p className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>{t("interface.sidebar")}</p>
                    <p className="mt-0.5 text-[12px]" style={{ color: TEXT.soft }}>
                      {t("interface.sidebar_hint")}
                    </p>
                  </div>
                  <Toggle checked={sidebarOpen} onChange={onSidebar} aria-label={t("interface.sidebar")} />
                </div>
              </div>

              <div className="el-card rounded-2xl p-5">
                <SectionTitle icon={<Volume2 size={18} />} title={t("interface.scanner_sounds")} hint={t("interface.scanner_sounds_hint")} />
                <div className="grid gap-5 xl:grid-cols-2">
                  {(["success", "error"] as const).map((type) => (
                    <div key={type} className="rounded-2xl border p-3" style={{ borderColor: "var(--color-border-soft)" }}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className={`${TYPO.cardTitle} text-maindark dark:text-primary`}>
                            {t(`interface.${type}_sound`)}
                          </p>
                          <p className="mt-0.5 text-[12px]" style={{ color: TEXT.soft }}>
                            {t(`interface.${type}_sound_hint`)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => previewScannerSound(type, settings.scanner.sounds[type])}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors hover:border-main hover:text-main"
                          style={{ borderColor: "var(--color-border-soft)", color: "var(--color-dashboard-text-muted)" }}
                        >
                          <Play size={14} />
                          {t("interface.preview")}
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {SOUND_META.map((sound) => (
                          <SoundChoiceButton
                            key={`${type}-${sound.id}`}
                            id={sound.id}
                            label={t(`interface.${sound.label}`)}
                            active={settings.scanner.sounds[type] === sound.id}
                            tone={type}
                            onSelect={(id) => onScannerSound(type, id)}
                            onPreview={(id) => previewScannerSound(type, id)}
                            selectedLabel={t("interface.selected")}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && <ProfileTab />}
        </div>
      </div>
    </PageContainer>
  );
};

// ─── Profil tabi ───────────────────────────────────────────────────────────────
const ProfileTab = memo(() => {
  const { useGetMyProfile } = useUser();
  const { data, isLoading, isError, error } = useGetMyProfile();
  const user = unwrapUserResponse(data);
  return (
    <UserDetailWidget user={user} isLoading={isLoading} isError={isError} error={error} isOwnProfile />
  );
});
ProfileTab.displayName = "ProfileTab";

export default memo(SettingsPage);
