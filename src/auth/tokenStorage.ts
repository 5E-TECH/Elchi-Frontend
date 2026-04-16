let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken() {
    return accessToken;
  },

  setAccessToken(token: string | null) {
    accessToken = token;
  },

  clear() {
    accessToken = null;
  },
};

export default tokenStorage;
