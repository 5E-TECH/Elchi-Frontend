import { memo, useState } from "react";

const ErrorBoundaryTestButton = () => {
  const [shouldCrash, setShouldCrash] = useState(false);

  if (shouldCrash) {
    throw new Error("ErrorBoundary test xatoligi");
  }

  return (
    <button
      type="button"
      onClick={() => setShouldCrash(true)}
      className="fixed bottom-4 right-4 z-50 rounded-xl border border-main/20 bg-primary px-4 py-2 text-sm font-semibold text-main shadow-lg transition-opacity duration-200 hover:opacity-90 dark:bg-primarydark"
    >
      ErrorBoundary test
    </button>
  );
};

export default memo(ErrorBoundaryTestButton);
