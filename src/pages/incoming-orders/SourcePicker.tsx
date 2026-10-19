// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources, registrator-new-orders-incoming-sources
import { memo, useMemo } from "react";
import { Inbox, Info, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/config/store";
import { canReceiveExternalOrders } from "../../app/lib/access";
import { useIncomingSources } from "../../entities/incoming-orders";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  QueryBoundary,
  SkeletonTable,
} from "../../shared/ui/primitives";
import { useConnections } from "../integrations/useConnections";
import NewOrdersTabs from "../new_orders/ui/NewOrdersTabs";
import IdleSources from "./ui/IdleSources";
import SourcesSummary from "./ui/SourcesSummary";
import SourcesTable from "./ui/SourcesTable";

/**
 * QAYSI MANBADAN QABUL QILAMIZ?
 *
 * NEGA KERAK BO'LDI. Bu ekran ilgari to'g'ridan-to'g'ri skanerlash ro'yxatini
 * ochardi va unda BARCHA tashqi buyurtma aralash turardi. Amalda faqat bitta
 * hamkor (BeePost) yuborgani uchun bu sezilmasdi. Ikkinchi manba qo'shilishi
 * bilan muammo ochiladi: operator qo'lida BeePost qopi turadi, ro'yxatda esa
 * Uzum posilkasi ham ko'rinadi — qaysi biri qo'lida borligini faqat
 * skanerlab bilib olardi va "topilmadi" xabari nimani bildirishi
 * tushunarsiz bo'lardi.
 *
 * Endi: manba tanlanadi → o'sha manbaning posilkalari skanerlanadi.
 *
 * ⚠️ RO'YXAT BUYURTMALARDAN CHIQADI, ulanishlar sozlamasidan emas. Ya'ni
 * posilkasi yo'q manba ko'rinmaydi (bo'sh ekranga olib boradigan qator
 * bo'lardi), va ulanishi o'chirilgan manbaning kutayotgan posilkasi
 * YASHIRILMAYDI — u haqiqatan omborda turgan bo'lishi mumkin.
 *
 * KO'RINISH (dizayn v2, maket `superadmin-neworders-incoming-sources`): sahifa «Qabul va yaratish»
 * qobig'i ichida (sarlavha va «Buyurtma yaratish» qobiqda). Karta qobiq tablari bilan boshlanadi
 * («Kiruvchi posilkalar» tabi qabul qiladigan hamma xodimda — ega qarori S1). So'ng izoh + «Yangilash»,
 * taqsimot xulosasi (halqa, jami summa, eng uzoq kutayotgan), manbalar jadvali va pastda (faqat
 * superadmin/admin) — ulangan, lekin posilkasiz manbalar.
 */

const SourcePicker = () => {
  const { t } = useTranslation("common");
  const role = useSelector((state: RootState) => state.role.role);
  // Route guard (`canReceiveExternalOrders`) bilan bir xil — MARKET bu yerda YO'Q (u qabul qilmaydi).
  const allowed = useSelector(canReceiveExternalOrders);
  // Ulanishlar ro'yxati (`admin/partners`, `integrations`) backendda faqat SUPERADMIN va ADMIN ga ochiq.
  const canSeeConnections = role === "superadmin" || role === "admin";

  const query = useIncomingSources();
  const sources = useMemo(() => query.data ?? [], [query.data]);

  /**
   * ULANGAN, LEKIN POSILKASI YO'Q MANBALAR.
   *
   * NEGA KERAK BO'LDI. Yuqoridagi ro'yxat BUYURTMALARdan chiqadi — ya'ni
   * posilka yubormagan manba ko'rinmaydi. Foydalanuvchi buni muammo deb
   * topdi: "nega faqat beepost turibdi?". Ro'yxat to'g'ri edi, lekin ekran
   * SABABINI aytmasdi va odam "ulanish buzilganmi?" deb o'ylardi.
   *
   * ⚠️ FAQAT CHIQUVCHI YOZUVLAR (`integration`) sanaladi. Hamkor yozuvida
   * (`partners`) Elchi market bog'lanishi YO'Q — u har posilkada
   * `elchi_market_id` bilan keladi. Ya'ni hamkorni yuqoridagi ro'yxat bilan
   * solishtirib bo'lmaydi va uni bu ro'yxatga qo'shsak, posilkasi BOR
   * hamkor (BeePost) ikki joyda ko'rinardi.
   *
   * ⚠️ Menejer va registratorda so'ralmaydi: ikkala ro'yxat ularga 403 qaytarardi va sahifada ikkita global
   * xato xabari chiqardi (ularning maketlarida bu karta yo'q).
   */
  const { connections } = useConnections({ enabled: canSeeConnections });
  const idleSources = useMemo(() => {
    const shownMarkets = new Set(sources.map((s) => String(s.market_id)));
    return connections
      .filter((c) => {
        if (c.kind !== "integration" || c.role !== "source") return false;
        const marketId = (c.raw as { market_id?: string | null }).market_id;
        return !marketId || !shownMarkets.has(String(marketId));
      })
      .map((c) => ({ key: c.uid, name: c.name }));
  }, [connections, sources]);

  if (!allowed) {
    return <ErrorState kind="forbidden" framed title={t("incomingNoAccess")} description={null} />;
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-4">
      <Card padding="none" aria-label={t("incoming.sourcesCardLabel")}>
        <NewOrdersTabs />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
          <p className="m-0 min-w-0 flex-[1_1_320px] text-[13px] text-text-muted">{t("incoming.sourcesIntro")}</p>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={RefreshCw}
            loading={query.isFetching && !query.isLoading}
            onClick={() => void query.refetch()}
          >
            {t("refresh")}
          </Button>
        </div>

        <QueryBoundary
          query={query}
          loading={
            <SkeletonTable
              framed={false}
              rows={3}
              className="border-t border-border"
              columns={[
                t("incoming.colSource"),
                t("incoming.colParcels"),
                t("incoming.colSum"),
                t("incoming.colOldest"),
              ]}
            />
          }
          /*
            Bo'sh holat O'RGATADI. "Manba yo'q" deb qoldirish operatorni
            "tizim buzilganmi?" degan savol bilan qoldirardi.
          */
          empty={
            <EmptyState
              icon={Inbox}
              title={t("incoming.sourcesEmptyTitle")}
              description={t("incoming.sourcesEmptyText")}
              className="border-t border-border"
            />
          }
          error={(error, retry) => (
            <ErrorState
              error={error}
              title={t("incoming.sourcesLoadError")}
              onRetry={retry}
              retrying={query.isFetching}
              className="border-t border-border"
            />
          )}
        >
          {(data) => (
            <>
              <SourcesSummary sources={data} />
              <SourcesTable sources={data} />
              <p className="m-0 flex items-start gap-2 border-t border-border px-5 py-3 text-xs text-text-subtle max-md:hidden">
                <Info size={14} aria-hidden="true" className="mt-px shrink-0" />
                {t("incoming.thresholdNote")}
              </p>
            </>
          )}
        </QueryBoundary>
      </Card>

      {/* ═══ ULANGAN, LEKIN POSILKASI YO'Q ═══ */}
      {idleSources.length > 0 ? <IdleSources names={idleSources} /> : null}
    </div>
  );
};

export default memo(SourcePicker);
