// dizayn-v2: superadmin-users-detail
import { memo, useState } from "react";
import { Link2, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationFormModal } from "../../../features/notification-create";
import { Button, Card } from "../../../shared/ui/primitives";

interface MarketTelegramGroupLinkCardProps {
  marketId: string;
}

/**
 * Marketning Telegram guruhini ulash (4TfLyTrL, 6jXw0DDr) — eski «Telegram token» kartasi o'rnida
 * (kartadagi «eng yaqin joy — «Telegram token» kartasi»; ko'rinish o'sha kartaniki: ikonka + sarlavha,
 * tugma, ostida izoh).
 *
 * Matnli token bilan ulash backendda o'chirilgan — guruh faqat bir martalik havola bilan ulanadi. Tugma
 * «Bildirishnoma qo'shish» oynasini (`NotificationFormModal`) shu market tanlangan holda ochadi: xabar
 * turi → «Ulash havolasini olish» → QR / `t.me/<bot>?startgroup=<kod>` (10 daqiqa, bir marta), bot
 * guruhga qo'shilib uni o'zi ulaydi. Faqat superadmin (oyna va /notifications sahifasi kabi).
 */
export const MarketTelegramGroupLinkCard = memo(({ marketId }: MarketTelegramGroupLinkCardProps) => {
  const { t } = useTranslation("users");
  const [open, setOpen] = useState(false);

  return (
    <Card
      as="section"
      title={
        <span className="inline-flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <Send size={18} strokeWidth={2} />
          </span>
          {t("tgGroupCardTitle")}
        </span>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <Button variant="secondary" leftIcon={Link2} className="self-start max-md:self-stretch" onClick={() => setOpen(true)}>
        {t("tgGroupLinkAction")}
      </Button>
      <p className="m-0 text-[13px] text-text-muted">{t("tgGroupLinkHint")}</p>
      <NotificationFormModal open={open} onClose={() => setOpen(false)} marketId={marketId} />
    </Card>
  );
});

MarketTelegramGroupLinkCard.displayName = "MarketTelegramGroupLinkCard";
