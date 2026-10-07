import { api, LONG_REQUEST_TIMEOUT_MS } from "../api/api";
import { getBackendErrorMessage } from "./backendError";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Excel yuklash xatosining matni. `responseType: "blob"` bo'lgani uchun
 * backend xabari JSON emas, Blob ichida keladi — o'qib olinadi.
 */
const readBlobText = (blob: Blob): Promise<string> =>
  typeof blob.text === "function"
    ? blob.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

export const getExportErrorMessage = async (error: unknown): Promise<string | undefined> => {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await readBlobText(data);
      return text ? getBackendErrorMessage({ response: { data: JSON.parse(text) } }) : undefined;
    } catch {
      return undefined;
    }
  }
  return getBackendErrorMessage(error);
};

/** Brauzerda faylni saqlash (vaqtinchalik `<a download>`). */
export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** `GET <endpoint>` → .xlsx fayl sifatida yuklab olish (uzun eksport uchun 120 s). */
export const downloadXlsx = async (endpoint: string, params: Record<string, unknown>, fileName: string) => {
  const response = await api.get(endpoint, {
    params,
    responseType: "blob",
    timeout: LONG_REQUEST_TIMEOUT_MS,
  });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: XLSX_MIME });
  saveBlob(blob, fileName);
};
