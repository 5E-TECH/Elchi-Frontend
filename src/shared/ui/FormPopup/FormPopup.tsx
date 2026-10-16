import { memo, type ReactNode, type FormEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, type DialogSize } from "../primitives";

interface FormPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  title: string;
  description?: string;
  icon?: ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  /** Yuborish tugmasini yuklanishsiz ham o'chirib qo'yadi (masalan tekshiruv o'tmaganda). */
  submitDisabled?: boolean;
  children: ReactNode;
  /**
   * ESKI: Tailwind `max-w-*` klassi. v2 da eng yaqin oyna kengligiga aylantiriladi
   * (`max-w-md` → 440, `max-w-lg` → 480, `max-w-xl` → 560, `max-w-2xl` va kengroq → 640).
   */
  widthClassName?: string;
  /** ESKI: v1 rang mavzusi — v2 da hamma oyna bir xil, e'tiborga olinmaydi. */
  theme?: "default" | "branch" | "market";
}

/**
 * Forma maydoni yorlig'i (antd `Form.Item label`) — v2 `.el-label` (`text-[13px] font-semibold text-text`).
 * Yangi kodda `Field` ishlating.
 */
export const popupLabelClassName = "text-[13px] font-semibold text-text";

/**
 * Forma tanasi: antd `Form.Item` lar orasi 16 px (v2 forma oralig'i).
 *
 * `!` (important) shart: antd uslublari CSS-in-JS orqali QATLAMSIZ qo'shiladi, Tailwind v4 utility'lari esa
 * `@layer utilities` da — qatlamsiz qoida har qanday qatlamdagi qoidadan ustun (antd `margin-bottom: 24px`
 * qolardi va maydonlar orasi tana oralig'i bilan 40 px bo'lardi). `Form.Item` tananing bevosita bolasi
 * bo'lsa (`<Form component={false}>`) oraliqni tana `gap-4` beradi — o'zining chetki bo'shlig'i 0;
 * `<form>` ichida bo'lsa — 16 px, oxirgisida 0.
 */
export const popupFormClassName =
  "[&_.ant-form-item]:mb-4! [&_.ant-form-item:last-child]:mb-0! [&>div>.ant-form-item]:mb-0!";

/** Tailwind `max-w-*` → piksel (eski chaqiruvlar). */
const WIDTH_PX: Record<string, number> = {
  "max-w-sm": 384,
  "max-w-md": 448,
  "max-w-lg": 512,
  "max-w-xl": 576,
  "max-w-2xl": 672,
  "max-w-3xl": 768,
  "max-w-4xl": 896,
};

const SIZE_PX: ReadonlyArray<[DialogSize, number]> = [
  ["sm", 440],
  ["md", 480],
  ["lg", 560],
  ["xl", 640],
];

/** Eski kenglik klassini eng yaqin v2 o'lchamiga aylantiradi (teng bo'lsa — kengrog'i). */
const toDialogSize = (widthClassName: string): DialogSize => {
  const arbitrary = /max-w-\[(\d+)px\]/.exec(widthClassName);
  const px = arbitrary ? Number(arbitrary[1]) : (WIDTH_PX[widthClassName.trim()] ?? 672);
  let best: [DialogSize, number] = SIZE_PX[SIZE_PX.length - 1];
  for (const entry of SIZE_PX) {
    if (Math.abs(entry[1] - px) <= Math.abs(best[1] - px)) best = entry;
  }
  return best[0];
};

/**
 * ESKI (v1) FORMA OYNASI — API o'zgarmagan, ko'rinishi dizayn v2 `Dialog` (3-bosqich): sarlavha
 * (ikonka · sarlavha · izoh · «Yopish»), aylanadigan tana, pastda «Bekor qilish» + asosiy amal
 * (`type="submit"`); telefonda pastki varaqa. Yangi kodda to'g'ridan-to'g'ri `Dialog` (`onSubmit`).
 */
const FormPopup = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  icon,
  submitLabel,
  cancelLabel,
  isLoading = false,
  submitDisabled = false,
  children,
  widthClassName = "max-w-2xl",
}: FormPopupProps) => {
  const { t } = useTranslation("common");
  const resolvedSubmitLabel = submitLabel ?? t("save");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      title={title}
      description={description}
      icon={icon ?? undefined}
      size={toDialogSize(widthClassName)}
      busy={isLoading}
      bodyClassName={popupFormClassName}
      footer={
        <>
          {/* So'rov ketayotganda oyna yopilmaydi (`tizim-feedback` 06 «Yopish»). */}
          <Button variant="secondary" disabled={isLoading} onClick={onClose}>
            {resolvedCancelLabel}
          </Button>
          <Button
            type="submit"
            loading={isLoading}
            loadingText={t("submitting")}
            // Yuklanish paytida `disabled` ham: Enter bilan forma ikkinchi marta yuborilmasin.
            disabled={isLoading || submitDisabled}
          >
            {resolvedSubmitLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
};

export default memo(FormPopup);
