import { memo } from "react";
import { useTranslation } from "react-i18next";

const Footer = () => {
    const { t } = useTranslation();

    return (
        <footer className="hidden md:block shrink-0 w-full bg-sidebar dark:bg-maindark border-t border-gray-200 dark:border-white/5 py-3 px-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6">
                <p className="text-xs" style={{ color: "var(--color-footer-text)" }}>
                    &copy; {new Date().getFullYear()}{" "}
                    <span className="text-main font-bold">Elchi</span>
                    . {t("footerRightsReserved")}
                </p>
                <div className="hidden md:block h-3 w-px" style={{ backgroundColor: "var(--color-footer-divider)" }} />
                <div className="flex gap-4 text-xs" style={{ color: "var(--color-footer-text)" }}>
                    <a href="#" className="hover:text-main transition-colors">{t("help")}</a>
                    <a href="#" className="hover:text-main transition-colors">{t("privacyPolicy")}</a>
                </div>
            </div>
        </footer>
    );
};

export default memo(Footer);
