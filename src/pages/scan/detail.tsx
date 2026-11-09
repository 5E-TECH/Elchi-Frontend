// dizayn-v2: superadmin-scan-result, manager-scan-result, registrator-scan-result, courier-scan-order-detail, courier-scan-package-detail, courier-scan-post-detail
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import type { RootState } from "../../app/config/store";
import { readBackendRejection } from "../../shared/lib/backendReason";
import { coverageRejectionText, readQrScopeText } from "../../shared/lib/coverageReasons";
import { useKeyboardScanner } from "../../shared/lib/useKeyboardScanner";
import { QueryBoundary } from "../../shared/ui/primitives";
import { normalizeOrderDetail, type OrderDetail } from "../new_orders/components/detail/orderDetailModel";
import {
  fetchScanDetail,
  getScanDetailQueryKey,
  getScanResourceType,
  normalizeScanToken,
  type ScanResourceType,
} from "./lib/scanResource";
import { extractScannerToken } from "../../shared/lib/scanToken";
import { playScanFeedback } from "../../shared/lib/scanner/feedback";
import { buildScanPackageView, buildScanPostView } from "./model/scanBatchView";
import { buildExternalBagView } from "./model/scanExternalBagView";
import { recordScanHistory, toScanHistoryEntry } from "./model/scanHistory";
import { getScanRoleKind } from "./model/scanOrderView";
import { ScanAlert } from "./ui/ScanAlert";
import ScanExternalBagDetail from "./ui/ScanExternalBagDetail";
import ScanMarketQrNotice from "./ui/ScanMarketQrNotice";
import { ScanOrderResult } from "./ui/ScanOrderResult";
import ScanPackageDetail from "./ui/ScanPackageDetail";
import ScanPostDetail from "./ui/ScanPostDetail";
import { ScanForbiddenCard, ScanLoadingCard, ScanNotFoundCard } from "./ui/ScanStates";

/** Skan javobi → sahifa tanasi; `null` — javob keldi, lekin ichida ma'lumot yo'q («topilmadi»). */
type ResolvedScan =
  | { kind: "order"; order: OrderDetail }
  | { kind: "package"; data: unknown; type: ScanResourceType }
  | { kind: "post"; data: unknown }
  | { kind: "external-bag"; data: unknown }
  | { kind: "market-qr" };

const resolveScan = (response: { type: ScanResourceType; data: unknown } | undefined): ResolvedScan | null | undefined => {
  if (!response) return undefined;
  if (response.type === "package" || response.type === "returned-package") {
    return buildScanPackageView(response.data, response.type) ? { kind: "package", data: response.data, type: response.type } : null;
  }
  if (response.type === "post") {
    return buildScanPostView(response.data) ? { kind: "post", data: response.data } : null;
  }
  if (response.type === "external-bag") {
    return buildExternalBagView(response.data) ? { kind: "external-bag", data: response.data } : null;
  }
  if (response.type === "market-qr") return { kind: "market-qr" };
  const order = normalizeOrderDetail(response.data);
  return order ? { kind: "order", order } : null;
};

