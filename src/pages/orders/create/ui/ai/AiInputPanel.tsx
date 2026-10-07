import { memo, useEffect, useRef, useState, type ChangeEvent } from "react";
import type { AxiosError } from "axios";
import { Camera, ImagePlus, Loader2, PencilLine, Sparkles, Store, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiParse, type AiPreviewOrder } from "../../../../../entities/ai-order";
import {
  PrepareImageError,
  prepareImage,
  type PrepareImageErrorCode,
  type PreparedImage,
} from "../../../../../shared/lib/downscaleImage";
import {
  FormFieldError,
  FormStateNote,
  getActionButtonClassName,
  getFieldClassName,
  orderInputClassName,
} from "../formFieldStyles";
import { parseFailureView, parseHttpErrorView, type AiErrorView } from "./aiErrorText";

/** Backend DTO bilan bir xil: matn ko'pi bilan 4000 belgi. */
const AI_MAX_TEXT = 4000;
/**
 * BeePost'dan QATTIQROQ (5 emas): har rasm ~1600–3300 vision tokeni va
 * rasmlar keshlanmaydi — har tahlil pul.
 */
const AI_MAX_IMAGES = 3;
/** Gateway 429 qaytarsa tugma shuncha soniya bloklanadi. */
const AI_THROTTLE_SECONDS = 60;

const IMAGE_ERROR_KEYS: Record<PrepareImageErrorCode, string> = {
  too_large: "aiImageTooLarge",
  unsupported: "aiImageUnsupported",
  decode_failed: "aiImageDecodeFailed",
  heic_unsupported: "aiImageHeic",
};

type PanelImage = PreparedImage & { id: string };

type AiInputPanelProps = {
  /** Faqat admin/registrator uchun; market roli uchun server o'zi aniqlaydi. */
  marketId?: string;
  onParsed: (orders: AiPreviewOrder[], draftId?: string) => void;
  onSwitchToManual: () => void;
  /** Admin/registrator: `no_market` bo'lsa market tanlashga qaytaradi. Market rolida yo'q. */
  onSelectMarket?: () => void;
};

/**
 * AI KIRISH PANELI — matn va/yoki buyurtma varag'i surati, tahlil,
 * yuklanish holati va bekor qilish.
 *
 * ⚠️ AVTOMATIK QAYTA URINISH YO'Q: har tahlil pul sarflaydi, qayta so'rovni
 * faqat operator o'zi bosadi. Barcha tugmalar `type="button"` — panel
 * qo'lda yaratish `<form>` i ichida turadi.
 */
