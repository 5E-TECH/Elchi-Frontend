const resolveInitialAccessToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("accessToken");
};

let accessToken: string | null = resolveInitialAccessToken();

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

  clear() {
    this.setAccessToken(null);
  },
};

export default tokenStorage;
