// dizayn-v2: common-settings-appearance, common-settings-dashboard, common-settings-interface, common-settings-scanner, common-settings-notifications
import { memo, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Bell,
  CircleAlert,
  CircleCheck,
  House,
  Palette,
  PanelLeft,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { useTheme } from "../../../app/providers/theme/ThemeContext";
import type { RootState } from "../../../app/config/store";
import {
  DEFAULT_SETTINGS,
  useSettings,
  useUpdateSettings,
  type AppSettings,
  type AppSettingsPatch,
  type DashboardWidgetId,
  type Language,
  type ScannerSoundId,
  type ThemeMode,
} from "../../../entities/settings";
import { changeAppLanguage, normalizeLanguage } from "../../../i18n";
import { cx } from "../../../shared/lib/cx";
import {
  writeStoredScannerCameraPrefs,
  writeStoredScannerErrorSound,
  writeStoredScannerFeedbackPrefs,
  writeStoredScannerSuccessSound,
} from "../../../shared/lib/preferencesStorage";
import {
  Card,
  getPanelId,
  getTabId,
  PageHeader,
  Pressable,
  Spinner,
  Tabs,
} from "../../../shared/ui/primitives";
import { setSidebar } from "../../../widgets/Sidebar/model/sidebarSlice";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { AppearancePanel } from "./AppearancePanel";
import { DashboardPanel } from "./DashboardPanel";
import { InterfacePanel } from "./InterfacePanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { ScannerPanel } from "./ScannerPanel";

export type SettingsTabId = "appearance" | "dashboard" | "interface" | "scanner" | "notifications";

const TABS: { id: SettingsTabId; icon: LucideIcon }[] = [
  { id: "appearance", icon: Palette },
  { id: "dashboard", icon: House },
  { id: "interface", icon: PanelLeft },
  { id: "scanner", icon: Volume2 },
  { id: "notifications", icon: Bell },
];

const isTabId = (value: unknown): value is SettingsTabId => TABS.some((tab) => tab.id === value);

/** `/settings` ga boshqa sahifadan aniq bo'lim bilan kelish (`/inbox` → «Qanday yoqiladi»): router `state.tab`. */
const readInitialTab = (state: unknown): SettingsTabId => {
  const tab = (state as { tab?: unknown } | null)?.tab;
  return isTabId(tab) ? tab : "appearance";
};

/** Sarlavhadagi avto-saqlash holati: «Saqlandi» / «Saqlanmoqda…» / «Saqlashda xatolik». */
const SaveStatus = ({ pending, failed }: { pending: boolean; failed: boolean }) => {
  const { t } = useTranslation("settings");
  return (
    <p role="status" className="inline-flex items-center gap-2 text-[13px] text-text-muted">
      {pending ? (
        <Spinner size="sm" />
      ) : failed ? (
        <CircleAlert size={16} aria-hidden="true" className="text-danger-fg" />
      ) : (
        <CircleCheck size={16} aria-hidden="true" className="text-success-fg" />
      )}
      <span className={cx("font-semibold", failed && !pending ? "text-danger-fg" : "text-text")}>
        {pending ? t("saving") : failed ? t("save_error") : t("saved")}
      </span>
    </p>
  );
};

/**
 * SOZLAMALAR (`/settings`, barcha rollar) — maketlar `common-settings-{appearance,dashboard,interface,scanner,
 * notifications}`.
 *
 * Desktop (≥ 1024): chapda bo'limlar kartasi (vertikal `tablist`: ikonka + nom + izoh), o'ngda panel kartasi.
 * Planshet va telefon: sarlavha ostida gorizontal `Tabs` (aylanadi). Tanlangan bo'lim komponent holatida
 * (URL'da emas — avvalgidek); boshqa sahifadan `state.tab` bilan ochish mumkin.
 *
 * Avto-saqlash `persist()` o'zgarmagan: har tanlov `useUpdateSettings().mutate(patch)` (optimistik, navbatli);
 * holati sarlavhada. Mavzu va til darhol qo'llanadi; yon panel `setSidebar`; skaner ovozi localStorage + persist.
 */
const SettingsPage = () => {
  const { t, i18n } = useTranslation("settings");
  const dispatch = useDispatch();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const sidebarOpen = useSelector((s: RootState) => s.sidebar.isOpen);
  const role = useSelector((s: RootState) => s.role.role);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => readInitialTab(location.state));
  const idPrefix = useId();
  const navRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const { data } = useSettings();
  const settings: AppSettings = data ?? DEFAULT_SETTINGS;
  const update = useUpdateSettings();

  const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) as Language;

  const persist = (patch: AppSettingsPatch) => update.mutate(patch);

  const onTheme = (next: ThemeMode) => {
    setTheme(next);
    // `themeChosen` — aniq tanlov belgisi (entities/settings mergeSettings).
    persist({ appearance: { theme: next, themeChosen: true } });
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
  /** Kamera sozlamasi: qurilmadagi ko'zgu darhol (keyingi ochilgan kamera o'qiydi) + hisobga. */
  const onScannerCamera = (patch: Partial<AppSettings["scanner"]["camera"]>) => {
    writeStoredScannerCameraPrefs(patch);
    persist({ scanner: { camera: patch } });
  };
  const onScannerFeedback = (patch: Partial<AppSettings["scanner"]["feedback"]>) => {
    writeStoredScannerFeedbackPrefs(patch);
    persist({ scanner: { feedback: patch } });
  };
  /** Faqat chaladi: vaqtincha shu ovozni yozadi, 350 ms dan keyin saqlangan tanlov qaytadi. */
  const previewScannerSound = (type: "success" | "error", sound: ScannerSoundId) => {
    const previous = settings.scanner.sounds[type];
    if (type === "success") writeStoredScannerSuccessSound(sound);
    else writeStoredScannerErrorSound(sound);
    // «Ovoz» kaliti o'chiq bo'lsa ham eshittiriladi — foydalanuvchi ohangni aniq so'radi.
    void playScanFeedback(
      type,
      t(`scanner.${type === "success" ? "success_preview" : "error_preview"}`),
      undefined,
      { preview: true },
    );
    window.setTimeout(() => {
      if (type === "success") writeStoredScannerSuccessSound(previous);
      else writeStoredScannerErrorSound(previous);
    }, 350);
  };

  // Menejerning bosh sahifasi — `/branch-dashboard` (`routes.tsx` → `DashboardEntry`).
  const homePath = role === "manager" ? "/branch-dashboard" : "/";

  /** Vertikal tablist: ↑ ↓ Home End (WAI-ARIA tabs, avtomatik faollashtirish). */
  const onNavKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: index === last ? 0 : index + 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setActiveTab(TABS[target].id);
    navRefs.current[target]?.focus();
  };

  const panelId = getPanelId(idPrefix, activeTab);

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<SaveStatus pending={update.isPending} failed={update.isError} />}
      />

      <Tabs
        className="lg:hidden"
        ariaLabel={t("nav_label")}
        items={TABS.map((tab) => ({ value: tab.id, label: t(`tabs.${tab.id}`) }))}
        value={activeTab}
        onValueChange={setActiveTab}
        idPrefix={idPrefix}
        controlsPanel
        background="bg"
      />

      <div className="flex items-start gap-6">
        <Card
          as="div"
          padding="none"
          className="sticky top-6 w-[272px] flex-none p-2 max-lg:hidden"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("nav_label")}
            className="flex flex-col gap-1"
          >
            {TABS.map(({ id, icon: Icon }, index) => {
              const selected = activeTab === id;
              return (
                <Pressable
                  key={id}
                  ref={(element) => {
                    navRefs.current[index] = element;
                  }}
                  role="tab"
                  id={`${idPrefix}-nav-${id}`}
                  aria-selected={selected}
                  aria-controls={selected ? panelId : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                  onKeyDown={(event) => onNavKeyDown(event, index)}
                  className={cx(
                    "flex min-h-14 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-sm font-semibold",
                    "transition-[background-color,color] duration-150 motion-reduce:transition-none",
                    selected ? "bg-action-soft text-action-fg" : "text-text hover:bg-sunken",
                  )}
                >
                  <Icon
                    size={20}
                    aria-hidden="true"
                    className={cx("shrink-0", selected ? "" : "text-text-subtle")}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span>{t(`tabs.${id}`)}</span>
                    <span className="text-xs font-medium text-text-muted">
                      {t(`tabs_desc.${id}`)}
                    </span>
                  </span>
                </Pressable>
              );
            })}
          </div>
        </Card>

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={getTabId(idPrefix, activeTab)}
          className="min-w-0 flex-1"
        >
          {activeTab === "notifications" ? (
            <NotificationsPanel settings={settings.notifications} persist={persist} />
          ) : (
            <Card padding="none">
              {activeTab === "appearance" ? (
                <AppearancePanel
                  theme={theme}
                  language={currentLang}
                  onTheme={onTheme}
                  onLanguage={onLanguage}
                />
              ) : activeTab === "dashboard" ? (
                <DashboardPanel
                  widgets={settings.dashboard.widgets}
                  homePath={homePath}
                  onWidget={onWidget}
                />
              ) : activeTab === "interface" ? (
                <InterfacePanel sidebarOpen={sidebarOpen} onSidebar={onSidebar} />
              ) : (
                <ScannerPanel
                  sounds={settings.scanner.sounds}
                  camera={settings.scanner.camera}
                  feedback={settings.scanner.feedback}
                  // Market skanerlamaydi — `/scan` unda bo'sh holat.
                  canTestCamera={role !== "market"}
                  onSelect={onScannerSound}
                  onPreview={previewScannerSound}
                  onCamera={onScannerCamera}
                  onFeedback={onScannerFeedback}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(SettingsPage);
