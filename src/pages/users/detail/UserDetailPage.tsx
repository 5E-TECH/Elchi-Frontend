// dizayn-v2: superadmin-users-detail, admin-users-detail, manager-users-detail
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "../../../entities/user/api/userApi";
import { unwrapUserResponse } from "../../../entities/user/lib/normalizeUser";
import { getErrorStatus } from "../../../shared/lib/errorKind";
import { buttonClasses, ErrorState, QueryBoundary, Skeleton, SkeletonLines } from "../../../shared/ui/primitives";
import { UserDetailView } from "../../../widgets/user-detail/ui/UserDetailView";

/** Yuklanish: sarlavha + «Aloqa va sanalar» + karta skeleti (sahifa joyida, sakrashsiz). */
const DetailSkeleton = () => (
  <div className="flex min-w-0 flex-col gap-6 max-md:gap-4" aria-hidden="true">
    <div className="flex flex-col gap-2">
      <Skeleton width={120} height={14} />
      <Skeleton width={240} height={28} />
      <Skeleton width={200} height={14} />
    </div>
    <div className="rounded-2xl border border-border bg-surface p-5">
      <SkeletonLines lines={2} />
    </div>
    <div className="rounded-2xl border border-border bg-surface p-5">
      <SkeletonLines lines={5} />
    </div>
  </div>
);

/**
 * `/all-users/:id` va `/new-orders/userDetail/:id` — foydalanuvchi tafsiloti (dizayn v2, `UserDetailView`).
 * Ikkinchi route «Qabul va yaratish» bo'limidan ochiladi — «Orqaga» tarixga qaytaradi.
 * Yuklanish / xato / topilmadi — `QueryBoundary` (sahifa o'lchamida).
 */
export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const { t } = useTranslation("users");
  const { useGetUserById } = useUser();
  // Xato / «Topilmadi» sahifada (`ErrorState size="page"`) — global xabar takrorlanmaydi.
  const query = useGetUserById(id || "", undefined, { silentError: true });
  const user = unwrapUserResponse(query.data);
  const fromNewOrders = pathname.startsWith("/new-orders");
  const back = fromNewOrders ? (true as const) : "/all-users";
  // Topilmadi (404 yoki bo'sh javob): sahifa o'lchamidagi holat + ro'yxatga qaytish.
  const notFound = (
    <ErrorState
      size="page"
      title={t("v2.detail.notFound")}
      description={t("v2.detail.notFoundDescription")}
      actions={
        fromNewOrders ? null : (
          <Link to="/all-users" className={buttonClasses({ variant: "secondary" })}>
            {t("v2.common.back")}
          </Link>
        )
      }
    />
  );

  return (
    <QueryBoundary
      query={{
        data: user ?? undefined,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
      }}
      loading={<DetailSkeleton />}
      empty={notFound}
      error={(error, retry) =>
        getErrorStatus(error) === 404 ? (
          notFound
        ) : (
          <ErrorState error={error} size="page" title={t("v2.detail.loadError")} onRetry={retry} />
        )
      }
    >
      {(loaded) => <UserDetailView user={loaded} back={back} />}
    </QueryBoundary>
  );
};

export default UserDetailPage;
