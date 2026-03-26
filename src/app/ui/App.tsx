import { memo } from "react";
import AppRouter from "../lib/routes";
import AppProvider from "../lib/provider";
import ErrorBoundary from "../../shared/ui/ErrorBoundary";
import ErrorBoundaryTestButton from "../../shared/ui/ErrorBoundaryTestButton";

const App = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRouter />
        {import.meta.env.DEV && <ErrorBoundaryTestButton />}
      </AppProvider>
    </ErrorBoundary>
  );
};

export default memo(App);
