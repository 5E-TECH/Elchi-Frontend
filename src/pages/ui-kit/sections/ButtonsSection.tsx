import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Download,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonClasses, type ButtonSize, type ButtonVariant } from "../../../shared/ui/primitives/Button";
import { IconButton, type IconButtonVariant } from "../../../shared/ui/primitives/IconButton";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Tugmalar» bo'limi — `Button`, `IconButton` (va ular ichidagi `Spinner`) namunalari,
 * har biri kunduzgi va tungi mavzuda. Manba: `tizim-states-buttons` taxtasi (matnlar shu yerdan).
 * Hover, bosilgan va fokus holatlarini sichqoncha / Tab bilan sinab ko'ring.
 */

const SIZES: readonly ButtonSize[] = ["sm", "md", "lg"];

/** Maketdagi qatorlar tartibi: tur → namunaviy matn (va yuklanish matni). */
const VARIANT_SAMPLES: ReadonlyArray<{
  variant: ButtonVariant;
  name: string;
  text: string;
  loadingText: string;
  icon?: LucideIcon;
}> = [
  { variant: "primary", name: "primary", text: "save", loadingText: "saving" },
  { variant: "secondary", name: "secondary", text: "exportExcel", loadingText: "exporting" },
  { variant: "ghost", name: "ghost", text: "showMore", loadingText: "loadingMore" },
  { variant: "link", name: "link", text: "resend", loadingText: "resending" },
  { variant: "success", name: "success", text: "sell", loadingText: "selling" },
  { variant: "danger", name: "danger", text: "delete", loadingText: "deleting" },
  { variant: "danger-soft", name: "dangerSoft", text: "delete", loadingText: "deleting", icon: Trash2 },
];

/** Yuklanish nomi maketdan: «Yangilanmoqda», «Chek tayyorlanmoqda». */
const ICON_SAMPLES: ReadonlyArray<{ variant: IconButtonVariant; label: string; loadingLabel: string; icon: LucideIcon }> = [
  { variant: "ghost", label: "refresh", loadingLabel: "refreshing", icon: RefreshCw },
  { variant: "secondary", label: "printReceipt", loadingLabel: "preparingReceipt", icon: Printer },
  { variant: "primary", label: "create", loadingLabel: "creating", icon: Plus },
  { variant: "danger", label: "delete", loadingLabel: "deleting", icon: Trash2 },
];

const GROUP = "flex min-w-0 flex-col gap-3";
const GROUP_TITLE = "text-sm font-semibold text-text";
const NOTE = "text-[13px] text-text-muted";
/**
 * Qator: chapda nom, o'ngda namunalar. Panel kengligi ekran va yon menyuga bog'liq, shuning uchun
 * konteyner so'rovi (`@container` panelda): panel 28rem dan tor bo'lsa — ustma-ust.
 */
const ROW = "grid min-w-0 grid-cols-1 items-center gap-x-4 gap-y-2 @md:grid-cols-[minmax(0,168px)_minmax(0,1fr)]";
const ROW_NAME = "flex min-w-0 flex-col";
const SAMPLES = "flex min-w-0 flex-wrap items-center gap-2";

const Row = ({ name, code, children }: { name: string; code: string; children: ReactNode }) => (
  <div className={ROW}>
    <div className={ROW_NAME}>
      <span className="text-[13px] font-semibold text-text">{name}</span>
      <code className="break-all text-xs text-text-subtle">{code}</code>
    </div>
    <div className={SAMPLES}>{children}</div>
  </div>
);

