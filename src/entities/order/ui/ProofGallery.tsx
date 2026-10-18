// dizayn-v2: (maket yo'q) superadmin-orders-detail
import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Play, TriangleAlert } from "lucide-react";
import { Dialog, IconButton, Pressable, Spinner } from "../../../shared/ui/primitives";
import { proofFileName, proofKind, useProofFileUrls } from "../api/proofFiles";

/**
 * DALILLAR GALEREYASI — kuryer sotish / bekor qilishda biriktirgan rasm va
 * videolar. Plitka bosilsa lightbox ochiladi (bir nechta bo'lsa — oldingi /
 * keyingi, klaviatura strelkalari bilan).
 *
 * Har plitka o'z holatini ko'rsatadi: imzolangan URL kelguncha — yuklanmoqda,
 * xato bo'lsa (ruxsat yo'q / fayl o'chirilgan) — "ochib bo'lmadi". Bitta
 * faylning xatosi qolganlarini to'smaydi.
 *
 * Dizayn v2 (maket yo'q — buyurtma tafsilotidagi «Dalillar» kartasi): plitkalar `bg-sunken`,
 * ko'rish oynasi — `Dialog` (telefonda pastki varaqa).
 */

interface ProofGalleryProps {
  /** `proof_files` kalitlari (bo'sh bo'lsa komponent hech narsa chizmaydi). */
  keys: string[];
}

const TILE =
  "group relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-sunken text-left transition-[border-color] duration-150 hover:border-action motion-reduce:transition-none";

const ProofGallery = ({ keys }: ProofGalleryProps) => {
  const { t } = useTranslation("orders");
  const urls = useProofFileUrls(keys);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // URL olindi, lekin brauzer uni ocha olmadi (masalan MinIO tashqariga yopiq) —
  // buzilgan rasm belgisi o'rniga "ochib bo'lmadi".
  const [brokenUrls, setBrokenUrls] = useState<ReadonlySet<string>>(() => new Set());
  const markBroken = useCallback(
    (url: string) => setBrokenUrls((current) => (current.has(url) ? current : new Set(current).add(url))),
    [],
  );

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) => (current === null ? current : (current + delta + keys.length) % keys.length)),
    [keys.length],
  );

  useEffect(() => {
    if (openIndex === null || keys.length < 2) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, keys.length, step]);

  if (keys.length === 0) return null;

  const openKey = openIndex === null ? null : keys[openIndex];
  const openQuery = openIndex === null ? null : urls[openIndex];
  const openUrl = openQuery?.data ?? null;
  const openFailed = Boolean(openQuery?.isError || (openUrl && brokenUrls.has(openUrl)));
  const openKind = openKey ? proofKind(openKey) : "file";

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4" data-testid="proof-gallery">
        {keys.map((key, index) => {
          const query = urls[index];
          const url = query?.data ?? null;
          const failed = Boolean(query?.isError || (url && brokenUrls.has(url)));
          const kind = proofKind(key);
          const name = proofFileName(key);
          return (
            <Pressable
              key={key}
              onClick={() => setOpenIndex(index)}
              aria-label={`${t("proofOpen")}: ${name}`}
              title={name}
              data-proof-kind={kind}
              className={TILE}
            >
              {failed ? (
                <span className="flex flex-col items-center gap-1 p-2 text-center text-xs text-danger-fg">
                  <TriangleAlert size={18} aria-hidden="true" />
                  {t("proofLoadError")}
                </span>
              ) : !url ? (
                <Spinner size="sm" />
              ) : kind === "image" ? (
                <img
                  src={url}
                  alt={name}
                  loading="lazy"
                  onError={() => markBroken(url)}
                  className="h-full w-full object-cover"
                />
              ) : kind === "video" ? (
                <>
                  <video
                    src={url}
                    muted
                    playsInline
                    preload="metadata"
                    onError={() => markBroken(url)}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-overlay/40">
                    <span className="flex size-9 items-center justify-center rounded-full bg-surface text-text">
                      <Play size={16} aria-hidden="true" />
                    </span>
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-1 p-2 text-center text-xs text-text-muted">
                  <FileText size={20} aria-hidden="true" />
                  <span className="line-clamp-2 break-all">{name}</span>
                </span>
              )}
            </Pressable>
          );
        })}
      </div>

      <Dialog
        open={openIndex !== null}
        onClose={close}
        size="xl"
        className="md:max-w-[900px]"
        title={
          openKey ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate">{proofFileName(openKey)}</span>
              {keys.length > 1 ? (
                <span className="shrink-0 text-[13px] font-normal text-text-muted">
                  {(openIndex ?? 0) + 1} / {keys.length}
                </span>
              ) : null}
            </span>
          ) : (
            t("proofTitle")
          )
        }
      >
        <div className="flex flex-col gap-3" data-testid="proof-lightbox">
          <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl bg-sunken">
            {openFailed ? (
              <span className="flex flex-col items-center gap-2 p-6 text-sm text-danger-fg">
                <TriangleAlert size={22} aria-hidden="true" />
                {t("proofLoadError")}
              </span>
            ) : !openUrl ? (
              <Spinner size="md" />
            ) : openKind === "image" ? (
              <img
                src={openUrl}
                alt={openKey ? proofFileName(openKey) : ""}
                onError={() => markBroken(openUrl)}
                className="max-h-[70vh] w-full object-contain"
              />
            ) : openKind === "video" ? (
              <video
                src={openUrl}
                controls
                autoPlay
                playsInline
                onError={() => markBroken(openUrl)}
                className="max-h-[70vh] w-full"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 p-6 text-sm text-text-muted">
                <FileText size={28} aria-hidden="true" />
                {t("proofNoPreview")}
              </span>
            )}

            {keys.length > 1 ? (
              <>
                <IconButton
                  variant="secondary"
                  icon={ChevronLeft}
                  label={t("proofPrev")}
                  onClick={() => step(-1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                />
                <IconButton
                  variant="secondary"
                  icon={ChevronRight}
                  label={t("proofNext")}
                  onClick={() => step(1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                />
              </>
            ) : null}
          </div>

          {openUrl && !openFailed ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-action-fg hover:underline md:min-h-0"
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t("proofOpenOriginal")}
            </a>
          ) : null}
        </div>
      </Dialog>
    </>
  );
};

export default memo(ProofGallery);
