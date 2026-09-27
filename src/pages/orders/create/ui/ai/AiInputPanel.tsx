import { memo, useEffect, useRef, useState, type ChangeEvent } from "react";
import { isCancel, type AxiosError } from "axios";
import { ImagePlus, Loader2, PencilLine, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAiParse,
  type AiParseFailureReason,
  type AiPreviewOrder,
} from "../../../../../entities/ai-order";
import {
  PrepareImageError,
  prepareImage,
  type PrepareImageErrorCode,
  type PreparedImage,
} from "../../../../../shared/lib/downscaleImage";
import { getBackendErrorMessage } from "../../../../../shared/lib/backendError";
import {
  FormFieldError,
  FormStateNote,
  getActionButtonClassName,
  getFieldClassName,
  orderInputClassName,
} from "../formFieldStyles";

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

/**
 * Operator qo'lda yaratishga o'tishi kerak bo'lgan holatlar — har biri
 * O'Z matni bilan. ⚠️ `cap_exceeded` "AI o'chirilgan" deb ko'rsatilmaydi:
 * AI ishlaydi, faqat bugungi xarajat limiti tugagan.
 */
type AiBlockKind = "disabled" | "cap_exceeded" | "refused";

const BLOCK_TEXT: Record<AiBlockKind, { title: string; description: string; action: string }> = {
  disabled: { title: "aiDisabledTitle", description: "aiDisabledDescription", action: "aiCreateManually" },
  cap_exceeded: { title: "aiCapTitle", description: "aiCapDescription", action: "aiEnterManually" },
  refused: { title: "aiRefusedTitle", description: "aiRefusedDescription", action: "aiEnterManually" },
};

/** Qolgan sabablar — xato matni (hammasi bir xil "AI o'qiy olmadi" emas). */
const REASON_ERROR_KEYS: Partial<Record<AiParseFailureReason, string>> = {
  truncated: "aiReasonTruncated",
  network: "aiReasonNetwork",
  ai_error: "aiReasonNetwork",
  no_market: "aiReasonNoMarket",
};

const toBlockKind = (reason?: AiParseFailureReason): AiBlockKind | null => {
  if (reason === "disabled" || reason === "ai_off") return "disabled";
  if (reason === "cap_exceeded" || reason === "refused") return reason;
  return null;
};

type AiInputPanelProps = {
  /** Faqat admin/registrator uchun; market roli uchun server o'zi aniqlaydi. */
  marketId?: string;
  onParsed: (orders: AiPreviewOrder[], draftId?: string) => void;
  onSwitchToManual: () => void;
};

/**
 * AI KIRISH PANELI — matn va/yoki buyurtma varag'i surati, tahlil,
 * yuklanish holati va bekor qilish.
 *
 * ⚠️ AVTOMATIK QAYTA URINISH YO'Q: har tahlil pul sarflaydi, qayta so'rovni
 * faqat operator o'zi bosadi. Barcha tugmalar `type="button"` — panel
 * qo'lda yaratish `<form>` i ichida turadi.
 */
