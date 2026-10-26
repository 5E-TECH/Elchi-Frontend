// dizayn-v2: superadmin-users-create-courier-district, manager-users-create-courier-district, superadmin-users-edit-courier-district, superadmin-users-edit-courier-district-phone
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLogistics } from "../../../../entities/logistics/api/logisticsApi";
import { Field, Select } from "../../../../shared/ui/primitives";
import { toDistrictOptions } from "../model/courierDistrict";

export type CourierDistrictFieldProps = {
  /** Kuryer (filial) viloyati — tumanlar faqat shu viloyatdan. Yo'q bo'lsa maydon o'chiq (`disabledHint`). */
  regionId: string | null;
  regionName?: string | null;
  /** Tanlangan tuman id'si (`""` — tumansiz). */
  value: string;
  onChange: (districtId: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Viloyat yo'q bo'lsa izoh («Avval filialni tanlang …»). */
  disabledHint: string;
  /** Viloyat yuklanmoqda (tahrirlash oynasida `GET /users/:id`). */
  regionLoading?: boolean;
};

/**
 * «TUMAN» — kuryer ish hududi (DtKKY0V8, FY-5; maketlar `*-users-create-courier-district`,
 * `superadmin-users-edit-courier-district`): qidiruvli `Select`, faqat kuryer viloyati tumanlari (`GET region/:id`),
 * ixtiyoriy (× — tumansiz). Viloyat noma'lum bo'lsa maydon o'chiq va sababi izohda.
 */
export const CourierDistrictField = ({
  regionId,
  regionName,
  value,
  onChange,
  onBlur,
  error,
  disabledHint,
  regionLoading = false,
}: CourierDistrictFieldProps) => {
  const { t } = useTranslation("users");
  const { useGetDistricts } = useLogistics();
  const districts = useGetDistricts(regionId ?? undefined, Boolean(regionId));
  const options = useMemo(() => toDistrictOptions(districts.data), [districts.data]);
  const enabled = Boolean(regionId) && !regionLoading;

  const hint = !enabled
    ? regionLoading
      ? undefined
      : disabledHint
    : regionName
      ? t("v2.courierDistrict.hint", { region: regionName })
      : t("v2.courierDistrict.hintNoRegionName");

  return (
    <Field label={t("v2.courierDistrict.label")} labelAs="span" hint={hint} error={error}>
      <Select
        searchable
        clearable
        options={options}
        value={value || null}
        onChange={(next) => onChange(next ?? "")}
        onBlur={onBlur}
        placeholder={t("v2.courierDistrict.placeholder")}
        clearLabel={t("v2.courierDistrict.clear")}
        listLabel={
          regionName ? t("v2.courierDistrict.listLabel", { region: regionName }) : t("v2.courierDistrict.label")
        }
        loading={regionLoading || (enabled && districts.isLoading)}
        disabled={!enabled}
        invalid={Boolean(error)}
        noOptionsText={districts.isError ? t("v2.courierDistrict.loadError") : undefined}
      />
    </Field>
  );
};
