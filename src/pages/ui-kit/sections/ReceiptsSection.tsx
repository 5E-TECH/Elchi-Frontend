import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  loadReceiptPreviews,
  type ReceiptPreview,
  type ReceiptPreviewPage,
} from "../../../features/print-receipts";
import { formatNumberLocalized } from "../../../shared/lib/formatMoney";
import { QueryBoundary, type QueryLike } from "../../../shared/ui/primitives/QueryBoundary";
import { Skeleton } from "../../../shared/ui/primitives/Skeleton";
import { KitSection } from "../KitSection";
import { ThemePair } from "../ThemePair";

/**
 * «Cheklar va yorliqlar» bo'limi (`?section=receipts`, HJ5sLHiz — TZ qabul 2 / FE-5): maket `tizim-receipts`
 * namunalari (`receiptSamples.ts`) chop etish yo'lining o'zi bilan — shriftlar → o'lchov → joylash → HTML renderer
 * (`renderReceiptHtml`), maket masshtabida: termal 1 mm = 5 px, A5 — 3 px, A4 varaq — kichik nusxa. Har sahifa alohida
 * `iframe` (`srcDoc`, skriptsiz): chek CSS'i ilovaga aralashmaydi. Qog'oz doim oq-qora — tungi panelda ham.
 *
 * Modul (jsPDF, shriftlar, joylash) shu bo'lim ochilganda dinamik yuklanadi (`loadReceiptPreviews`).
 */

type PreviewState = { data: ReceiptPreview[] | null; error: unknown; loading: boolean };

const useReceiptPreviews = (): QueryLike<ReceiptPreview[]> => {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PreviewState>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    loadReceiptPreviews().then(
      (data) => {
        if (alive) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (alive) setState({ data: null, error, loading: false });
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  const refetch = useCallback(() => {
    setState({ data: null, error: null, loading: true });
    setAttempt((value) => value + 1);
  }, []);
  return {
    data: state.data,
    isLoading: state.loading,
    isError: state.error != null,
    error: state.error,
    refetch,
  };
};

const PreviewFrame = ({ page, title }: { page: ReceiptPreviewPage; title: string }) => (
  <iframe
    title={title}
    srcDoc={page.html}
    width={page.width}
    height={page.height}
    // Skript yo'q; `allow-same-origin` — chek shriftlari (ilova domenidagi TTF) yuklanadi.
    sandbox="allow-same-origin"
    loading="lazy"
    className="block shrink-0 border border-border bg-surface"
  />
);

const PreviewLoading = () => (
  <div className="flex min-w-0 flex-wrap gap-6">
    {[0, 1, 2].map((index) => (
      <Skeleton key={index} shape="block" width={500} height={300} className="max-w-full" />
    ))}
  </div>
);

const Gallery = ({ previews }: { previews: ReceiptPreview[] }) => {
  const { t, i18n } = useTranslation("ui");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const number = (value: number) => formatNumberLocalized(value, { language, fractionDigits: 1 });
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-8">
      {previews.map((preview) => {
        const title = t(`receiptsKit.items.${preview.id}`);
        const first = preview.pages[0];
        const size = first ? `${number(first.widthMm)}×${number(first.heightMm)}` : "";
        return (
          <figure
            key={preview.id}
            data-receipt-preview={preview.id}
            className="flex min-w-0 max-w-full flex-col gap-2"
          >
            <figcaption className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-text">{title}</span>
              <span className="text-xs text-text-muted">
                {t("receiptsKit.meta", { size, scale: number(preview.pxPerMm) })}
              </span>
            </figcaption>
            <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto">
              {preview.pages.map((page, index) => (
                <PreviewFrame
                  key={index}
                  page={page}
                  title={t("receiptsKit.frameTitle", { title, page: number(index + 1) })}
                />
              ))}
            </div>
          </figure>
        );
      })}
    </div>
  );
};

export const ReceiptsSection = () => {
  const { t } = useTranslation("ui");
  const query = useReceiptPreviews();
  return (
    <KitSection id="receipts" title={t("receiptsKit.title")} description={t("receiptsKit.description")}>
      <ThemePair layout="stack">
        <QueryBoundary
          query={query}
          loading={<PreviewLoading />}
          loadingLabel={t("receiptsKit.loading")}
        >
          {(previews) => <Gallery previews={previews} />}
        </QueryBoundary>
      </ThemePair>
    </KitSection>
  );
};
