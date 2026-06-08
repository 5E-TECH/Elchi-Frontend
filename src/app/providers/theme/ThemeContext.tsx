import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    readStoredTheme,
    writeStoredTheme,
    type StoredTheme,
} from '../../../shared/lib/preferencesStorage';

type Theme = StoredTheme;

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_SWITCHING_CLASS = 'theme-switching';

const applyTheme = (theme: Theme) => {
    if (typeof window === 'undefined') return;

    const root = window.document.documentElement;
    root.classList.add(THEME_SWITCHING_CLASS);
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    window.requestAnimationFrame(() => {
        window.setTimeout(() => {
            root.classList.remove(THEME_SWITCHING_CLASS);
        }, 80);
    });
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'dark');

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const setTheme = useCallback((nextTheme: Theme) => {
        writeStoredTheme(nextTheme);
        setThemeState(nextTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((previousTheme) => {
            const nextTheme = previousTheme === 'light' ? 'dark' : 'light';
            writeStoredTheme(nextTheme);
            return nextTheme;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
