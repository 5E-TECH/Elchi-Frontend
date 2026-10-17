// dizayn-v2: courier-scan-package-detail
import { memo, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Building2, Check, CircleCheck, MapPin, Package, ScanLine, TriangleAlert, Truck, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BATCH_STATUS_TONE, useBatchDetail } from "../../../entities/batch";
import { formatMoneyLocalized, formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { Badge, Button, buttonClasses } from "../../../shared/ui/primitives";
import { receiveScannedPackage, type ScanResourceType } from "../lib/scanResource";
import { SCANNER_ROUTE } from "../model/routes";
import { buildScanPackageView, getPackageReceiveError, type ScanPackageView } from "../model/scanBatchView";
import type { ScanRoleKind } from "../model/scanOrderView";
import { useScanRedirect } from "../model/useScanRedirect";
import { useIsBelowLg, useIsBelowMd } from "../model/useViewport";
import { ScanActionCard } from "./ScanActionCard";
import { ScanAlert } from "./ScanAlert";
import { ScanBatchSummary } from "./ScanBatchSummary";
import { ScanOrdersCard } from "./ScanOrdersCard";
import { ScanResultHeader } from "./ScanResultHeader";
import { ScanStickyBar } from "./ScanStickyBar";

interface ScanPackageDetailProps {
  data: unknown;
  type: ScanResourceType;
  roleKind: ScanRoleKind;
  topNotice?: ReactNode;
}

type ReceiveResult = { tone: "success" | "error"; text: string };

/**
 * «Qabul qilish» (`POST transfer-batches/:id/receive`) backendda faqat SUPERADMIN · ADMIN · BRANCH · MANAGER ·
 * REGISTRATOR uchun (`branch-gateway.controller.ts`). Kuryerga u doim 403 — maketdagi tugma kuryerga
 * chizilmaydi (spec G3 §2.4, Q5 sukut): paket faqat ko'rish uchun.
 */
const canReceivePackage = (roleKind: ScanRoleKind) => roleKind === "staff" || roleKind === "manager";

const PackageBody = ({
  view,
  canReceive,
  topNotice,
}: {
  view: ScanPackageView;
  canReceive: boolean;
  topNotice?: ReactNode;
}) => {
  const { t, i18n } = useTranslation(["scan", "newOrders"]);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isBelowLg = useIsBelowLg();
  const isPhone = useIsBelowMd();
  const scheduleRedirect = useScanRedirect(2000);
  const [result, setResult] = useState<ReceiveResult | null>(null);

  const receiveMutation = useMutation({
    mutationFn: () => receiveScannedPackage(view.id),
    onSuccess: () => {
      setResult({ tone: "success", text: t("package.receiveSuccess") });
      // Skaner bilan keyingi posilka ochilsa (bu blok yangi token bilan qayta o'rnatiladi) — taymer bekor.
      scheduleRedirect();
    },
    onError: (error) => {
      const { key, message } = getPackageReceiveError(error);
      setResult({ tone: "error", text: message ?? t(`package.${key}`) });
    },
  });

  const title = t(view.returned ? "package.returnedTitle" : "package.title", { code: view.code });
  const ordersText = t("ordersCount", { count: view.ordersCount, value: formatNumberLocalized(view.ordersCount, { language }) });
  const resultAlert = result ? (
    <ScanAlert
      tone={result.tone === "success" ? "success" : "danger"}
      icon={result.tone === "success" ? CircleCheck : TriangleAlert}
      title={result.text}
      role={result.tone === "success" ? "status" : "alert"}
    />
  ) : null;
  const receiveButton = (block: boolean) => (
    <Button
      size="lg"
      fullWidth={block}
      leftIcon={Check}
      loading={receiveMutation.isPending}
      loadingText={t("package.receiving")}
      disabled={result?.tone === "success"}
      onClick={() => receiveMutation.mutate()}
    >
      {t("package.receive")}
    </Button>
  );

  const statusBadge = view.status ? (
    <>
      <span className="sr-only">{t("statusLabel")}</span>
      <Badge tone={BATCH_STATUS_TONE[view.status]} dot>
        {t(`batchStatus.${view.status}`, { ns: "newOrders" })}
      </Badge>
    </>
  ) : null;

  let aside: ReactNode = null;
  let sticky: ReactNode = null;
  if (canReceive) {
    if (isBelowLg) {
      sticky = (
        <ScanStickyBar
          summary={{
            title: t("package.summaryLine", { code: view.code, orders: ordersText }),
            sub: [formatMoneyLocalized(view.total, { language }), view.fromBranch].filter(Boolean).join(" · "),
          }}
          notice={resultAlert}
        >
          {receiveButton(false)}
        </ScanStickyBar>
      );
    } else {
      aside = (
        <ScanActionCard title={t("package.actionTitle")} text={t("package.actionText")}>
          {resultAlert}
          {receiveButton(true)}
        </ScanActionCard>
      );
    }
  } else if (isPhone) {
    sticky = (
      <ScanStickyBar>
        <Link to={SCANNER_ROUTE} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          <ScanLine size={18} aria-hidden="true" className="shrink-0" />
          {t("backToScanner")}
        </Link>
      </ScanStickyBar>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <ScanResultHeader
        icon={Package}
        title={title}
        phoneTitle={title}
        phoneSub={t("package.phoneSub")}
        sub={t("package.sub")}
        alertText={t("package.alertText")}
      />
      {topNotice}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <ScanBatchSummary
            title={t("package.summary")}
            badge={statusBadge}
            date={view.createdAt}
            total={view.total}
            meta={[
              { key: "from", icon: Building2, label: t("package.fromBranch"), value: view.fromBranch },
              { key: "to", icon: MapPin, label: t("package.destination"), value: view.destinationRegion },
              { key: "driver", icon: User, label: t("package.driver"), value: view.driver },
              { key: "vehicle", icon: Truck, label: t("package.vehicle"), value: view.vehicle },
            ]}
          />
          <ScanOrdersCard
            title={t("package.ordersTitle")}
            rows={view.orders}
            count={view.ordersCount}
            emptyText={t("package.ordersEmpty")}
          />
        </div>
        {aside ? (
          <aside aria-label={t("package.actionTitle")} className="min-w-0 flex-[1_1_360px]">
            {aside}
          </aside>
        ) : null}
      </div>
      {sticky}
    </div>
  );
};

/**
 * Skanerlangan paket (`BTB-…`) yoki qaytarilgan paket (`BTR-…`) — maket `courier-scan-package-detail`.
 * Xodimda paket tafsiloti (`GET transfer-batches/:id`) filial/viloyat nomlari va ichidagi buyurtmalarning
 * mijozi bilan to'ldiradi; kuryer faqat skan javobini ko'radi (backend unga tafsilotni bermaydi).
 */
const ScanPackageDetail = ({ data, type, roleKind, topNotice }: ScanPackageDetailProps) => {
  const canReceive = canReceivePackage(roleKind);
  const scanView = useMemo(() => buildScanPackageView(data, type), [data, type]);
  const batchDetail = useBatchDetail(canReceive && scanView ? scanView.id : undefined);
  const view = useMemo(
    () => (scanView ? (buildScanPackageView(data, type, batchDetail.data) ?? scanView) : null),
    [batchDetail.data, data, scanView, type],
  );

  if (!view) return null;
  return <PackageBody view={view} canReceive={canReceive} topNotice={topNotice} />;
};

export default memo(ScanPackageDetail);
