export const extractScannerToken = (value: string, origin?: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decodeToken = (candidate?: string | null) => {
    if (!candidate) return null;

    try {
      return decodeURIComponent(candidate.trim()) || null;
    } catch {
      return candidate.trim() || null;
    }
  };

  const scanMatch = trimmed.match(/\/scan\/([^/?#\s]+)/i);
  const matchedToken = decodeToken(scanMatch?.[1]);
  if (matchedToken) return matchedToken;

  try {
    const url = new URL(trimmed, origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === "scan");
    const token = decodeToken(scanIndex >= 0 ? parts[scanIndex + 1] : parts.at(-1));

    if (token) return token;
  } catch {
    // Scanner may send only token/id instead of a full URL.
  }

  return /^[A-Za-z0-9_-]{1,}$/u.test(trimmed) ? trimmed : null;
};

export const normalizeScannerCandidates = (value: string, origin?: string) => {
  const trimmed = value.trim();
  const candidates = new Set<string>();

  const addCandidate = (candidate?: string | null) => {
    if (!candidate) return;

    try {
      const decoded = decodeURIComponent(candidate.trim());
      if (decoded) candidates.add(decoded.toLowerCase());
    } catch {
      const fallback = candidate.trim();
      if (fallback) candidates.add(fallback.toLowerCase());
    }
  };

  addCandidate(extractScannerToken(trimmed, origin));
  addCandidate(trimmed);

  const scanMatch = trimmed.match(/\/scan\/([^/?#\s]+)/i);
  addCandidate(scanMatch?.[1]);

  try {
    const url = new URL(trimmed, origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const scanIndex = parts.findIndex((part) => part.toLowerCase() === "scan");
    addCandidate(scanIndex >= 0 ? parts[scanIndex + 1] : parts.at(-1));
  } catch {
    // Scanner may send only token/id instead of a full URL.
  }

  return [...candidates];
};
