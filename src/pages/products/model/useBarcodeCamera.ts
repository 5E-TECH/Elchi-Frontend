import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { classifyScanCode, normalizeScanCode } from "../../../entities/warehouse";
import { playScanFeedback } from "../../../shared/lib/scanner/feedback";
import { closeScanner, openScanner } from "../../../shared/lib/scanner/scannerHost";
import { useScanTarget } from "../../../shared/lib/scanner/scanTargets";

type Options = {
  /** Maydon tahrirlanadi (oyna ochiq, saqlanmayapti) — kamera maqsadi faol. */
  enabled: boolean;
  /** Kamera sarlavhasi ostidagi kontekst (mahsulot nomi). */
  productName: string;
  /** O'qilgan zavod kodi — maydonga yoziladi. */
  onCode: (code: string) => void;
};

/**
 * «SHTRIX KOD» MAYDONI — KAMERA (Trello CO66kcoB). Oyna (`Dialog`) ochiq turganda ilova `inert` — pastki menyudagi
 * markaziy «Skaner» va yuqori paneldagi «Skanerlash» bosilmaydi, shuning uchun kamera maydon yonidagi «Kamera»
 * tugmasidan ochiladi (ombor kirimi oynasidagi «Kamera» kabi; `openScanner()` → shu oyna maqsadi).
 *
 * Maqsad `layer: "dialog"`, `formats: "barcodes"` (QR + EAN-13 / EAN-8 / UPC-A / Code128, nazorat raqami
 * tekshiriladi), `closeOnSuccess` — bitta qiymat: kod maydonga yozilgach kamera yopiladi («Uzluksiz skanerlash»
 * sozlamasidan qat'i nazar). Elchi stikeri (`ELC-P-…`) shtrix kod sifatida yozilmaydi — u mahsulotning o'z kodi.
 * Oyna yopilsa (yoki saqlash boshlansa) kamera ham yopiladi.
 */
export const useBarcodeCamera = ({ enabled, productName, onCode }: Options) => {
  const { t } = useTranslation("warehouses");
  const requestedRef = useRef(false);

  useScanTarget(
    enabled
      ? {
          id: "product-barcode",
          layer: "dialog",
          formats: "barcodes",
          closeOnSuccess: true,
          title: t("productCode.cameraTitle"),
          context: productName || undefined,
          hint: t("productCode.cameraHint"),
          onScan: (raw) => {
            const code = normalizeScanCode(raw);
            if (!code) return;
            if (classifyScanCode(code) === "elchi") {
              void playScanFeedback("error", t("productCode.cameraElchi"));
              return;
            }
            onCode(code);
            void playScanFeedback("success", t("productCode.cameraDone"), undefined, { text: code });
          },
        }
      : null,
  );

  useEffect(() => {
    if (enabled || !requestedRef.current) return;
    requestedRef.current = false;
    closeScanner();
  }, [enabled]);
  useEffect(
    () => () => {
      if (requestedRef.current) closeScanner();
    },
    [],
  );

  return useCallback(() => {
    requestedRef.current = openScanner() === "overlay";
  }, []);
};
