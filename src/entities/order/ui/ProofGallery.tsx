import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "antd";
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2, Play } from "lucide-react";
import { proofFileName, proofKind, useProofFileUrls } from "../api/proofFiles";

/**
 * DALILLAR GALEREYASI — kuryer sotish / bekor qilishda biriktirgan rasm va
 * videolar. Plitka bosilsa lightbox ochiladi (bir nechta bo'lsa — oldingi /
 * keyingi, klaviatura strelkalari bilan).
 *
 * Har plitka o'z holatini ko'rsatadi: imzolangan URL kelguncha — yuklanmoqda,
 * xato bo'lsa (ruxsat yo'q / fayl o'chirilgan) — "ochib bo'lmadi". Bitta
 * faylning xatosi qolganlarini to'smaydi.
 */

interface ProofGalleryProps {
  /** `proof_files` kalitlari (bo'sh bo'lsa komponent hech narsa chizmaydi). */
  keys: string[];
}

const TILE =
  "group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left transition-colors dark:border-white/10 dark:bg-white/5";

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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="proof-gallery">
        {keys.map((key, index) => {
          const query = urls[index];
          const url = query?.data ?? null;
          const failed = Boolean(query?.isError || (url && brokenUrls.has(url)));
          const kind = proofKind(key);
          const name = proofFileName(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`${t("proofOpen")}: ${name}`}
              title={name}
              data-proof-kind={kind}
              className={`${TILE} cursor-pointer hover:border-main/50`}
            >
              {failed ? (
                <span className="flex flex-col items-center gap-1 p-2 text-center text-[11px] text-red-600 dark:text-red-400">
                  <AlertTriangle size={18} />
                  {t("proofLoadError")}
                </span>
              ) : !url ? (
                <Loader2 size={18} className="animate-spin text-gray-400" />
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
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900">
                      <Play size={16} />
                    </span>
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-1 p-2 text-center text-[11px] text-gray-600 dark:text-gray-300">
                  <FileText size={20} />
                  <span className="line-clamp-2 break-all">{name}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Modal
        open={openIndex !== null}
        onCancel={close}
        footer={null}
        centered
        width={900}
        destroyOnHidden
        title={
          openKey ? (
            <span className="flex min-w-0 items-center gap-2 pr-6">
              <span className="truncate">{proofFileName(openKey)}</span>
              {keys.length > 1 ? (
                <span className="shrink-0 text-xs font-normal text-gray-500 dark:text-gray-400">
                  {(openIndex ?? 0) + 1} / {keys.length}
                </span>
              ) : null}
            </span>
          ) : null
        }
      >
        <div className="flex flex-col gap-3" data-testid="proof-lightbox">
          <div className="relative flex min-h-[200px] items-center justify-center rounded-xl bg-black/90">
            {openFailed ? (
              <span className="flex flex-col items-center gap-2 p-6 text-sm text-red-300">
                <AlertTriangle size={22} />
                {t("proofLoadError")}
              </span>
            ) : !openUrl ? (
              <Loader2 size={22} className="animate-spin text-white/70" />
            ) : openKind === "image" ? (
              <img
                src={openUrl}
                alt={openKey ? proofFileName(openKey) : ""}
                onError={() => markBroken(openUrl)}
                className="max-h-[75vh] w-full object-contain"
              />
            ) : openKind === "video" ? (
              <video
                src={openUrl}
                controls
                autoPlay
                playsInline
                onError={() => markBroken(openUrl)}
                className="max-h-[75vh] w-full"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 p-6 text-sm text-white/80">
                <FileText size={28} />
                {t("proofNoPreview")}
              </span>
            )}

            {keys.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label={t("proofPrev")}
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-gray-900 hover:bg-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label={t("proofNext")}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-gray-900 hover:bg-white"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            ) : null}
          </div>

          {openUrl && !openFailed ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-main hover:underline"
            >
              <ExternalLink size={14} />
              {t("proofOpenOriginal")}
            </a>
          ) : null}
        </div>
      </Modal>
    </>
  );
};

export default memo(ProofGallery);
