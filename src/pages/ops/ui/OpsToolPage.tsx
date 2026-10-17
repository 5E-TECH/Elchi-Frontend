// dizayn-v2: superadmin-ops-finance-operators, superadmin-ops-integrations, superadmin-ops-investors, superadmin-ops-logistics, superadmin-ops-branches, superadmin-ops-identity, superadmin-ops-system, superadmin-ops-auth-diagnostics
import { Component, useId, type ErrorInfo, type ReactNode } from "react";
import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../shared/lib/cx";
import { Card, ErrorState, PageHeader, TONE_SOFT } from "../../../shared/ui/primitives";
import { getOpsTab, opsTabPath } from "../tabs";

/**
 * OPS VOSITALARI — umumiy ramka (`§7.4`).
 *
 * Har `*-ops` sahifa ikki joyda chiziladi:
 *  - hub ichida (`/ops?tab=<key>`, `embedded`) — sarlavhasiz, faqat panel (sarlavha «Ops vositalari» hub'da);
 *  - o'z eski yo'lida (`/finance-operators` …) — `PageHeader` (tab nomi) + «← Ops vositalari» → `/ops?tab=<key>`.
 * Ikkala holatda ildiz — shell kontent slotidagi bo'limlar oralig'i (tashqi karta/chekka yo'q).
 */
export const OpsToolPage = ({
  tabKey,
  embedded = false,
  children,
}: {
  tabKey: string;
  embedded?: boolean;
  children: ReactNode;
}) => {
  const { t } = useTranslation("ops");
  if (embedded) return <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">{children}</div>;
  const tab = getOpsTab(tabKey);
  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <PageHeader title={t(tab.labelKey)} back={opsTabPath(tab.key)} backLabel={t("hub.back")} />
      {children}
    </div>
  );
};

/** Tab kirish kartasi (maket `#tool-title`): sarlavha + izoh, o'ngda ixtiyoriy holat bloki. */
export const OpsIntro = ({ title, description, aside }: { title: ReactNode; description: ReactNode; aside?: ReactNode }) => {
  const titleId = useId();
  return (
    <Card aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <h2 id={titleId} className="text-base font-bold text-text">
            {title}
          </h2>
          <div className="text-[13px] leading-[18px] text-text-muted">{description}</div>
        </div>
        {aside}
      </div>
    </Card>
  );
};

export type OpsAlertTone = "info" | "success" | "warning" | "danger";

const ALERT_ICON: Record<OpsAlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

/** Natija ogohlantirishi (`.el-alert`, CODE-MAP 2.7): ton foni, ikonka, qalin sarlavha, 13 px izoh. */
export const OpsAlert = ({
  tone,
  title,
  children,
  className,
}: {
  tone: OpsAlertTone;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) => {
  const Icon = ALERT_ICON[tone];
  const hasBody = children !== undefined && children !== null && children !== false && children !== "";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cx("flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 text-sm", TONE_SOFT[tone], className)}
    >
      <Icon size={18} aria-hidden="true" className="mt-px shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text">
        <div className="font-bold">{title}</div>
        {hasBody ? <div className="text-[13px] leading-[18px] text-text-muted wrap-anywhere">{children}</div> : null}
      </div>
    </div>
  );
};

/** Bitta tab yiqilsa xato faqat o'sha tab o'rnida (hub va boshqa tablar ishlaydi; `/runtime-error` ga otilmaydi). */
type BoundaryProps = { children: ReactNode; title: string; description: string; retryLabel: string };

export class OpsTabBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  public state = { hasError: false };

  public static getDerivedStateFromError() {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("Ops bo'limi xatosi:", error, info);
  }

  public render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card>
        <ErrorState
          kind="section"
          title={this.props.title}
          description={this.props.description}
          retryLabel={this.props.retryLabel}
          onRetry={() => this.setState({ hasError: false })}
        />
      </Card>
    );
  }
}
