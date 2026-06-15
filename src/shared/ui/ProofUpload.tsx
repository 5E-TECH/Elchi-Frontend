import { memo, useState } from "react";
import { Paperclip, X, Loader2, FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMiscCoverage } from "../../entities/coverage/miscCoverage";

/**
 * Proof-file attach control for courier sell/cancel. Markets can require expense
 * proof (image/video) for certain sell/cancel conditions; without an upload
 * control the courier hit "isbot majburiy" with no way to comply, leaving COD
 * cash + custody stuck. Uploads to MinIO and returns the object keys, which the
 * caller passes to the order as proofFileKeys. (Audit I7.)
 */
type ProofUploadProps = {
  value: string[];
  onChange: (keys: string[]) => void;
  folder?: string;
  disabled?: boolean;
};

const ProofUpload = ({
  value,
  onChange,
  folder = "proofs",
  disabled,
}: ProofUploadProps) => {
  const { t } = useTranslation(["orders", "common"]);
  const { uploadFile } = useMiscCoverage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    setError(null);
    const newKeys: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", folder);
        const res = (await uploadFile.mutateAsync(form)) as {
          data?: { key?: string; data?: { key?: string } };
        };
        const key = res?.data?.key ?? res?.data?.data?.key;
        if (key) newKeys.push(String(key));
      }
      if (newKeys.length) onChange([...value, ...newKeys]);
    } catch {
      setError(
        t("uploadFailed", { ns: "common", defaultValue: "Yuklab bo'lmadi" }),
      );
    } finally {
      setUploading(false);
    }
  };

  const removeKey = (key: string) => onChange(value.filter((k) => k !== key));

  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
        <FileCheck size={12} className="text-blue-400" />
        {t("proof", { defaultValue: "Dalil (rasm/video)" })}
      </p>
      <label
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white/60 px-3 py-2 text-sm text-gray-600 dark:border-white/15 dark:bg-primarydark/35 dark:text-gray-300 ${
          disabled || uploading
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer hover:border-blue-400"
        }`}
      >
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Paperclip size={14} />
        )}
        {uploading
          ? t("loading", { ns: "common", defaultValue: "Yuklanmoqda…" })
          : t("attachProof", { defaultValue: "Fayl biriktirish" })}
      </label>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((key, idx) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
            >
              <FileCheck size={11} />
              {t("proofFile", { defaultValue: "Fayl" })} {idx + 1}
              <button
                type="button"
                onClick={() => removeKey(key)}
                className="ml-0.5 rounded-full hover:bg-blue-200/60 dark:hover:bg-blue-400/20"
                aria-label="remove"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
};

export default memo(ProofUpload);
