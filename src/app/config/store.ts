import { configureStore } from "@reduxjs/toolkit";
import sidebarSlice from "../../widgets/Sidebar/model/sidebarSlice";
import userReducer from "../../entities/user/model/slice";
import logout from "../../entities/user/model/slice";
import filterslice from "../../features/Select/model/FilterSlice"

export const store = configureStore({
  reducer: {
    sidebar: sidebarSlice,
    user: userReducer,
    filter:filterslice,
    logout
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; // Qo'shish