import { memo } from "react";
import AppRouter from "../lib/routes";
import AppProvider from "../lib/provider";
import ErrorBoundary from "../../shared/ui/ErrorBoundary";

const App = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default memo(App);
