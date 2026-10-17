// dizayn-v2: superadmin-orders-detail-edit-order-dialog, admin-orders-edit-order-dialog, manager-orders-detail-edit-products-dialog, registrator-orders-detail-edit-order-dialog
import { memo, useId, useRef } from "react";
import { Minus, Plus, Tag, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getOrderItemName } from "../../../../shared/lib/orderItemName";
import { IconButton } from "../../../../shared/ui/primitives";
import type { EditDialogOrderItem } from "./editDialogModel";

/**
 * Buyurtma oynasidagi mahsulotlar ro'yxati (maket `*-orders-detail-edit-order-dialog`, «Mahsulotlar»):
 * har qator — `sunken` blok, chapda `Tag` ikonkasi (telefonda yashirin) va nomi, o'ngda son
 * (− son +, 1 dan kam emas) va «olib tashlash» (`danger-soft`). Qatorlar tor joyda o'raladi.
 *
 * `readOnly` — mahsulotlar qulflangan (HQ qabul qilgan): faqat nom va «N ta», tugmasiz.
 *
 * Kamida bitta mahsulot qoladi (D-01): oynada mahsulot qo'shib bo'lmaydi, oxirgisini olib tashlash esa
 * `items: []` bilan saqlanib, mahsulotsiz buyurtma qoldirardi. Yagona qatorda «olib tashlash» o'chiq, ostida
 * sababi («… buyurtma kerak bo'lmasa, uni bekor qiling»).
 */

type Props = {
  items: EditDialogOrderItem[];
  /** Ro'yxat nomi (`Field` yorlig'i id'si — `aria-labelledby`). */
  labelledBy: string;
  readOnly?: boolean;
  /** So'rov ketmoqda — tugmalar vaqtincha o'chiq. */
  disabled?: boolean;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
};

/** Qator ichidagi mahsulot ikonkasi (`.el-stat-icon` 36, `surface` fon). */
const ITEM_ICON =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-text-muted max-md:hidden";

export const OrderItemsEditor = memo(
  ({ items, labelledBy, readOnly = false, disabled = false, onQuantityChange, onRemove }: Props) => {
    const { t } = useTranslation(["newOrders", "orders"]);
    const listRef = useRef<HTMLUListElement>(null);
    const minOneHintId = useId();
    /** Oxirgi qator olib tashlandi — fokus «mahsulot qolmadi» xabariga o'tadi (oyna ichida qoladi). */
    const focusEmptyRef = useRef(false);
    /** Bitta qator qoldi — uning «olib tashlash» tugmasi o'chadi; fokus sababi yozilgan izohga o'tadi. */
    const focusMinOneRef = useRef(false);
    const isLastItem = items.length <= 1;

    if (!items.length) {
      return (
        <p
          ref={(node) => {
            if (!node || !focusEmptyRef.current) return;
            focusEmptyRef.current = false;
            node.focus();
          }}
          role="status"
          tabIndex={-1}
          className="m-0 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-text-muted outline-none"
        >
          {t("editDialog.itemsEmpty")}
        </p>
      );
    }

    const remove = (index: number, itemId: string) => {
      if (isLastItem) return;
      // Olib tashlangan qatorning tugmasi DOM'dan ketadi — fokus keyingi (yoki oldingi) qatorga o'tadi;
      // bitta qator qolsa — uning tugmasi o'chadi, fokus izohga (aks holda `body` ga tushib, oynadan chiqardi).
      const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-item-remove]");
      const next = items.length === 2 ? null : (rows?.[index + 1] ?? rows?.[index - 1] ?? null);
      focusMinOneRef.current = next === null;
      onRemove(itemId);
      next?.focus();
    };

    return (
      <>
        <ul ref={listRef} aria-labelledby={labelledBy} className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item, index) => {
            const name = getOrderItemName(item, t("productFallback"));
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-sunken py-2 pl-2 pr-3"
              >
                <span className="flex min-w-0 flex-[1_1_120px] items-center gap-3">
                  <span aria-hidden="true" className={ITEM_ICON}>
                    <Tag size={18} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere] text-text">{name}</span>
                </span>
                {readOnly ? (
                  <span className="ml-auto whitespace-nowrap text-sm font-semibold text-text">
                    {t("editDialog.itemQuantity", { count: item.quantity })}
                  </span>
                ) : (
                  <span className="ml-auto flex items-center gap-3">
                    <span
                      role="group"
                      aria-label={t("itemQuantityGroup", { ns: "orders", name })}
                      className="inline-flex items-center gap-1"
                    >
                      <IconButton
                        variant="secondary"
                        size="sm"
                        icon={Minus}
                        label={t("decreaseQuantity", { ns: "orders", name })}
                        disabled={disabled || item.quantity <= 1}
                        onClick={() => onQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                      />
                      <span aria-live="polite" className="min-w-7 text-center text-sm font-semibold text-text">
                        {item.quantity}
                      </span>
                      <IconButton
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        label={t("increaseQuantity", { ns: "orders", name })}
                        disabled={disabled}
                        onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                      />
                    </span>
                    <IconButton
                      data-item-remove=""
                      variant="danger-soft"
                      size="sm"
                      icon={Trash2}
                      label={t("editDialog.removeItem", { name })}
                      disabled={disabled || isLastItem}
                      aria-describedby={isLastItem ? minOneHintId : undefined}
                      onClick={() => remove(index, item.id)}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {isLastItem && !readOnly ? (
          <p
            id={minOneHintId}
            ref={(node) => {
              if (!node || !focusMinOneRef.current) return;
              focusMinOneRef.current = false;
              node.focus();
            }}
            tabIndex={-1}
            className="m-0 text-[13px] text-text-muted outline-none"
          >
            {t("editDialog.itemsMinOne")}
          </p>
        ) : null}
      </>
    );
  },
);

OrderItemsEditor.displayName = "OrderItemsEditor";
