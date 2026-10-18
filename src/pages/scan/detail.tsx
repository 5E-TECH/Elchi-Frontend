// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { QueryBoundary } from "../../shared/ui/primitives";
import { normalizeOrderDetail, type OrderDetail } from "../new_orders/components/detail/orderDetailModel";
import { fetchScanDetail, getScanDetailQueryKey, getScanResourceType, type ScanResourceType } from "./lib/scanResource";
import { extractScannerToken, playScanFeedback } from "./lib/scanShared";
import { buildScanPackageView, buildScanPostView } from "./model/scanBatchView";
import { getScanRoleKind } from "./model/scanOrderView";
import { ScanAlert } from "./ui/ScanAlert";
import { ScanOrderResult } from "./ui/ScanOrderResult";
import ScanPackageDetail from "./ui/ScanPackageDetail";
import ScanPostDetail from "./ui/ScanPostDetail";
import { ScanLoadingCard, ScanNotFoundCard } from "./ui/ScanStates";

/** Skan javobi → sahifa tanasi; `null` — javob keldi, lekin ichida ma'lumot yo'q («topilmadi»). */
type ResolvedScan =
  | { kind: "order"; order: OrderDetail }
  | { kind: "package"; data: unknown; type: ScanResourceType }
  | { kind: "post"; data: unknown };

const resolveScan = (response: { type: ScanResourceType; data: unknown } | undefined): ResolvedScan | null | undefined => {
  if (!response) return undefined;
  if (response.type === "package" || response.type === "returned-package") {
    return buildScanPackageView(response.data, response.type) ? { kind: "package", data: response.data, type: response.type } : null;
  }
  if (response.type === "post") {
    return buildScanPostView(response.data) ? { kind: "post", data: response.data } : null;
  }
  const order = normalizeOrderDetail(response.data);
  return order ? { kind: "order", order } : null;
};

/**
 * SKANER NATIJASI — `/scan/:token` (dizayn v2). Kamera ekrani (`/scan`) — alohida ish, bu yerda emas.
 *
 * Token turi bo'yicha (`getScanResourceType`): buyurtma (`GET orders/qr-code/:token`), paket `BTB-` /
 * qaytarilgan paket `BTR-` (`GET scan/:token`), pochta `PST-` (`GET post/scan/:id`). Ko'rinishlar —
 * `ui/ScanOrderResult` (rol bo'yicha mazmun), `ui/ScanPackageDetail`, `ui/ScanPostDetail`; holatlar —
 * yuklanish va «… topilmadi» kartasi («Qayta urinish» + «Skanerga qaytish»).
 *
 * USB (HID) skaner sahifa ochiq turganda ham ishlaydi: yangi token — o'sha posilka ochiladi; shu token —
 * «takror» ovozi; yaroqsiz QR — xato ovozi va tepada ogohlantirish (keyingi to'g'ri skangacha); biror amal
 * so'rovi ketayotgan bo'lsa — «kuting» va o'tilmaydi (natija operatorga ko'rinmay qolmasin). Sotish/bekor
 * oynasi ochiq turganda skaner to'xtaydi. Natija bloki token bilan qayta o'rnatiladi (`key`) — eski
 * sahifaning «skanerga qaytish» taymeri yangi posilkada ishlab ketmaydi.
 */
