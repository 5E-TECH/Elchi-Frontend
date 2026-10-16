// dizayn-v2: superadmin-orders-detail-edit-customer-dialog, admin-orders-edit-customer-dialog
import type { ReactNode } from "react";
import { ButtonIcon, type IconSlot } from "../../../../shared/ui/primitives";

/**
 * Oyna ichidagi izoh bloki (maket `superadmin-orders-detail-edit-customer-dialog`: «O'zgarish mijoz
 * profiliga saqlanadi…»): `sunken` fon, 10 px radius, chapda 16 px ikonka, 13 px `text-muted` matn.
 * Qulflangan buyurtmada sabab ham shu ko'rinishda (`Lock`).
 */
export const DialogNote = ({ icon, children, id }: { icon: IconSlot; children: ReactNode; id?: string }) => (
  <div id={id} className="flex items-start gap-2 rounded-[10px] bg-sunken px-3 py-2.5">
    <ButtonIcon icon={icon} px={16} className="mt-0.5 text-text-muted" />
    <p className="m-0 min-w-0 text-[13px] text-text-muted">{children}</p>
  </div>
);
