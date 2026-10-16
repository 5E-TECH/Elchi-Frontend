// dizayn-v2: (maket yo'q) superadmin-orders-detail
import { useTranslation } from "react-i18next";
import { ProofGallery } from "../../../../entities/order";
import { Card } from "../../../../shared/ui/primitives";

/**
 * DALILLAR — kuryer sotish / bekor qilishda biriktirgan rasm va videolar. Maket yo'q — eng yaqini
 * `superadmin-orders-detail` kartasi. Nizoda («mahsulot yetkazilmagan») admin dalilni shu yerda ko'radi.
 * Dalil yo'q bo'lsa karta chiqmaydi (sahifa `keys.length` ni tekshiradi).
 */
export const ProofCard = ({ keys, className }: { keys: string[]; className?: string }) => {
  const { t } = useTranslation("orders");
  return (
    <Card
      title={t("proofTitle")}
      description={t("proofSubtitle")}
      data-testid="order-proof-card"
      className={className}
    >
      <ProofGallery keys={keys} />
    </Card>
  );
};