const AiInputPanel = ({ marketId, onParsed, onSwitchToManual, onSelectMarket }: AiInputPanelProps) => {
  const { t } = useTranslation("orders");
  const parse = useAiParse();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const nextImageId = useRef(0);

  const [text, setText] = useState("");
  const [overLimit, setOverLimit] = useState(false);
  const [images, setImages] = useState<PanelImage[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [tooManyImages, setTooManyImages] = useState(false);
  const [failure, setFailure] = useState<AiErrorView | null>(null);
  const [throttled, setThrottled] = useState(false);
  const [throttleUntil, setThrottleUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);

  const isParsing = parse.isPending;
  const throttleLeft = Math.max(0, Math.ceil((throttleUntil - now) / 1000));
  const isEmpty = !text.trim() && images.length === 0;
  const canParse = !isEmpty && !isParsing && !progress && throttleLeft === 0;
  const imagesLocked = isParsing || Boolean(progress) || images.length >= AI_MAX_IMAGES;

  useEffect(() => {
    if (throttleUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= throttleUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [throttleUntil]);

  // Sahifadan chiqilsa osilib qolgan tahlil to'xtatiladi.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    // ⚠️ Kesilmaydi: chegaradan oshadigan kiritish umuman qabul qilinmaydi.
    if (next.length > AI_MAX_TEXT) {
      setOverLimit(true);
      return;
    }
    setOverLimit(false);
    setText(next);
  };

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (files.length === 0) return;

    const free = Math.max(0, AI_MAX_IMAGES - images.length);
    const accepted = files.slice(0, free);
    setTooManyImages(files.length > free);
    setFileErrors([]);

    const errors: string[] = [];
    for (let index = 0; index < accepted.length; index += 1) {
      const file = accepted[index];
      setProgress({ current: index + 1, total: accepted.length });
      try {
        const prepared = await prepareImage(file);
        nextImageId.current += 1;
        const id = `image-${nextImageId.current}`;
        // Tayyor bo'lgani darhol eskiz sifatida ko'rinadi.
        setImages((prev) => [...prev, { ...prepared, id }]);
      } catch (error) {
        const code = error instanceof PrepareImageError ? error.code : "decode_failed";
        errors.push(`${file.name}: ${t(IMAGE_ERROR_KEYS[code])}`);
      }
    }

    setProgress(null);
    setFileErrors(errors);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
    setTooManyImages(false);
  };

  const runParse = () => {
    if (!canParse) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setFailure(null);
    setThrottled(false);

    parse.mutate(
      {
        text: text.trim() || undefined,
        market_id: marketId,
        images: images.map(({ media_type, data_base64, name }) => ({ media_type, data_base64, name })),
        signal: controller.signal,
      },
      {
        onSuccess: (response) => {
          if (!response?.ok) {
            setFailure(parseFailureView(response?.reason, { canSelectMarket: Boolean(onSelectMarket) }));
            return;
          }
          const orders = response.orders ?? [];
          onParsed(orders, response.draft_id);
          if (orders.length > 0) setCollapsed(true);
        },
        onError: (error) => {
          if ((error as AxiosError).response?.status === 429) {
            const until = Date.now() + AI_THROTTLE_SECONDS * 1000;
            setNow(Date.now());
            setThrottleUntil(until);
            setThrottled(true);
            return;
          }
          // `null` — operator o'zi bekor qildi: xato emas, hech narsa ko'rsatilmaydi.
          setFailure(parseHttpErrorView(error));
        },
        onSettled: () => {
          if (controllerRef.current === controller) controllerRef.current = null;
        },
      },
    );
  };

  const cancelParse = () => controllerRef.current?.abort();

  /** `retry` bu yerga kelmaydi — u asosiy "Tahlil" tugmasining o'zi. */
  const runFailureAction = (view: AiErrorView) => {
    if (view.action === "editText") textareaRef.current?.focus();
    else if (view.action === "selectMarket" && onSelectMarket) onSelectMarket();
    else onSwitchToManual();
  };

  if (collapsed) {
    return (
      <div
        data-testid="ai-input-collapsed"
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-primary p-3 dark:border-primarydark dark:bg-primarydark/30 sm:flex-row sm:items-center sm:justify-between sm:p-4"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-maindark dark:text-primary">
            {text.trim() || t("aiImagesOnly")}
          </p>
          <p className="text-xs text-gray-400">{t("aiInputSummary", { chars: text.length, images: images.length })}</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className={`${getActionButtonClassName({ variant: "secondary" })} min-h-11 w-full sm:min-h-10 sm:w-auto`}
        >
          <PencilLine size={16} />
          {t("aiEditInput")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-primary p-3 dark:border-primarydark dark:bg-primarydark/30 sm:gap-4 sm:p-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="ai-order-text"
          className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {t("aiTextLabel")}
        </label>
        <textarea
          ref={textareaRef}
          id="ai-order-text"
          rows={8}
          value={text}
          onChange={handleTextChange}
          readOnly={isParsing}
          placeholder={t("aiTextPlaceholder")}
          className={getFieldClassName(`${orderInputClassName} resize-y`, overLimit)}
        />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={overLimit ? "text-error" : "text-gray-400"}>{overLimit ? t("aiTextTooLong") : ""}</span>
          <span
            data-testid="ai-text-counter"
            className={`font-mono ${text.length >= AI_MAX_TEXT || overLimit ? "font-bold text-error" : "text-gray-400"}`}
          >
            {text.length} / {AI_MAX_TEXT}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Galereya: bir nechta surat. Kamera: telefonda to'g'ridan orqa kamera. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="ai-image-input"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="ai-camera-input"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        {/* Telefonda ikki alohida tugma ("Surat olish" / "Galereyadan"), ish stolida bitta. */}
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={imagesLocked}
            className={`${getActionButtonClassName({ variant: "secondary", disabled: imagesLocked })} min-h-11 px-3`}
          >
            <Camera size={16} />
            {t("aiTakePhoto")}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imagesLocked}
            className={`${getActionButtonClassName({ variant: "secondary", disabled: imagesLocked })} min-h-11 px-3`}
          >
            <ImagePlus size={16} />
            {t("aiFromGallery")}
          </button>
        </div>
        {images.length > 0 && (
          <p className="text-xs text-gray-400 sm:hidden">{t("aiImageCount", { count: images.length, max: AI_MAX_IMAGES })}</p>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={imagesLocked}
          className={`${getActionButtonClassName({
            variant: "secondary",
            disabled: imagesLocked,
          })} hidden sm:flex sm:w-auto sm:self-start`}
        >
          <ImagePlus size={16} />
          {t("aiAddImage", { count: images.length, max: AI_MAX_IMAGES })}
        </button>

        {progress && (
          <FormStateNote state="loading" message={t("aiImagePreparing", progress)} />
        )}
        {tooManyImages && <FormFieldError message={t("aiTooManyImages", { max: AI_MAX_IMAGES })} />}
        {fileErrors.map((message) => (
          <FormFieldError key={message} message={message} />
        ))}

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="ai-image-grid">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-primarydark"
              >
                <img src={image.preview} alt={image.name} className="aspect-square w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
                  {Math.round(image.bytes / 1024)} KB
                </span>
                {/* Bosish maydoni 44px, ko'rinadigan doira kichik — eskizni to'smaydi. */}
                <button
                  type="button"
                  aria-label={t("aiRemoveImage")}
                  onClick={() => removeImage(image.id)}
                  disabled={isParsing}
                  className="group absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-1"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white group-hover:bg-black/80">
                    <X size={14} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {failure && (
        <div
          role="alert"
          data-testid={failure.tone === "block" ? "ai-block" : "ai-error"}
          className={`flex flex-col gap-2 rounded-xl border p-3 text-sm ${
            failure.tone === "block"
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          <p className="font-semibold">{t(failure.title)}</p>
          <p className="text-xs">{t(failure.description)}</p>
          {failure.detail && <p className="break-words text-xs opacity-80">{failure.detail}</p>}
          {/* "Qayta urinish" asosiy tugmada — bu yerda takrorlanmaydi. */}
          {failure.action !== "retry" && (
            <button
              type="button"
              onClick={() => runFailureAction(failure)}
              className={`${getActionButtonClassName({
                variant: failure.tone === "block" ? "primary" : "secondary",
              })} min-h-11 w-full sm:min-h-10 sm:w-auto sm:self-start`}
            >
              {failure.action === "selectMarket" ? <Store size={16} /> : <PencilLine size={16} />}
              {t(failure.actionLabel)}
            </button>
          )}
        </div>
      )}

      {throttled && throttleLeft > 0 && <FormFieldError message={t("aiThrottled")} />}

      {isParsing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-main" role="status">
            <Loader2 size={18} className="animate-spin" />
            {t("aiParsing")}
          </div>
          <button
            type="button"
            onClick={cancelParse}
            className={`${getActionButtonClassName({ variant: "secondary" })} min-h-11 w-full sm:min-h-10 sm:w-auto`}
          >
            <X size={16} />
            {t("aiCancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={runParse}
          disabled={!canParse}
          className={`${getActionButtonClassName({ variant: "primary", disabled: !canParse })} min-h-11 w-full sm:min-h-10 sm:w-auto sm:self-end`}
        >
          <Sparkles size={16} />
          {throttleLeft > 0
            ? t("aiThrottleWait", { seconds: throttleLeft })
            : failure?.action === "retry"
              ? t(failure.actionLabel)
              : t("aiParseButton")}
        </button>
      )}
    </div>
  );
};

export default memo(AiInputPanel);
