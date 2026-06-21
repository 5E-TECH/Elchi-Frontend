const resolveInitialAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("accessToken");
};

let accessToken: string | null = resolveInitialAccessToken();

export type AuthSessionMetadata = {
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
  refreshTokenWarnAt: number | null;
};

const SESSION_METADATA_KEY = "authSessionMetadata";
export const AUTH_SESSION_METADATA_EVENT = "elchi:auth-session-metadata";

const emptySessionMetadata: AuthSessionMetadata = {
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  refreshTokenWarnAt: null,
};

const toNullableNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const emitSessionMetadataChange = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_METADATA_EVENT));
};

export const tokenStorage = {
  getAccessToken() {
    return accessToken;
  },

  setAccessToken(token: string | null) {
    accessToken = token;

    if (typeof window === "undefined") {
      return;
    }

    if (token) {
      window.localStorage.setItem("accessToken", token);
    } else {
      window.localStorage.removeItem("accessToken");
    }
  },

  getSessionMetadata(): AuthSessionMetadata {
    if (typeof window === "undefined") {
      return emptySessionMetadata;
    }

    try {
      const raw = window.localStorage.getItem(SESSION_METADATA_KEY);
      if (!raw) return emptySessionMetadata;
      const parsed = JSON.parse(raw) as Partial<AuthSessionMetadata>;

      return {
        accessTokenExpiresAt: toNullableNumber(parsed.accessTokenExpiresAt),
        refreshTokenExpiresAt: toNullableNumber(parsed.refreshTokenExpiresAt),
        refreshTokenWarnAt: toNullableNumber(parsed.refreshTokenWarnAt),
      };
    } catch {
      return emptySessionMetadata;
    }
  },

  setSessionMetadata(metadata: Partial<AuthSessionMetadata>) {
    if (typeof window === "undefined") {
      return;
    }

    const next: AuthSessionMetadata = {
      accessTokenExpiresAt: toNullableNumber(metadata.accessTokenExpiresAt),
      refreshTokenExpiresAt: toNullableNumber(metadata.refreshTokenExpiresAt),
      refreshTokenWarnAt: toNullableNumber(metadata.refreshTokenWarnAt),
    };

    window.localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(next));
    emitSessionMetadataChange();
  },

  clearSessionMetadata() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(SESSION_METADATA_KEY);
    emitSessionMetadataChange();
  },

  clear() {
    this.setAccessToken(null);
    this.clearSessionMetadata();
  },
};

export default tokenStorage;
