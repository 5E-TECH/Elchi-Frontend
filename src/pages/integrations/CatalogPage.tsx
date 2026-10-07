import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Card, Tag } from "antd";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { CATEGORY_LABEL, ROLE_META } from "../../entities/integrations";
import { CONNECTION_TYPES, type ConnectionTypeMeta } from "./connections";
import { PAGE_SUBTITLE, PAGE_TITLE } from "./ui";

/**
 * KATALOG — "qaysi tizimni ulaysiz?".
 *
 * ⚠️ YO'NALISH SAVOLI OLIB TASHLANDI. Ilgari katalog ikki guruhga bo'linardi —
 * "Ular bizga" / "Biz ularga" (kalit kimdan) — bu TEXNIK savol edi va operator
 * javobini bilmasdi. Endi yo'nalishni yuqoridagi TAB belgilaydi (Hamkorlar /
 * Tashqi tizimlar / Marketplace), katalog esa faqat o'sha tabga mos turlarni
 * YASSI ro'yxatda ko'rsatadi. Hamkor (BeePost) yaratish esa katalogsiz —
 * to'g'ridan-to'g'ri "Yangi hamkor" modali orqali.
 */

type Scope = "partner" | "external" | "marketplace";

const matchScope = (meta: ConnectionTypeMeta, scope: Scope): boolean => {
  if (scope === "partner") return meta.kind === "partner";
  if (scope === "marketplace") return meta.kind === "integration" && meta.category === "marketplace";
  return meta.kind === "integration" && meta.category !== "marketplace";
};

const CatalogPage = () => {
  const { t } = useTranslation("integrations");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const scopeParam = searchParams.get("scope");
  const scope: Scope | null =
    scopeParam === "partner" || scopeParam === "external" || scopeParam === "marketplace"
      ? scopeParam
      : null;

  const items = useMemo(
    () => (scope ? CONNECTION_TYPES.filter((m) => matchScope(m, scope)) : CONNECTION_TYPES),
    [scope],
  );

  const backTo = scope ? `/integrations/connections?scope=${scope}` : "/integrations";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(backTo)}
          title={t("catBack")}
        />
        <div>
          <h1 className={`m-0 ${PAGE_TITLE}`}>{t("newConnection")}</h1>
          <p className={`m-0 ${PAGE_SUBTITLE}`}>{t("catChooseType")}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className={`m-0 text-sm ${PAGE_SUBTITLE}`}>{t("catNoTypes")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((type) => (
            <TypeCard
              key={type.key}
              type={type}
              onPick={() => navigate(`/integrations/new/${type.key}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TypeCard = ({ type, onPick }: { type: ConnectionTypeMeta; onPick: () => void }) => {
  const { t } = useTranslation("integrations");
  return (
    <Card
      hoverable
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      aria-label={t("catCardAria", { name: t(type.labelKey) })}
      className="h-full"
      title={
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-bold">{t(type.labelKey)}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Tag color="blue">{t(ROLE_META[type.role].labelKey)}</Tag>
        <Tag>{t(CATEGORY_LABEL[type.category])}</Tag>
      </div>

      <p className="m-0 text-sm text-gray-500 dark:text-gray-400">{t(type.descKey)}</p>

      <div className="mt-3 border-t border-gray-100 pt-2.5 dark:border-gray-700">
        <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          {t("catPrereqTitle")}
        </p>
        <ul className="m-0 list-none space-y-1 p-0">
          {type.prereqKeys.map((item: string) => (
            <li
              key={t(item)}
              className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-600 dark:text-gray-300"
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};

export default CatalogPage;
