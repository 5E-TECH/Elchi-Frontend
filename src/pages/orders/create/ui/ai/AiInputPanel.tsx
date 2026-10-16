// dizayn-v2: superadmin-neworders-create-ai-input, market-new-orders-create-ai-input, superadmin-neworders-create-ai-preview, admin-neworders-create-ai, manager-new-orders-create-ai, registrator-new-orders-create-ai, market-new-orders-create-ai-preview
import { memo, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { AxiosError } from "axios";
import {
  Camera,
  CircleX,
  Clock,
  FileText,
  Gauge,
  ImagePlus,
  Lock,
  Pencil,
  Power,
  ServerCrash,
  Sparkles,
  Store,
  TriangleAlert,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAiParse, type AiPreviewOrder } from "../../../../../entities/ai-order";
import { cx } from "../../../../../shared/lib/cx";
import {
  PrepareImageError,
  prepareImage,
  type PrepareImageErrorCode,
  type PreparedImage,
} from "../../../../../shared/lib/downscaleImage";
import { formatNumberLocalized } from "../../../../../shared/lib/formatMoney";
import { Button, Card, IconButton, Spinner, TextInput } from "../../../../../shared/ui/primitives";
import { CreateAlert } from "../CreateAlert";
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

/**
 * Xato sarlavhasi → ikonka (maket `market-new-orders-create-ai-input` «Panelning boshqa holatlari»).
 * Ro'yxatda yo'q sarlavha — tonning sukut ikonkasi (`CreateAlert`).
 */
const FAILURE_ICONS: Record<string, LucideIcon> = {
  aiDisabledTitle: Power,
  aiCapTitle: Gauge,
  aiInsufficientTitle: Gauge,
  aiRefusedTitle: TriangleAlert,
  aiHttpForbiddenTitle: Lock,
  aiNoMarketTitle: Store,
  aiNotFoundTitle: CircleX,
  aiTruncatedTitle: FileText,
  aiNetworkTitle: WifiOff,
  aiHttpServerTitle: ServerCrash,
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

/** Maydon ostidagi qizil matn (`.el-error-text`). */
const ErrorText = ({ children }: { children: string }) => (
  <p className="flex items-start gap-1.5 text-xs font-semibold text-danger-fg">
    <CircleX size={16} aria-hidden="true" className="mt-px shrink-0" />
    <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
  </p>
);

/**
 * AI KIRISH PANELI (maket `*-create-ai-input`) — karta «Buyurtma matni»: matn maydoni + hisoblagich,
 * buyurtma varag'i suratlari (≥ 768 — «Surat qo'shish (N/3)», telefonda «Surat olish» / «Galereyadan»),
 * eskizlar, pastda «Tahlil qilish». Holatlar karta ichida: suratlar tayyorlanmoqda, matn chegaradan oshdi,
 * tahlil (spinner + «Bekor qilish»), juda ko'p so'rov (sanoq), AI ishlatib bo'lmadi (sariq) yoki shu urinish
 * bajarilmadi (qizil). Tahlildan keyin karta «Kiritilgan matn» ko'rinishiga yig'iladi.
 *
 * ⚠️ AVTOMATIK QAYTA URINISH YO'Q: har tahlil pul sarflaydi, qayta so'rovni
 * faqat operator o'zi bosadi. Barcha tugmalar `type="button"` — panel
 * qo'lda yaratish `<form>` i ichida turadi.
 */
const AiInputPanel = ({ marketId, onParsed, onSwitchToManual, onSelectMarket }: AiInputPanelProps) => {
  const { t, i18n } = useTranslation("orders");
  const language = i18n.resolvedLanguage ?? i18n.language;
  const parse = useAiParse();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const nextImageId = useRef(0);
  const textareaId = useId();
  const counterId = useId();

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
  const counterDanger = text.length >= AI_MAX_TEXT || overLimit;
  const number = (value: number) => formatNumberLocalized(value, { language });

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
      <Card as="section" padding="md" aria-label={t("aiInputCollapsedLabel")} data-testid="ai-input-collapsed">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-text-muted"
          >
            <Sparkles size={18} />
          </span>
          <div className="flex min-w-0 flex-[999_1_240px] flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-text">{text.trim() || t("aiImagesOnly")}</span>
            <span className="text-[13px] text-text-muted">
              {t("aiInputSummary", { chars: number(text.length), images: images.length })}
            </span>
          </div>
          <Button variant="secondary" leftIcon={Pencil} onClick={() => setCollapsed(false)} className="max-md:w-full">
            {t("aiEditInput")}
          </Button>
        </div>
      </Card>
    );
  }

  const parseLabel =
    throttleLeft > 0
      ? t("aiThrottleWait", { seconds: throttleLeft })
      : failure?.action === "retry"
        ? t(failure.actionLabel)
        : t("aiParseButton");

  return (
    <Card
      title={<label htmlFor={textareaId}>{t("aiTextLabel")}</label>}
      description={t("aiTextHint")}
      bodyClassName="flex flex-col gap-5"
      footer={
        isParsing ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span role="status" className="inline-flex items-center gap-2 text-[13px] font-semibold text-action-fg">
              <Spinner size="sm" />
              {t("aiParsing")}
            </span>
            <Button variant="secondary" leftIcon={X} onClick={cancelParse}>
              {t("aiCancel")}
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-wrap justify-end">
            <Button leftIcon={Sparkles} onClick={runParse} disabled={!canParse} className="max-md:w-full">
              {parseLabel}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        <TextInput
          multiline
          ref={textareaRef}
          id={textareaId}
          rows={6}
          value={text}
          onChange={handleTextChange}
          readOnly={isParsing}
          invalid={overLimit}
          placeholder={t("aiTextPlaceholder")}
          aria-describedby={counterId}
          className="leading-[1.6]"
        />
        <div className="flex items-start justify-between gap-3">
          {overLimit ? (
            <span className="min-w-0 text-xs font-semibold text-danger-fg">{t("aiTextTooLong")}</span>
          ) : (
            <span />
          )}
          <span
            id={counterId}
            data-testid="ai-text-counter"
            className={cx(
              "whitespace-nowrap text-xs tabular-nums",
              counterDanger ? "font-semibold text-danger-fg" : "text-text-muted",
            )}
          >
            {number(text.length)} / {number(AI_MAX_TEXT)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
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

        {/* ≥ 768 — bitta «Surat qo'shish (N/3)»; telefonda ikki tugma: «Surat olish» va «Galereyadan». */}
        <div className="flex flex-wrap items-center gap-3 max-md:hidden">
          <Button variant="secondary" leftIcon={ImagePlus} onClick={() => fileInputRef.current?.click()} disabled={imagesLocked}>
            {t("aiAddImage", { count: images.length, max: AI_MAX_IMAGES })}
          </Button>
        </div>
        <div className="hidden flex-col gap-2 max-md:flex">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              leftIcon={Camera}
              onClick={() => cameraInputRef.current?.click()}
              disabled={imagesLocked}
              className="min-w-0 px-3"
            >
              {t("aiTakePhoto")}
            </Button>
            <Button
              variant="secondary"
              leftIcon={ImagePlus}
              onClick={() => fileInputRef.current?.click()}
              disabled={imagesLocked}
              className="min-w-0 px-3"
            >
              {t("aiFromGallery")}
            </Button>
          </div>
          {images.length > 0 ? (
            <span className="text-[13px] text-text-muted">
              {t("aiImageCount", { count: images.length, max: AI_MAX_IMAGES })}
            </span>
          ) : null}
        </div>

        {progress ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text-muted">
              <Spinner size="sm" />
              {t("aiImagePreparing", progress)}
            </span>
            <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-sunken">
              <span
                className="block h-full rounded-full bg-action"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </span>
          </div>
        ) : null}
        {tooManyImages ? <ErrorText>{t("aiTooManyImages", { max: AI_MAX_IMAGES })}</ErrorText> : null}
        {fileErrors.map((message) => (
          <ErrorText key={message}>{message}</ErrorText>
        ))}

        {images.length > 0 ? (
          <div role="list" aria-label={t("aiImagesLabel")} data-testid="ai-image-grid" className="flex flex-wrap gap-3">
            {images.map((image) => (
              <div key={image.id} role="listitem">
                <div className="relative size-28 overflow-hidden rounded-xl border border-border bg-sunken">
                  <img src={image.preview} alt={image.name} className="size-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 inline-flex h-6 items-center rounded-md bg-surface px-2 text-xs font-semibold leading-none text-text-muted ring-1 ring-inset ring-border">
                    {number(Math.round(image.bytes / 1024))} KB
                  </span>
                  <IconButton
                    variant="secondary"
                    size="sm"
                    icon={X}
                    label={t("aiRemoveImage", { name: image.name })}
                    onClick={() => removeImage(image.id)}
                    disabled={isParsing}
                    className="absolute right-1 top-1"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {failure ? (
        <CreateAlert
          tone={failure.tone === "block" ? "warning" : "danger"}
          role="alert"
          icon={FAILURE_ICONS[failure.title]}
          title={t(failure.title)}
          data-testid={failure.tone === "block" ? "ai-block" : "ai-error"}
          action={
            // «Qayta urinib ko'ring» — asosiy tugmaning o'zi (pastda), bu yerda takrorlanmaydi.
            failure.action !== "retry" ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={failure.action === "selectMarket" ? Store : Pencil}
                onClick={() => runFailureAction(failure)}
              >
                {t(failure.actionLabel)}
              </Button>
            ) : undefined
          }
        >
          {t(failure.description)}
          {failure.detail ? (
            <span className="mt-0.5 block text-text-muted [overflow-wrap:anywhere]">{failure.detail}</span>
          ) : null}
        </CreateAlert>
      ) : null}

      {throttled && throttleLeft > 0 ? (
        <p role="alert" className="flex items-center gap-2 text-[13px] font-semibold text-danger-fg">
          <Clock size={16} aria-hidden="true" className="shrink-0" />
          {t("aiThrottled")}
        </p>
      ) : null}
    </Card>
  );
};

export default memo(AiInputPanel);
