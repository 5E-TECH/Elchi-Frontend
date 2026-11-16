// dizayn-v2: (maket yo'q) superadmin-users-detail
import { memo, useMemo, useState } from "react";
import { Globe, Map as MapIcon, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRegionOptions } from "../../../entities/region";
import {
  buildCourierRegionsPayload,
  useCourierRegions,
  useSetCourierRegions,
  type CourierRegionsView,
} from "../../../entities/user/api/courierRegions";
import type { User } from "../../../entities/user/types/user";
import { getBackendErrorMessage } from "../../../shared/lib/backendError";
import { cx } from "../../../shared/lib/cx";
import { notify } from "../../../shared/lib/notify";
import { Badge, Button, Card, Dialog, ErrorState, Skeleton } from "../../../shared/ui/primitives";

const MUTED = "m-0 text-[13px] leading-[18px] text-text-muted";

type RegionName = (regionId: string) => string;

/**
 * «XIZMAT VILOYATLARI» kartasi — kuryer tafsilotida, faqat superadmin va admin (backend `GET / PUT
 * couriers/:id/regions` — SUPERADMIN, ADMIN). Maket yo'q — eng yaqini `superadmin-users-detail` («Tarif» kartasi).
 *
 * Ega qarori 2026-11-15 («Pochta jo'natishda ham agar HQ ning shu viloyatda o'z kurieri bo'lsa u ham ro'yxatda
 * chiqib kelishi kerak»): HQ kuryeri shu ro'yxatdagi viloyatlar pochtasida «HQ kuryeriga» tabida chiqadi. Kartada —
 * izoh, viloyatlar (neytral belgilar) yoki «Faqat o'z viloyati»; «Barcha viloyatlar» (`serves_all_regions`) bo'lsa —
 * shu belgi va izoh (bu oynada o'zgartirilmaydi). «O'zgartirish» — `Dialog` (viloyatlar belgilash ro'yxati):
 * `PUT` tanasi `buildCourierRegionsPayload` — saqlangan viloyatlar tariflari o'zgarmaydi, yangisiga umumiy tarif.
 */
