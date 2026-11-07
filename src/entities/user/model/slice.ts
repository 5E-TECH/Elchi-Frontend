import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionRestoreState, UserState, User } from "./types";

const initialAccessToken =
  typeof window !== "undefined"
    ? window.sessionStorage.getItem("accessToken")
    : null;

const startsOnLoginPage =
  typeof window !== "undefined" && window.location.pathname === "/login";

const initialState: UserState = {
  user: null,
  isAuthenticated: Boolean(initialAccessToken),
  accessToken: initialAccessToken,
  loading: false,
  isAppInitializing: Boolean(initialAccessToken) || !startsOnLoginPage,
  error: null,
  sessionRestore: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    loginSuccess: (
      state,
      action: PayloadAction<{ accessToken: string; user?: User | null }>,
    ) => {
      state.loading = false;
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user ?? state.user;
      state.isAuthenticated = true;
      state.error = null;
      state.sessionRestore = null;
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = Boolean(action.payload);

    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAppInitializing: (state, action: PayloadAction<boolean>) => {
      state.isAppInitializing = action.payload;
    },
    /** «Internet sekin — qayta urinilmoqda» ekrani holati (`auth/authService.ts` — sessiyani tiklash). */
    setSessionRestore: (state, action: PayloadAction<SessionRestoreState | null>) => {
      state.sessionRestore = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setProfile: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.sessionRestore = null;
    },
  },
});

export const {
  loginSuccess,
  setAccessToken,
  setLoading,
  setAppInitializing,
  setSessionRestore,
  setError,
  setProfile,
  logout,
} = userSlice.actions;

export default userSlice.reducer;