/**
 * SKANER NATIJASI — `/scan/:token` (dizayn v2). Kamera ekrani (`/scan`) — alohida ish, bu yerda emas.
 *
 * Token turi bo'yicha (`getScanResourceType`, `fetchScanDetail`): buyurtma (`GET orders/qr-code/:token`; 404 bo'lsa
 * `GET scan/:token` — tashqi qop yorlig'i), paket `BTB-` / qaytarilgan paket `BTR-` (`GET scan/:token`), pochta
 * `POST-` / `PST-` (`GET post/scan/:token`), market QR'i `MCR-` (so'rovsiz — Bekor qilinganlarga yo'naltirish).
 * Ko'rinishlar — `ui/ScanOrderResult` (rol bo'yicha mazmun), `ui/ScanPackageDetail`, `ui/ScanPostDetail`,
 * `ui/ScanExternalBagDetail`, `ui/ScanMarketQrNotice`; holatlar — yuklanish va «… topilmadi» kartasi
 * («Qayta urinish» + «Skanerga qaytish»). Ochilgan obyekt «Oxirgi skanerlar» tarixiga yoziladi (`/scan`).
 *
 * Begona QR (Elchi-Backend #620, anKpzwxk; ega Q5 sukuti): 403 `order_not_in_your_branch` / `branch_not_assigned`,
 * kuryerda pochta QR'i 403 `post_not_visible_to_courier` (va har qanday 403) — javobda ma'lumot yo'q: kulrang
 * «Bu buyurtma sizning filialingizda emas» kartasi (`ScanForbiddenCard`), faqat «Skanerga qaytish», «Qayta
 * urinish»siz; matn — `common:coverage.*` (backend matniga tarmoqlanmaymiz). 503 `branch_scope_unavailable` —
 * «Filialingizni aniqlab bo'lmadi» + «Qayta urinish». 404 va boshqa xato — avvalgidek «… topilmadi».
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
  const normalizedToken = normalizeScanToken(token);
  const resourceType = getScanResourceType(normalizedToken);
  const role = useSelector((state: RootState) => state.role.role);
  const userId = useSelector((state: RootState) => state.user.user?.id ?? null);
  const roleKind = getScanRoleKind(role);
  const textKey =
    resourceType === "package" || resourceType === "returned-package" ? "package" : resourceType === "post" ? "post" : "order";

  const query = useQuery({
    queryKey: getScanDetailQueryKey(normalizedToken),
    queryFn: () => fetchScanDetail(normalizedToken),
    enabled: Boolean(normalizedToken),
    // Sahifaning o'zi «… topilmadi» kartasini ko'rsatadi — global xato xabari (backend matni) takrorlanmaydi.
    meta: { silentError: true },
  });
  const resolved = useMemo(() => resolveScan(query.data), [query.data]);

  // «Oxirgi skanerlar · Shu qurilmada» (`/scan`): ochilgan obyekt tarixga — USB bilan shu sahifada
  // skanerlangani ham. Market QR'i yozilmaydi (`toScanHistoryEntry` → `null`).
  useEffect(() => {
    if (!resolved || resolved.kind === "market-qr") return;
    const entry = toScanHistoryEntry(normalizedToken, query.data);
    if (entry) recordScanHistory(userId, entry);
  }, [normalizedToken, query.data, resolved, userId]);

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
      const extracted = extractScannerToken(rawValue, window.location.origin);
      const nextToken = extracted ? normalizeScanToken(extracted) : null;
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
      // Keyingi skan faqat ochadi — «Bajarildi» aytilmaydi.
      void playScanFeedback("success", undefined, undefined, { voice: false });
      setInvalidScan(false);
      navigate(`/scan/${encodeURIComponent(nextToken)}`);
      return true;
    },
    [navigate, normalizedToken, pendingMutations, t],
  );

  useKeyboardScanner({ enabled: !dialogOpen, onScan: handleNextScan });

  const queryError = query.error;
  useEffect(() => {
    if (!query.isError) return;
    // Begona QR (#620): signal matnida sabab («Bu buyurtma sizning filialingizda emas»), umumiy «Xatolik» emas.
    const scope = readQrScopeText(t, queryError);
    if (scope) void playScanFeedback("error", scope.title);
    else void playScanFeedback("error");
  }, [query.isError, queryError, t]);

  const { refetch: refetchScan } = query;
  const refetch = useCallback(() => {
    void refetchScan();
  }, [refetchScan]);

  const invalidAlert: ReactNode = invalidScan ? (
    <ScanAlert tone="danger" icon={TriangleAlert} role="alert" title={t("invalidQrTitle")} data-testid="scan-invalid-qr">
      {t("invalidQrText")}
    </ScanAlert>
  ) : null;

  const notFound = (retry: () => void, texts?: { title: string; text: string }) => (
    <div className="flex flex-col gap-4">
      {invalidAlert}
      <ScanNotFoundCard
        title={texts?.title ?? t(`${textKey}.notFoundTitle`)}
        text={texts?.text ?? t(`${textKey}.notFoundText`)}
        onRetry={retry}
        retrying={query.isFetching}
      />
    </div>
  );

  const failed = (error: unknown, retry: () => void) => {
    const scope = readQrScopeText(t, error);
    // 503 `branch_scope_unavailable` — vaqtinchalik: «Qayta urinish» bilan (xuddi «topilmadi» kartasi o'rnida).
    if (scope?.retryable) return notFound(retry, { title: scope.title, text: scope.description });
    const rejection = readBackendRejection(error);
    if (scope || rejection.status === 403) {
      // Ruxsat yo'q — ma'lumotsiz, qayta urinishsiz. Sababsiz 403 — umumiy «ruxsat yo'q» sarlavhasi.
      const text =
        scope ?? coverageRejectionText(t, rejection, { context: "qr", fallbackTitle: t("ui:states.error.forbidden.title") });
      return (
        <div className="flex flex-col gap-4">
          {invalidAlert}
          <ScanForbiddenCard title={text.title} text={text.description} />
        </div>
      );
    }
    return notFound(retry);
  };

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
      error={failed}
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
        if (scan.kind === "external-bag") {
          return <ScanExternalBagDetail key={normalizedToken} data={scan.data} topNotice={invalidAlert} />;
        }
        if (scan.kind === "market-qr") {
          return (
            <div className="flex flex-col gap-4">
              {invalidAlert}
              <ScanMarketQrNotice />
            </div>
          );
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
