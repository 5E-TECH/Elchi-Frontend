// dizayn-v2: superadmin-notifications-sent, superadmin-notifications-sent-loading, superadmin-notifications-sent-empty, superadmin-notifications-sent-error, superadmin-notifications-sent-detail-dialog, superadmin-notifications-sent-detail-states, admin-notifications-sent, admin-notifications-sent-loading, admin-notifications-sent-empty, admin-notifications-sent-error, admin-notifications-sent-detail-dialog, admin-notifications-sent-detail-states
import { useEffect, useMemo } from "react";
import { FunnelX, History, Send, ServerCrash, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  SentDetailDialog,
  useSentList,
  type SentListItem,
} from "../../entities/notification-dispatch";
import { formatNumberLocalized } from "../../shared/lib/formatMoney";
import {
  Badge,
  Button,
  ButtonIcon,
  buttonClasses,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  QueryBoundary,
  SkeletonTable,
} from "../../shared/ui/primitives";
import { applySentSearch, countSentFilters, parseSentSearch, type SentSearchPatch } from "./model/sentSearch";
import { SentFilters } from "./ui/SentFilters";
import { SentTable } from "./ui/SentTable";

/** Maket «1–10 / 64 ta xabar». */
export const SENT_PAGE_SIZE = 10;

/**
 * «YUBORILGANLAR» (`/notifications/sent`, superadmin va admin — `canSendNotifications`; menyuda yo'q, kirish —
 * «Xabar yuborish» sarlavhasidagi «Yuborilganlar»). Maketlar `*-notifications-sent`, `-loading`, `-empty`, `-error`,
 * tafsilot — `SentDetailDialog` (`*-sent-detail-dialog`, holatlar `*-sent-detail-states`; xato bilan tugaganida
 * «Qayta yuborish» → `/notifications/send`).
 *
 * `GET /notifications/sent?page&limit&status&created_by` — filtrlar, sahifa va ochiq oyna URL'da (`sentSearch.ts`).
 * Holatlar `QueryBoundary`: yuklanish (filtrlar o'chiq), bo'sh (hech narsa yuborilmagan — filtrlar yashirin;
 * filtr bo'yicha — «Filtrni tozalash»), xato («Qayta urinish», backend matni chiqmaydi). «Yuborilmoqda» qatori bo'lsa
 * ro'yxat har 10 s yangilanadi (`useSentList`).
 */
