import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserState, User } from "./types";

const initialAccessToken =
  typeof window !== "undefined"
    ? window.localStorage.getItem("accessToken")
    : null;

const initialState: UserState = {
  user: null,
  isAuthenticated: Boolean(initialAccessToken),
  accessToken: initialAccessToken,
  loading: false,
  isAppInitializing: true,
  error: null,
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

      if (typeof window !== "undefined") {
        window.localStorage.setItem("accessToken", action.payload.accessToken);

        if (action.payload.user?.role) {
          window.localStorage.setItem("role", action.payload.user.role);
        }
      }
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = Boolean(action.payload);

      if (typeof window === "undefined") {
        return;
      }

      if (action.payload) {
        window.localStorage.setItem("accessToken", action.payload);
      } else {
        window.localStorage.removeItem("accessToken");
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setAppInitializing: (state, action: PayloadAction<boolean>) => {
      state.isAppInitializing = action.payload;
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

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("accessToken");
        window.localStorage.removeItem("role");
      }
    },
  },
});

export const {
  loginSuccess,
  setAccessToken,
  setLoading,
  setAppInitializing,
  setError,
  setProfile,
  logout,
} = userSlice.actions;

export default userSlice.reducer;
