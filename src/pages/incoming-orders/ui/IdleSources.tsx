// dizayn-v2: superadmin-neworders-incoming-sources, admin-neworders-incoming-sources, manager-new-orders-incoming-sources
import { memo } from "react";
import { ChevronRight, Plug } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Badge, buttonClasses, Card } from "../../../shared/ui/primitives";

/** Tashqi tizimlar konsoli — shu sahifa bilan bir xil ruxsat (`canManageExternalIntegrations`). */
const INTEGRATIONS_PATH = "/integrations/connections?scope=external";

/**
 * «ULANGAN MANBALAR — HOZIRCHA POSILKA YO'Q» (maket: manba tanlash sahifasining ikkinchi kartasi).
 *
 * Yuqoridagi ro'yxat BUYURTMALARDAN chiqadi — posilka yubormagan manba unda yo'q. Shu karta
 * sababini aytadi: ulanish bor, faqat posilka hali kelmagan («ulanish buzilganmi?» degan savol
 * tug'ilmasin). Havola — ulanishlar konsoliga.
 */
const IdleSources = ({ names }: { names: readonly { key: string; name: string }[] }) => {
  const { t } = useTranslation("common");
  return (
    <Card
      title={t("incoming.idleTitle")}
      actions={
        <Link to={INTEGRATIONS_PATH} className={buttonClasses({ variant: "link", size: "sm" })}>
          {t("incoming.idleLink")}
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
        </Link>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <p className="m-0 text-[13px] text-text-muted">{t("incoming.idleText")}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {names.map((item) => (
          <li key={item.key}>
            <Badge icon={Plug}>{item.name}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default memo(IdleSources);
