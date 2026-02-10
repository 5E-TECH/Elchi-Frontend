import { memo } from "react";
import AppRouter from "../lib/routes";
import AppProvider from "../lib/provider"

const App = () => {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
};

export default memo(App);
