import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { notify } from "../../../shared/lib/notify";
import { ReceiptFontError } from "../lib/receiptErrors";
import type { ReceiptPrintResult } from "../lib/printReceipts";

/**
 * Chop etish tugmalari uchun umumiy oqim (HJ5sLHiz, TZ F9 · chegaraviy holatlar):
 *  - QR tokeni yo'q buyurtma bo'lsa — oldindan `notify.warning` «N ta buyurtmada QR yo'q» (chek baribir chiqadi,
 *    QR o'rnida «QR yo'q» ramkasi); paket / pochta chekining tokeni yo'q bo'lsa — xuddi shunday «Paket / Pochta chekida
 *    QR yo'q» (`packageWithoutQr`, `receiptPackageWithoutQr`);
 *  - ish davomida tugma `loading` (`printing` / `printingKey`), qayta bosish e'tiborsiz;
 *  - xatoda `notify.error` + «Qayta urinish»: shrift yuklanmasa (`ReceiptFontError`) shriftsiz chek chiqmaydi;
 *  - PDF oynasi bloklanib fayl yuklab olinsa — `notify.info`.
 * Menyu ochilganda `preload` — jsPDF va shriftlar oldindan yuklanadi.
 */
export interface ReceiptPrintTask {
  /** Bir sahifada bir nechta chop etish tugmasi bo'lsa — qaysi biri yuklanmoqda (`printingKey`). */
  key?: string;
  /** QR tokeni yo'q buyurtmalar soni (`countReceiptsWithoutQr`). */
  withoutQr?: number;
  /** Paket (`batch`) yoki pochta (`post`) chekida QR tokeni yo'q (`receiptPackageWithoutQr`). */
  packageWithoutQr?: "batch" | "post" | null;
  print: () => Promise<ReceiptPrintResult>;
}

export const useReceiptPrint = () => {
  const { t, i18n } = useTranslation(["ui", "common"]);
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const busyRef = useRef(false);

  const run = useCallback(
    async (task: ReceiptPrintTask): Promise<ReceiptPrintResult | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setPrintingKey(task.key ?? "print");
      if (task.withoutQr) {
        notify.warning(
          t("ui:printMenu.noQr", {
            value: formatNumberLocalized(task.withoutQr, {
              language: i18n.resolvedLanguage ?? i18n.language,
            }),
            count: task.withoutQr,
          }),
          { description: t("ui:printMenu.noQrHint"), id: "receipt-no-qr" },
        );
      }
      if (task.packageWithoutQr) {
        notify.warning(
          t(task.packageWithoutQr === "post" ? "ui:printMenu.noQrPost" : "ui:printMenu.noQrBatch"),
          { description: t("ui:printMenu.noQrPackageHint"), id: "receipt-no-qr-package" },
        );
      }
      try {
        const result = await task.print();
        if (result.delivery.includes("saved")) {
          notify.info(t("ui:printMenu.pdfSaved"), { description: t("ui:printMenu.pdfSavedHint") });
        }
        return result;
      } catch (error) {
        notify.error(t("ui:printMenu.error"), {
          id: "receipt-print-error",
          description:
            error instanceof ReceiptFontError
              ? t("ui:printMenu.fontError")
              : t("ui:printMenu.errorHint"),
          action: {
            label: t("common:retry"),
            onClick: () => void run({ ...task, withoutQr: 0, packageWithoutQr: null }),
          },
        });
        return null;
      } finally {
        busyRef.current = false;
        setPrintingKey(null);
      }
    },
    [i18n, t],
  );

  return { run, printing: printingKey !== null, printingKey };
};
