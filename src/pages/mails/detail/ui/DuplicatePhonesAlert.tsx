// dizayn-v2: superadmin-mails-detail-duplicates, admin-mails-detail-duplicates, registrator-mails-detail-duplicates, manager-mails-detail-receive-duplicates
import { Phone, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../../shared/lib/formatMoney";
import { Pressable } from "../../../../shared/ui/primitives";
import { DetailAlert } from "../../../new_orders/components/detail/DetailAlert";
import type { DuplicatePhoneGroup } from "../lib/mailSearch";

/**
 * TAKRORIY TELEFON BANNERI (MD-1, ega S1–S2) — «Buyurtmalar» kartasida, sarlavha (qidiruv) ostida
 * (`.el-alert.el-tone-warning`): faqat ogohlantiradi — jo'natish/qabulni to'smaydi; faqat shu pochta ichida.
 *
 *  - sarlavha «Takroriy telefon raqamlar aniqlandi (N ta)»; matn 4 xil: jo'natish / qabul × bitta / bir nechta raqam;
 *  - chiplar (`Pressable` + `.el-chip`, telefonda 44 px): bosilsa raqam qidiruvga yoziladi, faol chip (joriy
 *    qidiruv shu raqam) qayta bosilsa — qidiruv tozalanadi. Banner qidiruvdan qat'i nazar turadi.
 */
const CHIP =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-strong bg-surface px-3 " +
  "text-[13px] font-medium text-text transition-[background-color,border-color,color] duration-150 " +
  "motion-reduce:transition-none hover:border-text-subtle aria-pressed:border-action aria-pressed:bg-action-soft " +
  "aria-pressed:font-semibold aria-pressed:text-action-fg max-md:h-11";

const CHIP_COUNT =
  "inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-sunken px-1.5 text-xs font-semibold text-text-muted";

type DuplicatePhonesAlertProps = {
  groups: DuplicatePhoneGroup[];
  /** Jo'natish (xodim) yoki qabul (menejer) — matn varianti. */
  mode: "send" | "receive";
  /** Faol guruh kaliti (joriy qidiruv shu raqam) yoki `null`. */
  activeKey: string | null;
  onToggle: (group: DuplicatePhoneGroup, active: boolean) => void;
};

export const DuplicatePhonesAlert = ({ groups, mode, activeKey, onToggle }: DuplicatePhonesAlertProps) => {
  const { t, i18n } = useTranslation("mails");
  const language = i18n.resolvedLanguage ?? i18n.language;
  if (groups.length === 0) return null;

  const count = (value: number) => formatNumberLocalized(value, { language });
  const orderCount = groups.reduce((sum, group) => sum + group.orderIds.length, 0);
  const textKey = `detailPage.duplicates.${mode}${groups.length === 1 ? "One" : "Many"}`;

  return (
    <DetailAlert
      tone="warning"
      icon={TriangleAlert}
      role="status"
      titleBlock
      title={t("detailPage.duplicates.title", { value: count(groups.length) })}
      data-testid="mail-duplicate-phones"
    >
      <p className="mt-0.5 text-[13px] text-text-muted">{t(textKey, { value: count(orderCount) })}</p>
      <div role="group" aria-label={t("detailPage.duplicates.chipsLabel")} className="mt-2.5 flex flex-wrap gap-2">
        {groups.map((group) => {
          const active = group.key === activeKey;
          return (
            <Pressable
              key={group.key}
              aria-pressed={active}
              aria-label={t("detailPage.duplicates.chipLabel", {
                phone: group.phone,
                value: count(group.orderIds.length),
                ids: group.orderIds.map((id) => `№${id}`).join(", "),
              })}
              className={CHIP}
              onClick={() => onToggle(group, active)}
            >
              <Phone size={16} aria-hidden="true" className="shrink-0" />
              <span className="whitespace-nowrap">{group.phone}</span>
              <span aria-hidden="true" className={CHIP_COUNT}>
                {count(group.orderIds.length)}
              </span>
            </Pressable>
          );
        })}
      </div>
    </DetailAlert>
  );
};
