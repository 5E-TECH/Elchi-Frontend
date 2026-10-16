// dizayn-v2: superadmin-orders-detail, market-orders-detail
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../../../../shared/lib/cx";
import { Button } from "../../../../shared/ui/primitives";

/**
 * Buyurtma izohi — «IZOH» (`.el-overline`) va matn. Qator tashlanishlari saqlanadi, uzun so'z
 * o'raladi (390px da gorizontal toshmaydi). 3 qatordan yoki ~220 belgidan uzun bo'lsa qisqartiriladi:
 * «Ko'proq ko'rsatish» / «Yashirish» (`line-clamp-3` klass nomi statik — JIT dinamik nomni ko'rmaydi).
 */
export const OrderComment = ({ comment }: { comment: string }) => {
  const { t } = useTranslation(["newOrders", "common"]);
  const [expanded, setExpanded] = useState(false);
  const isLong = comment.split("\n").length > 3 || comment.length > 220;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-text-muted">{t("note")}</span>
      <p className={cx("m-0 whitespace-pre-line break-words text-sm text-text", !expanded && isLong && "line-clamp-3")}>
        {comment}
      </p>
      {isLong ? (
        <Button
          variant="link"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="-ml-3 self-start"
        >
          {expanded ? t("hide", { ns: "common" }) : t("showMore", { ns: "common" })}
        </Button>
      ) : null}
    </div>
  );
};
