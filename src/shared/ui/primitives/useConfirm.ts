import { confirm, type ConfirmOptions } from "./dialog/confirmStore";

/** Hook'siz ko'rinish (hodisa ishlovchisi yoki yordamchi funksiya ichida): `await confirm({ … })`. */
export { confirm };
export type { ConfirmOptions };

/**
 * TASDIQLASH — `Promise<boolean>` qaytaradigan funksiya (`ConfirmDialog`, `useConfirm` naqshi).
 *
 *   const confirm = useConfirm();
 *
 *   const handleDeactivate = async () => {
 *     const ok = await confirm({
 *       tone: "danger",
 *       title: t("users.deactivateTitle"),          // «Nofaol qilishni tasdiqlang»
 *       description: t("users.deactivateMessage", { name }),
 *       confirmLabel: t("users.deactivate"),        // «Nofaol qilish» — aniq fe'l
 *       confirmIcon: UserX,
 *       icon: UserX,
 *       onConfirm: () => deactivate.mutateAsync(id), // yuklanish va xato — oyna ichida
 *     });
 *     if (ok) notify.success(t("users.deactivated"));
 *   };
 *
 * `UiHost` (`ConfirmHost`) ostidagi istalgan joyda ishlaydi. Funksiya barqaror (har render'da bir xil).
 */
export const useConfirm = (): ((options: ConfirmOptions) => Promise<boolean>) => confirm;
