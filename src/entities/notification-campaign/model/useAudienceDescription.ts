import { useTranslation } from "react-i18next";
import { useRegionDistrictCatalog } from "../../region";
import { useRegionLookup } from "../../region/lookup";
import { formatDateLocalized } from "../../../shared/lib/formatDateTime";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import {
  AUDIENCE_KINDS,
  AUDIENCE_STAFF_ROLES,
  isAudienceSegmentEmpty,
  type AudienceDraft,
} from "./audience";

export type AudienceDescription = {
  /** «Mijoz, Market, Xodim». */
  kinds: string;
  /** «Menejer, Logist» (xodim tanlanmagan — `null`). */
  staffRoles: string | null;
  /** «Toshkent sh. · Chilonzor tumani» yoki «Barchasi». */
  area: string;
  market: string;
  lastOrder: string;
  orders: string;
  /** Tasdiq oynasidagi «Kimga»: «Mijoz (Toshkent sh., Chilonzor tumani), Market, Xodim: Menejer, Logist». */
  who: string;
};

/**
 * Auditoriya qoralamasining matni — segmentni saqlash oynasi xulosasi va tasdiq oynasidagi «Kimga». Hudud nomlari
 * ro'yxatlardan (kesh — konstruktor ham shularni so'ragan), market nomi — konstruktordagi tanlovdan
 * (`marketLabel`; noma'lum bo'lsa `#id`).
 */
export const useAudienceDescription = (
  draft: AudienceDraft,
  { marketLabel, enabled = true }: { marketLabel?: string | null; enabled?: boolean } = {},
): AudienceDescription => {
  const { t, i18n } = useTranslation("notifications");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const segment = draft.customerSegment;
  const withCustomers = draft.kinds.includes("customer");
  const regions = useRegionLookup(enabled && withCustomers && Boolean(segment.region_id));
  const districts = useRegionDistrictCatalog(
    segment.region_id ?? "",
    enabled && withCustomers && Boolean(segment.region_id),
    {
      silentError: true,
    },
  );
  const num = (value: number) => formatNumberLocalized(value, { language });
  const all = t("campaign.saveDialog.all");

  const regionName = segment.region_id
    ? (regions.data?.find((item) => String(item.id) === segment.region_id)?.name ??
      `#${segment.region_id}`)
    : null;
  const districtName = segment.district_id
    ? (districts.data?.find((item) => String(item.id) === segment.district_id)?.name ??
      `#${segment.district_id}`)
    : null;
  const areaParts = [regionName, districtName].filter((part): part is string => Boolean(part));
  const market = segment.market_id ? marketLabel || `#${segment.market_id}` : all;
  const from = segment.last_order_from
    ? formatDateLocalized(segment.last_order_from, { language })
    : null;
  const to = segment.last_order_to
    ? formatDateLocalized(segment.last_order_to, { language })
    : null;
  const lastOrder = from && to ? `${from} – ${to}` : from ? `${from} –` : to ? `– ${to}` : all;
  // «dan 1» — filtr emas (`audienceSegmentPayload`).
  const min = segment.min_orders && segment.min_orders > 1 ? segment.min_orders : undefined;
  const max = segment.max_orders;
  const orders =
    min && max
      ? t("campaign.saveDialog.ordersRange", { from: num(min), to: num(max) })
      : min
        ? t("campaign.saveDialog.ordersFrom", { from: num(min) })
        : max
          ? t("campaign.saveDialog.ordersTo", { to: num(max) })
          : all;

  const kinds = AUDIENCE_KINDS.filter((kind) => draft.kinds.includes(kind))
    .map((kind) => t(`campaign.kind.${kind}`))
    .join(", ");
  const roles = AUDIENCE_STAFF_ROLES.filter((role) => draft.staffRoles.includes(role)).map((role) =>
    t(`campaign.role.${role}`),
  );
  const staffRoles = draft.kinds.includes("staff") && roles.length ? roles.join(", ") : null;

  const customerWho = !withCustomers
    ? null
    : isAudienceSegmentEmpty(segment)
      ? t("campaign.who.customerAll")
      : areaParts.length
        ? t("campaign.who.customerFiltered", { filters: areaParts.join(", ") })
        : t("campaign.who.customerSegment");
  const who = [
    customerWho,
    draft.kinds.includes("market") ? t("campaign.who.market") : null,
    staffRoles ? t("campaign.who.staff", { roles: staffRoles }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    kinds,
    staffRoles,
    area: withCustomers && areaParts.length ? areaParts.join(" · ") : all,
    market,
    lastOrder,
    orders,
    who,
  };
};