const ScanDetailPage = () => {
  const { t } = useTranslation("scan");
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const normalizedToken = extractScannerToken(token) ?? token.trim();
  const resourceType = getScanResourceType(normalizedToken);
  const role = useSelector((state: RootState) => state.role.role);
  const roleKind = getScanRoleKind(role);
  const textKey = resourceType === "package" || resourceType === "returned-package" ? "package" : resourceType;

  const query = useQuery({
    queryKey: getScanDetailQueryKey(normalizedToken),
    queryFn: () => fetchScanDetail(normalizedToken),
    enabled: Boolean(normalizedToken),
    // Sahifaning o'zi «… topilmadi» kartasini ko'rsatadi — global xato xabari (backend matni) takrorlanmaydi.
    meta: { silentError: true },
  });
  const resolved = useMemo(() => resolveScan(query.data), [query.data]);

  const pendingMutations = useIsMutating();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invalidScan, setInvalidScan] = useState(false);
  const [shownToken, setShownToken] = useState(normalizedToken);
  if (shownToken !== normalizedToken) {
    setShownToken(normalizedToken);
    setInvalidScan(false);
  }

  /**
   * Detal ochiq turganda HID skaneri bilan keyingi posilka skanerlansa, u JIMGINA yo'qolmasin (ilgari bu
   * sahifa skanerni umuman tinglamasdi — /scan'dan tez ketma-ket kelgan ikkinchi skan shu yerda izsiz
   * yo'qolardi): o'sha posilka ochiladi.
   */
  const handleNextScan = useCallback(
    (rawValue: string) => {
      const nextToken = extractScannerToken(rawValue, window.location.origin);
      if (!nextToken) {
        void playScanFeedback("error", t("invalidQrTitle"));
        setInvalidScan(true);
        return true;
      }
      if (nextToken === normalizedToken) {
        void playScanFeedback("duplicate");
        setInvalidScan(false);
        return true;
      }
      if (pendingMutations > 0) {
        // «O'zimga olish» yoki paketni qabul qilish so'rovi tugamasdan sahifadan ketilsa, natijasi
        // operatorga ko'rinmay qolardi.
        void playScanFeedback("error", t("waitForAction"));
        return true;
      }
      void playScanFeedback("success");
      setInvalidScan(false);
      navigate(`/scan/${encodeURIComponent(nextToken)}`);
      return true;
    },
    [navigate, normalizedToken, pendingMutations, t],
  );

  useKeyboardScanner({ enabled: !dialogOpen, onScan: handleNextScan });

  useEffect(() => {
    if (query.isError) {
      void playScanFeedback("error");
    }
  }, [query.isError]);

  const { refetch: refetchScan } = query;
  const refetch = useCallback(() => {
    void refetchScan();
  }, [refetchScan]);

  const invalidAlert: ReactNode = invalidScan ? (
    <ScanAlert tone="danger" icon={TriangleAlert} role="alert" title={t("invalidQrTitle")} data-testid="scan-invalid-qr">
      {t("invalidQrText")}
    </ScanAlert>
  ) : null;

  const notFound = (retry: () => void) => (
    <div className="flex flex-col gap-4">
      {invalidAlert}
      <ScanNotFoundCard
        title={t(`${textKey}.notFoundTitle`)}
        text={t(`${textKey}.notFoundText`)}
        onRetry={retry}
        retrying={query.isFetching}
      />
    </div>
  );

  return (
    <QueryBoundary<ResolvedScan>
      query={{
        data: resolved,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        isFetching: query.isFetching,
        refetch: refetchScan,
      }}
      keepPreviousData={false}
      loadingLabel={t(`${textKey}.loading`)}
      loading={
        <div className="flex flex-col gap-4">
          {invalidAlert}
          <ScanLoadingCard text={t(`${textKey}.loading`)} />
        </div>
      }
      empty={notFound(refetch)}
      error={(_error, retry) => notFound(retry)}
    >
      {(scan) => {
        if (scan.kind === "package") {
          return (
            <ScanPackageDetail
              key={normalizedToken}
              data={scan.data}
              type={scan.type}
              roleKind={roleKind}
              topNotice={invalidAlert}
            />
          );
        }
        if (scan.kind === "post") {
          return <ScanPostDetail key={normalizedToken} data={scan.data} topNotice={invalidAlert} />;
        }
        return (
          <ScanOrderResult
            key={normalizedToken}
            order={scan.order}
            token={normalizedToken}
            roleKind={roleKind}
            topNotice={invalidAlert}
            onChanged={refetch}
            onDialogOpenChange={setDialogOpen}
          />
        );
      }}
    </QueryBoundary>
  );
};

export default memo(ScanDetailPage);