const NotificationSentPage = () => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page, openId } = parseSentSearch(searchParams);
  const update = (patch: SentSearchPatch) =>
    setSearchParams((current) => applySentSearch(current, patch), { replace: true });

  const listQuery = useSentList({
    page,
    limit: SENT_PAGE_SIZE,
    status: filters.status || undefined,
    created_by: filters.author || undefined,
  });
  const data = listQuery.data;
  const items = data?.items;
  const filtered = countSentFilters(filters) > 0;

  // Oxirgi sahifadan tashqarida (masalan qatorlar kamaygan yoki eski havola) — mavjud oxirgi sahifaga.
  const outOfRange = Boolean(data && !data.items.length && data.total > 0 && page > data.totalPages);
  const lastPage = data?.totalPages ?? 1;
  useEffect(() => {
    if (outOfRange) setSearchParams((current) => applySentSearch(current, { page: lastPage }), { replace: true });
  }, [lastPage, outOfRange, setSearchParams]);

  // «Kim yubordi» variantlari ro'yxat kelmasa ham — tarixdagi mualliflar nomi.
  const knownAuthors = useMemo(
    () =>
      new Map(
        (items ?? [])
          .filter((item) => item.created_by?.id && item.created_by.name)
          .map((item) => [item.created_by!.id, item.created_by!.name as string]),
      ),
    [items],
  );

  const ready = Boolean(data) && !(listQuery.isError && !data);
  // Eski (boshqa filtr/sahifa) javob hali turibdi va u bo'sh — bo'sh holatni shu eski javobdan chizmaymiz (masalan
  // «Filtrni tozalash» dan so'ng bir lahza «Hali xabar yuborilmagan» chiqardi), yangi javobgacha — yuklanish.
  const settling = listQuery.isPlaceholderData && !items?.length;
  // Hech narsa yuborilmagan (filtrsiz bo'sh) — maketdagidek filtrlar ko'rinmaydi. Faqat haqiqiy (eski emas) javobdan.
  const nothingSent = Boolean(data && !listQuery.isPlaceholderData && data.total === 0 && !filtered);
  const clearFilters = () => update({ status: "", author: "" });
  // Oxirgi sahifadan tashqarida yoki eski bo'sh javob — bo'sh holat emas, yuklanish (oxirgi sahifaga o'tilmoqda).
  const pending = outOfRange || settling;

  const query = {
    data: (listQuery.isError && !data) || pending ? undefined : items,
    isLoading: listQuery.isLoading || pending,
    isError: listQuery.isError && !data,
    error: listQuery.error,
    refetch: () => void listQuery.refetch(),
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:gap-4">
      <PageHeader
        back="/inbox"
        backLabel={t("dispatch.backLabel")}
        title={t("sent.pageTitle")}
        description={t("sent.pageDescription")}
        actions={
          <Link to="/notifications/send" className={buttonClasses({ variant: "primary" })}>
            <ButtonIcon icon={Send} px={18} />
            {t("dispatch.openSend")}
          </Link>
        }
      />

      {nothingSent ? null : (
        <SentFilters values={filters} onChange={update} disabled={!ready} knownAuthors={knownAuthors} />
      )}

      <Card
        padding="none"
        title={t("sent.listTitle")}
        description={t("sent.listDescription")}
        actions={data && data.total > 0 ? <Badge>{t("sent.total", { value: formatNumberLocalized(data.total, { language }) })}</Badge> : undefined}
        className="overflow-hidden"
        footer={
          data && data.total > 0 && data.items.length > 0 ? (
            <Pagination
              page={data.page}
              pageSize={data.limit}
              total={data.total}
              onPageChange={(next) => update({ page: next })}
              // Faqat sahifa/filtr almashuvi kutilayotganda — «Yuborilmoqda» qatori uchun fon yangilanishida emas.
              disabled={listQuery.isPlaceholderData}
              summary={(range) => t("sent.summary", { ...range, count: data.total })}
            />
          ) : undefined
        }
      >
        <QueryBoundary
          query={query}
          keepPreviousData={false}
          loadingLabel={t("sent.loading")}
          loading={
            <SkeletonTable
              framed={false}
              rows={6}
              columns={[
                t("sent.columns.date"),
                t("sent.columns.title"),
                t("sent.columns.author"),
                t("sent.columns.audience"),
                t("sent.columns.channels"),
                t("sent.columns.status"),
              ]}
            />
          }
          error={(_, retry) => (
            <ErrorState
              kind="server"
              icon={ServerCrash}
              title={t("sent.error.title")}
              description={t("sent.error.text")}
              onRetry={retry}
              retrying={listQuery.isFetching}
            />
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={FunnelX}
                title={t(filters.status ? "sent.emptyFiltered.statusTitle" : "sent.emptyFiltered.title")}
                description={t("sent.emptyFiltered.text")}
                action={
                  <Button variant="secondary" leftIcon={X} onClick={clearFilters}>
                    {t("sent.filters.clear")}
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={History} title={t("sent.empty.title")} description={t("sent.empty.text")} />
            )
          }
        >
          {(rows: SentListItem[]) => (
            <SentTable
              rows={rows}
              busy={listQuery.isPlaceholderData}
              onOpen={(item) => update({ openId: item.dispatch_id })}
            />
          )}
        </QueryBoundary>
      </Card>

      <SentDetailDialog dispatchId={openId} onClose={() => update({ openId: null })} resendHref="/notifications/send" />
    </div>
  );
};

export default NotificationSentPage;
