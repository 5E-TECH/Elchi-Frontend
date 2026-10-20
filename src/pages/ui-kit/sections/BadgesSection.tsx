import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ORDER_STATUSES } from "../../../entities/order/model/statusRegistry";
import { OrderStatusBadge } from "../../../entities/order/ui/OrderStatusBadge";
import { Badge, type BadgeSize, type BadgeVariant } from "../../../shared/ui/primitives/Badge";
import { Card } from "../../../shared/ui/primitives/Card";
import { StatusBadge } from "../../../shared/ui/primitives/StatusBadge";
import { TONES } from "../../../shared/ui/primitives/tone";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

const VARIANTS: readonly BadgeVariant[] = ["soft", "outline", "solid"];
const SIZES: readonly BadgeSize[] = ["md", "sm"];

/** API'da uchraydigan yozilishlar va noma'lum qiymat — `OrderStatusBadge` normallashtirishi namunasi. */
const RAW_SAMPLES: ReadonlyArray<{ raw: unknown; caption: string }> = [
  { raw: "ON_THE_ROAD", caption: "ON_THE_ROAD" },
  { raw: "cancelled_sent", caption: "cancelled_sent" },
  { raw: "partly paid", caption: "partly paid" },
  { raw: "waiting_customer", caption: "waiting_customer" },
  { raw: "lost_in_transit", caption: "lost_in_transit" },
  { raw: null, caption: "null" },
];

/**
 * Karta qatori — maketdagidek (`tizim-states-data` «Holat belgilari»): chapda 240px
 * sarlavha ustuni, o'ngda belgilar (`flex: 1 1 480px`); joy yetmasa ustma-ust.
 * Chekka har o'lchamda 20px, qatorlar orasida `border-t`.
 */
const Row = ({ title, meta, children }: { title: string; meta: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-3 p-5">
    <div className="flex max-w-full flex-[0_0_240px] flex-col gap-0.5">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      <p className="text-xs text-text-muted">{meta}</p>
    </div>
    <div className="min-w-0 flex-[1_1_480px]">{children}</div>
  </div>
);

const Wrap = ({ children }: { children: ReactNode }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
);

/**
 * «Holat belgilari» bo'limi: barcha ton × ko'rinish × o'lcham, 13 buyurtma
 * holati (`OrderStatusBadge`), maketdagi tur/holat namunalari va API qiymatlarini
 * normallashtirish. Har namuna kunduzgi va tungi mavzuda (`ThemePair`).
 * Maket: `tizim-states-data` → «Holat belgilari — to'liq to'plam».
 */
export const BadgesSection = () => {
  const { t } = useTranslation("ui");
  return (
    <KitSection
      id="badges"
      title={t("kit.sections.badges.title")}
      description={t("kit.sections.badges.description")}
    >
      <ThemePair>
        <Card as="div" padding="none" bodyClassName="divide-y divide-border">
          <Row title={t("badge.groups.orderStatus.title")} meta={t("badge.groups.orderStatus.meta")}>
            <Wrap>
              {ORDER_STATUSES.map((status) => (
                <OrderStatusBadge key={status} status={status} />
              ))}
            </Wrap>
          </Row>

          <Row title={t("badge.groups.variants.title")} meta={t("badge.groups.variants.meta")}>
            <div className="flex min-w-0 flex-col gap-3">
              {VARIANTS.flatMap((variant) =>
                SIZES.map((size) => (
                  <div key={`${variant}-${size}`} className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-text-muted">
                      {t(`badge.variants.${variant}`)} · {t(`badge.sizes.${size}`)}
                    </span>
                    <Wrap>
                      {TONES.map((tone) => (
                        <Badge key={tone} tone={tone} variant={variant} size={size} dot>
                          {t(`badge.tones.${tone}`)}
                        </Badge>
                      ))}
                    </Wrap>
                  </div>
                )),
              )}
              <p className="text-xs text-text-muted">{t("badge.solidNote")}</p>
            </div>
          </Row>

          <Row title={t("badge.groups.deliveryType.title")} meta={t("badge.groups.deliveryType.meta")}>
            <Wrap>
              <Badge>{t("badge.samples.address")}</Badge>
              <Badge>{t("badge.samples.center")}</Badge>
            </Wrap>
          </Row>

          <Row title={t("badge.groups.userStatus.title")} meta={t("badge.groups.userStatus.meta")}>
            <Wrap>
              <StatusBadge tone="success" label={t("badge.samples.active")} />
              <StatusBadge tone="neutral" label={t("badge.samples.inactive")} />
            </Wrap>
          </Row>

          <Row title={t("badge.groups.payment.title")} meta={t("badge.groups.payment.meta")}>
            <Wrap>
              <Badge icon={ArrowDownLeft}>{t("badge.samples.income")}</Badge>
              <Badge icon={ArrowUpRight}>{t("badge.samples.expense")}</Badge>
            </Wrap>
          </Row>

          <Row title={t("badge.groups.normalize.title")} meta={t("badge.groups.normalize.meta")}>
            <dl className="grid min-w-0 grid-cols-[minmax(0,auto)_1fr] items-center gap-x-3 gap-y-2">
              {RAW_SAMPLES.map(({ raw, caption }) => (
                <div key={caption} className="contents">
                  <dt className="truncate text-xs text-text-muted">{caption}</dt>
                  <dd className="flex min-w-0">
                    <OrderStatusBadge status={raw} />
                  </dd>
                </div>
              ))}
            </dl>
          </Row>
        </Card>
      </ThemePair>
    </KitSection>
  );
};