export const CourierRegionsCard = memo(({ user }: { user: User }) => {
  const { t } = useTranslation(["users", "common"]);
  const courierId = String(user.id);
  const [editing, setEditing] = useState(false);
  /** Har ochilishda yangi oyna nusxasi (tanlov GET'dan boshlanadi); yopilishda o'sha nusxa so'nadi. */
  const [openCount, setOpenCount] = useState(0);
  const regionsQuery = useCourierRegions(courierId, true);
  const regionOptions = useRegionOptions({ silentError: true });

  const nameById = useMemo(
    () => new Map((regionOptions.data ?? []).map((region) => [String(region.id), region.name])),
    [regionOptions.data],
  );
  const regionName: RegionName = (regionId) =>
    nameById.get(regionId) ?? t("courierRegions.regionFallback", { id: regionId });

  const view = regionsQuery.data;

  const body = regionsQuery.isError ? (
    <ErrorState
      size="chart"
      error={regionsQuery.error}
      title={t("courierRegions.loadError")}
      onRetry={() => void regionsQuery.refetch()}
      retrying={regionsQuery.isFetching}
      className="min-h-0"
    />
  ) : !view ? (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      <Skeleton width={96} height={24} shape="block" />
      <Skeleton width={120} height={24} shape="block" />
    </div>
  ) : (
    <CourierRegionsSummary view={view} regionName={regionName} />
  );

  return (
    <Card
      as="section"
      // Sarlavha «Tarif» / «Profil ma'lumotlari» kartalaridagidek ikonkasiz (eng yaqin maket — telefonda bir qator).
      title={t("courierRegions.title")}
      actions={
        <Button
          variant="secondary"
          size="sm"
          leftIcon={Pencil}
          aria-haspopup="dialog"
          disabled={!view}
          onClick={() => {
            setOpenCount((count) => count + 1);
            setEditing(true);
          }}
          className="max-md:h-11"
        >
          {t("courierRegions.edit")}
        </Button>
      }
      divided
      className="min-w-0"
      bodyClassName="flex flex-col gap-3"
    >
      <p className={MUTED}>{t("courierRegions.hint")}</p>
      {body}
      {view ? (
        <CourierRegionsDialog
          key={openCount}
          open={editing}
          courierId={courierId}
          courierName={user.name}
          view={view}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Card>
  );
});

CourierRegionsCard.displayName = "CourierRegionsCard";

const CourierRegionsSummary = ({ view, regionName }: { view: CourierRegionsView; regionName: RegionName }) => {
  const { t } = useTranslation("users");
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {view.serves_all_regions ? (
        <>
          <span>
            <Badge icon={Globe}>{t("courierRegions.allRegions")}</Badge>
          </span>
          <p className={MUTED}>{t("courierRegions.allRegionsHint")}</p>
        </>
      ) : null}
      {view.regions.length > 0 ? (
        <ul aria-label={t("courierRegions.title")} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {view.regions.map((row) => (
            <li key={row.region_id}>
              <Badge>{regionName(row.region_id)}</Badge>
            </li>
          ))}
        </ul>
      ) : view.serves_all_regions ? null : (
        <p className="m-0 text-sm font-semibold text-text">{t("courierRegions.empty")}</p>
      )}
    </div>
  );
};

/** «O'zgartirish» oynasi: har ochilishda (`key`) tanlov GET'dagi ro'yxatdan boshlanadi. */
const CourierRegionsDialog = ({
  open,
  courierId,
  courierName,
  view,
  onClose,
}: {
  open: boolean;
  courierId: string;
  courierName: string;
  view: CourierRegionsView;
  onClose: () => void;
}) => {
  const { t } = useTranslation(["users", "common"]);
  const regionOptions = useRegionOptions({ enabled: open, silentError: true });
  const save = useSetCourierRegions();
  const [selected, setSelected] = useState<string[]>(() => view.regions.map((row) => row.region_id));

  const options = useMemo(
    () =>
      (regionOptions.data ?? [])
        .map((region) => ({ id: String(region.id), name: String(region.name ?? "") }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [regionOptions.data],
  );
  const initial = useMemo(() => new Set(view.regions.map((row) => row.region_id)), [view.regions]);
  const changed = selected.length !== initial.size || selected.some((id) => !initial.has(id));

  const toggle = (regionId: string) =>
    setSelected((prev) => (prev.includes(regionId) ? prev.filter((id) => id !== regionId) : [...prev, regionId]));

  const close = () => {
    if (save.isPending) return;
    onClose();
  };

  const submit = async () => {
    if (save.isPending || !changed) return;
    // Tartib — katalogdagidek (ro'yxatda yo'q eski viloyatlar oxirida, o'chirilmaydi).
    const ordered = [
      ...options.map((option) => option.id).filter((id) => selected.includes(id)),
      ...selected.filter((id) => !options.some((option) => option.id === id)),
    ];
    try {
      await save.mutateAsync({ courierId, dto: buildCourierRegionsPayload(view, ordered) });
      notify.success(t("courierRegions.success"));
      onClose();
    } catch (error) {
      notify.error(t("common:error"), {
        description: getBackendErrorMessage(error) ?? t("courierRegions.saveError"),
      });
    }
  };

  const list = regionOptions.isError ? (
    <ErrorState
      size="chart"
      error={regionOptions.error}
      title={t("courierRegions.regionsLoadError")}
      onRetry={() => void regionOptions.refetch()}
      retrying={regionOptions.isFetching}
      className="min-h-0"
    />
  ) : regionOptions.isPending ? (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} height={44} shape="block" />
      ))}
    </div>
  ) : (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-2 p-0 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
        {t("courierRegions.listLabel")}
      </legend>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-md:grid-cols-1">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-text transition-colors duration-150 hover:bg-row-hover motion-reduce:transition-none",
                checked && "bg-action-soft",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={save.isPending}
                onChange={() => toggle(option.id)}
                className="size-[18px] shrink-0 cursor-pointer accent-action disabled:cursor-not-allowed"
              />
              <span className="min-w-0 wrap-break-word">{option.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={save.isPending}
      size="lg"
      icon={MapIcon}
      title={t("courierRegions.dialogTitle")}
      description={courierName}
      footer={
        <>
          <Button variant="secondary" disabled={save.isPending} onClick={close}>
            {t("common:cancel")}
          </Button>
          <Button
            disabled={!changed || regionOptions.isPending || regionOptions.isError}
            loading={save.isPending}
            onClick={() => void submit()}
          >
            {t("courierRegions.save")}
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className={MUTED}>{t("courierRegions.hint")}</p>
          <p className={MUTED}>{t("courierRegions.dialogHint")}</p>
          {view.serves_all_regions ? <p className={MUTED}>{t("courierRegions.allRegionsHint")}</p> : null}
        </div>
        {list}
      </div>
    </Dialog>
  );
};