const ButtonsPanel = () => {
  const { t } = useTranslation("ui");
  const s = (key: string) => t(`button.samples.${key}`);

  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      {/* Turlar × o'lchamlar */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.variants")}</h3>
        <p className={NOTE}>
          {SIZES.map((size) => `${t(`button.sizes.${size}`)} ${size === "sm" ? 32 : size === "md" ? 40 : 48} px`).join(" · ")}
        </p>
        {VARIANT_SAMPLES.map(({ variant, name, text, icon }) => (
          <Row key={variant} name={t(`button.variants.${name}`)} code={`variant="${variant}"`}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size} leftIcon={icon}>
                {s(text)}
              </Button>
            ))}
          </Row>
        ))}
        <p className={NOTE}>{t("button.notes.primary")}</p>
        <p className={NOTE}>{t("button.notes.danger")}</p>
      </div>

      {/* Holatlar: oddiy · yuklanmoqda · o'chirilgan */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.states")}</h3>
        <p className={NOTE}>
          {[t("button.states.default"), t("button.states.loading"), t("button.states.disabled")].join(" · ")}
        </p>
        {VARIANT_SAMPLES.map(({ variant, name, text, loadingText, icon }) => (
          <Row key={variant} name={t(`button.variants.${name}`)} code={`variant="${variant}"`}>
            <Button variant={variant} leftIcon={icon}>
              {s(text)}
            </Button>
            <Button variant={variant} leftIcon={icon} loading loadingText={s(loadingText)}>
              {s(text)}
            </Button>
            <Button variant={variant} leftIcon={icon} disabled>
              {s(text)}
            </Button>
          </Row>
        ))}
        <Row name={t("button.states.loading")} code="loading">
          <Button variant="secondary" size="sm">
            {s("save")}
          </Button>
          <Button variant="secondary" size="sm" loading>
            {s("save")}
          </Button>
        </Row>
        <p className={NOTE}>{t("button.notes.loadingNoText")}</p>
        <p className={NOTE}>{t("button.notes.states")}</p>
        <p className={NOTE}>{t("button.notes.focus")}</p>
      </div>

      {/* Ikonka va matn */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.icons")}</h3>
        <Row name={t("button.variants.primary")} code="leftIcon={Plus}">
          <Button leftIcon={Plus}>{s("create")}</Button>
          <Button leftIcon={Plus} loading loadingText={s("creating")}>
            {s("create")}
          </Button>
          <Button leftIcon={Plus} disabled>
            {s("create")}
          </Button>
        </Row>
        <Row name={t("button.variants.secondary")} code="leftIcon={Printer}">
          <Button variant="secondary" leftIcon={Download}>
            {s("exportExcel")}
          </Button>
          <Button variant="secondary" leftIcon={Printer}>
            {s("print")}
          </Button>
          <Button variant="secondary" leftIcon={Printer} loading loadingText={s("preparing")}>
            {s("print")}
          </Button>
        </Row>
        <Row name={t("button.variants.primary")} code="rightIcon={ChevronRight}">
          <Button rightIcon={ChevronRight}>{s("next")}</Button>
          <Button variant="ghost" rightIcon={ChevronDown}>
            {s("showMore")}
          </Button>
        </Row>
      </div>

      {/* O'lchamlar — taxtadagi «02 O'lchamlar» namunasi aynan: bir qatordagi tugmalar bir xil o'lchamda */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.sizes")}</h3>
        {SIZES.map((size) => (
          <Row key={size} name={t(`button.sizes.${size}`)} code={`size="${size}"`}>
            <Button size={size} leftIcon={Check}>
              {s(size === "sm" ? "apply" : size === "md" ? "save" : "accept")}
            </Button>
            <Button variant="secondary" size={size}>
              {s(size === "lg" ? "back" : "cancel")}
            </Button>
            <IconButton
              variant="secondary"
              size={size}
              label={s(size === "lg" ? "scan" : "printReceipt")}
              icon={size === "lg" ? ScanLine : Printer}
            />
          </Row>
        ))}
        {/*
          Ixcham — maket `superadmin-orders-list` sarlavhasidagi juftlik. Telefon kontent kengligida
          (390 − 2×16 = 358px), har tugma teng bo'lak — `PageHeader` amallar qatori kabi.
        */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className={ROW_NAME}>
            <span className="text-[13px] font-semibold text-text">{t("button.sizes.compact")}</span>
            <code className="break-all text-xs text-text-subtle">compact</code>
          </div>
          <div className="flex w-full max-w-[358px] flex-wrap gap-2 [&>*]:flex-1">
            <Button variant="secondary" compact leftIcon={Download}>
              {s("exportExcel")}
            </Button>
            <Button compact leftIcon={Plus}>
              {s("createOrder")}
            </Button>
          </div>
        </div>
        <p className={NOTE}>{t("button.notes.compact")}</p>
      </div>

      {/* Telefon: to'liq kenglik */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.block")}</h3>
        <Button size="lg" fullWidth leftIcon={Check}>
          {s("accept")}
        </Button>
        <Button size="lg" fullWidth leftIcon={Check} loading loadingText={s("accepting")}>
          {s("accept")}
        </Button>
        <div className="flex min-w-0 gap-3">
          <Button variant="danger-soft" size="lg" leftIcon={X}>
            {s("cancel")}
          </Button>
          <Button variant="success" size="lg" leftIcon={Check} className="flex-1">
            {s("sell")}
          </Button>
        </div>
        <Button size="lg" fullWidth leftIcon={CircleCheck} disabled>
          {s("finishDay")}
        </Button>
        <p className={NOTE}>{t("button.notes.block")}</p>
      </div>

      {/* Ikonka tugma */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.iconButtons")}</h3>
        <p className={NOTE}>
          {[
            ...SIZES.map((size) => `${t(`button.sizes.${size}`)} ${size === "sm" ? 32 : size === "md" ? 40 : 44} px`),
            `${t("button.states.loading")}`,
            `${t("button.states.disabled")}`,
          ].join(" · ")}
        </p>
        {ICON_SAMPLES.map(({ variant, label, loadingLabel, icon }) => (
          <Row key={variant} name={t(`button.iconVariants.${variant}`)} code={`variant="${variant}"`}>
            {SIZES.map((size) => (
              <IconButton key={size} variant={variant} size={size} label={s(label)} icon={icon} />
            ))}
            <IconButton variant={variant} label={s(label)} loadingLabel={s(loadingLabel)} icon={icon} loading />
            <IconButton variant={variant} label={s(label)} icon={icon} disabled />
          </Row>
        ))}
        <p className={NOTE}>{t("button.notes.iconButton")}</p>
      </div>

      {/* Havola tugma ko'rinishida (`buttonClasses`) */}
      <div className={GROUP}>
        <h3 className={GROUP_TITLE}>{t("button.groups.asLink")}</h3>
        <Row name={t("button.variants.link")} code="buttonClasses()">
          <Link to="/ops" className={buttonClasses({ variant: "secondary" })}>
            <ArrowLeft aria-hidden="true" size={18} />
            {s("back")}
          </Link>
          <Link to="/ops/ui-kit?section=buttons" className={buttonClasses({ variant: "link" })}>
            {s("showMore")}
          </Link>
        </Row>
        <p className={NOTE}>{t("button.notes.asLink")}</p>
      </div>
    </div>
  );
};

export const ButtonsSection = () => {
  const { t } = useTranslation("ui");
  return (
    <KitSection
      id="buttons"
      title={t("kit.sections.buttons.title")}
      description={t("kit.sections.buttons.description")}
    >
      <ThemePair>
        <ButtonsPanel />
      </ThemePair>
    </KitSection>
  );
};
