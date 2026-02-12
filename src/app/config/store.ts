import { configureStore } from "@reduxjs/toolkit";
import sidebarSlice from "../../widgets/Sidebar/model/sidebarSlice";
import userReducer from "../../entities/user/model/slice";

export const store = configureStore({
  reducer: {
    sidebar: sidebarSlice,
    user: userReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; // Qo'shish