const AiInputPanel = ({ marketId, onParsed, onSwitchToManual }: AiInputPanelProps) => {
  const { t } = useTranslation("orders");
  const parse = useAiParse();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const nextImageId = useRef(0);

  const [text, setText] = useState("");
  const [overLimit, setOverLimit] = useState(false);
  const [images, setImages] = useState<PanelImage[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [tooManyImages, setTooManyImages] = useState(false);
  const [parseError, setParseError] = useState("");
  const [block, setBlock] = useState<AiBlockKind | null>(null);
  const [retryKey, setRetryKey] = useState("aiRetryParse");
  const [throttleUntil, setThrottleUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);

  const isParsing = parse.isPending;
  const throttleLeft = Math.max(0, Math.ceil((throttleUntil - now) / 1000));
  const isEmpty = !text.trim() && images.length === 0;
  const canParse = !isEmpty && !isParsing && !progress && throttleLeft === 0;

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
    setParseError("");
    setBlock(null);
    setRetryKey("aiRetryParse");

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
            const kind = toBlockKind(response?.reason);
            if (kind) {
              setBlock(kind);
              return;
            }
            const reasonKey = response?.reason ? REASON_ERROR_KEYS[response.reason] : undefined;
            setParseError(t(reasonKey ?? "aiParseFailed"));
            // Tarmoq/AI javob bermadi — faqat shu holatda "Qayta urinib ko'ring".
            if (response?.reason === "network" || response?.reason === "ai_error") setRetryKey("aiRetryAgain");
            return;
          }
          const orders = response.orders ?? [];
          onParsed(orders, response.draft_id);
          if (orders.length > 0) setCollapsed(true);
        },
        onError: (error) => {
          // Operator o'zi bekor qildi — xato emas, hech narsa ko'rsatilmaydi.
          if (isCancel(error)) return;
          if ((error as AxiosError).response?.status === 429) {
            const until = Date.now() + AI_THROTTLE_SECONDS * 1000;
            setNow(Date.now());
            setThrottleUntil(until);
            setParseError(t("aiThrottled"));
            return;
          }
          setParseError(getBackendErrorMessage(error) ?? t("aiParseRequestFailed"));
        },
        onSettled: () => {
          if (controllerRef.current === controller) controllerRef.current = null;
        },
      },
    );
  };

  const cancelParse = () => controllerRef.current?.abort();

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
          className={`${getActionButtonClassName({ variant: "secondary" })} w-full sm:w-auto`}
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
          className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:text-xs"
        >
          {t("aiTextLabel")}
        </label>
        <textarea
          id="ai-order-text"
          rows={8}
          value={text}
          onChange={handleTextChange}
          readOnly={isParsing}
          placeholder={t("aiTextPlaceholder")}
          className={getFieldClassName(`${orderInputClassName} resize-y`, overLimit)}
        />
        <div className="flex items-center justify-between gap-2 text-[11px]">
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          data-testid="ai-image-input"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isParsing || Boolean(progress) || images.length >= AI_MAX_IMAGES}
          className={`${getActionButtonClassName({
            variant: "secondary",
            disabled: isParsing || Boolean(progress) || images.length >= AI_MAX_IMAGES,
          })} w-full sm:w-auto sm:self-start`}
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
                <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {Math.round(image.bytes / 1024)} KB
                </span>
                <button
                  type="button"
                  aria-label={t("aiRemoveImage")}
                  onClick={() => removeImage(image.id)}
                  disabled={isParsing}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {block && (
        <div
          data-testid="ai-block"
          className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <p className="font-semibold">{t(BLOCK_TEXT[block].title)}</p>
          <p className="text-xs">{t(BLOCK_TEXT[block].description)}</p>
          <button
            type="button"
            onClick={onSwitchToManual}
            className={`${getActionButtonClassName({ variant: "primary" })} w-full sm:w-auto sm:self-start`}
          >
            <PencilLine size={16} />
            {t(BLOCK_TEXT[block].action)}
          </button>
        </div>
      )}

      <FormFieldError message={parseError} />

      {isParsing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-main" role="status">
            <Loader2 size={18} className="animate-spin" />
            {t("aiParsing")}
          </div>
          <button
            type="button"
            onClick={cancelParse}
            className={`${getActionButtonClassName({ variant: "secondary" })} w-full sm:w-auto`}
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
          className={`${getActionButtonClassName({ variant: "primary", disabled: !canParse })} w-full sm:w-auto sm:self-end`}
        >
          <Sparkles size={16} />
          {throttleLeft > 0
            ? t("aiThrottleWait", { seconds: throttleLeft })
            : parseError
              ? t(retryKey)
              : t("aiParseButton")}
        </button>
      )}
    </div>
  );
};

export default memo(AiInputPanel);
