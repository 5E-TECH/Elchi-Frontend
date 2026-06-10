export const RUNTIME_ERROR_PATH = "/runtime-error";
export const RUNTIME_ERROR_STORAGE_KEY = "elchi_runtime_error";

export interface RuntimeErrorPayload {
  message?: string;
  stack?: string;
  componentStack?: string | null;
  sourcePath?: string;
  occurredAt?: string;
}

const isRuntimeErrorPath = (path: string) =>
  path === RUNTIME_ERROR_PATH || path.startsWith(`${RUNTIME_ERROR_PATH}?`);

export const getCurrentAppPath = () => {
  if (typeof window === "undefined") return "/";

  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return isRuntimeErrorPath(path) ? "/" : path;
};

export const saveRuntimeError = (payload: RuntimeErrorPayload) => {
  window.sessionStorage.setItem(RUNTIME_ERROR_STORAGE_KEY, JSON.stringify(payload));
};

export const getRuntimeError = (): RuntimeErrorPayload | null => {
  try {
    const payload = window.sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY);
    return payload ? (JSON.parse(payload) as RuntimeErrorPayload) : null;
  } catch {
    return null;
  }
};

export const clearRuntimeError = () => {
  window.sessionStorage.removeItem(RUNTIME_ERROR_STORAGE_KEY);
};

export const getRuntimeErrorRecoveryPath = (payload?: RuntimeErrorPayload | null) => {
  const sourcePath = payload?.sourcePath?.trim();
  return sourcePath &&
    sourcePath.startsWith("/") &&
    !sourcePath.startsWith("//") &&
    !isRuntimeErrorPath(sourcePath)
    ? sourcePath
    : "/";
};
