const resolveInitialAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem("accessToken");
};

let accessToken: string | null = resolveInitialAccessToken();

export type AuthSessionMetadata = {
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
  refreshTokenWarnAt: number | null;
};

const SESSION_METADATA_KEY = "authSessionMetadata";
const AUTH_USER_ID_KEY = "authUserId";
const AUTH_USER_ROLE_KEY = "authUserRole";
export const AUTH_SESSION_METADATA_EVENT = "elchi:auth-session-metadata";

type AuthIdentity = {
  id?: string | null;
  role?: string | null;
};

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
      window.sessionStorage.setItem("accessToken", token);
      window.localStorage.removeItem("accessToken");
    } else {
      window.sessionStorage.removeItem("accessToken");
      window.localStorage.removeItem("accessToken");
    }
  },

  getSessionMetadata(): AuthSessionMetadata {
    if (typeof window === "undefined") {
      return emptySessionMetadata;
    }

    try {
      const raw = window.sessionStorage.getItem(SESSION_METADATA_KEY);
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

    window.sessionStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(next));
    window.localStorage.removeItem(SESSION_METADATA_KEY);
    emitSessionMetadataChange();
  },

  clearSessionMetadata() {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(SESSION_METADATA_KEY);
    window.localStorage.removeItem(SESSION_METADATA_KEY);
    emitSessionMetadataChange();
  },

  getAuthIdentity(): AuthIdentity {
    if (typeof window === "undefined") {
      return {};
    }

    return {
      id: window.sessionStorage.getItem(AUTH_USER_ID_KEY),
      role: window.sessionStorage.getItem(AUTH_USER_ROLE_KEY),
    };
  },

  setAuthIdentity({ id, role }: AuthIdentity) {
    if (typeof window === "undefined") {
      return;
    }

    if (id) window.sessionStorage.setItem(AUTH_USER_ID_KEY, id);
    if (role) window.sessionStorage.setItem(AUTH_USER_ROLE_KEY, role);
  },

  clearAuthIdentity() {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.removeItem(AUTH_USER_ID_KEY);
    window.sessionStorage.removeItem(AUTH_USER_ROLE_KEY);
  },

  tokenMatchesCurrentSession(token: string) {
    const expected = this.getAuthIdentity();
    if (!expected.id && !expected.role) return true;

    const actual = decodeJwtPayload(token);
    if (!actual) return false;

    return (
      (!expected.id || expected.id === actual.id) &&
      (!expected.role || expected.role === actual.role)
    );
  },

  clear() {
    this.setAccessToken(null);
    this.clearSessionMetadata();
    this.clearAuthIdentity();
  },
};

const decodeJwtPayload = (token: string): AuthIdentity | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(padded)) as {
      id?: string;
      sub?: string;
      role?: string;
      roles?: string[];
    };

    return {
      id: decoded.id ?? decoded.sub,
      role: decoded.role ?? decoded.roles?.[0],
    };
  } catch {
    return null;
  }
};

export default tokenStorage;
