import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserState, User } from "./types";

const initialState: UserState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  isAuthenticated: !!localStorage.getItem("accessToken"),
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: null,
  loading: false,
  isAppInitializing: true,
  error: null,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{ accessToken: string; user?: User | null }>) => {
      state.loading = false;
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user ?? state.user;
      state.isAuthenticated = true;
      state.error = null;
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      state.isAuthenticated = Boolean(action.payload);
    loginSuccess: (
      state,
      action: PayloadAction<{ accessToken: string; user: User; refreshToken?: string | null }>,
    ) => {
      state.loading = false;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem("accessToken", action.payload.accessToken);
      localStorage.setItem("role", action.payload.user.role);
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
    },
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
    }
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
