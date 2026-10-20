type LoginPageModule = typeof import("../../features/auth");

let loadedModule: LoginPageModule | null = null;

/**
 * Kirish sahifasi moduli (rzzxMItN): `lazy` shu funksiya bilan yuklaydi; to'g'ridan-to'g'ri `/login` ochilganda
 * `main.tsx` uni chizishdan oldin chaqiradi (`loginPage.tsx`).
 */
export const preloadLoginPage = () =>
  import("../../features/auth").then((module) => {
    loadedModule = module;
    return module;
  });

/** Modul allaqachon kelgan bo'lsa — sahifa komponenti (Suspense'siz chiziladi), aks holda `null`. */
export const getPreloadedLoginPage = () => loadedModule?.default ?? null;
