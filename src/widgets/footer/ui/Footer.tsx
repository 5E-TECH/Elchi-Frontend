import { memo } from "react";

const Footer = () => {
    return (
        <footer className="shrink-0 w-full bg-sidebar dark:bg-maindark border-t border-gray-200 dark:border-white/5 py-3 px-6 transition-colors duration-300">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6">
                <p className="text-xs text-gray-400 dark:text-white/30">
                    &copy; {new Date().getFullYear()}{" "}
                    <span className="text-main font-bold">Elchi</span>
                    . Barcha huquqlar himoyalangan.
                </p>
                <div className="hidden md:block w-px h-3 bg-gray-300 dark:bg-white/10" />
                <div className="flex gap-4 text-xs text-gray-400 dark:text-white/30">
                    <a href="#" className="hover:text-main transition-colors">Yordam</a>
                    <a href="#" className="hover:text-main transition-colors">Maxfiylik siyosati</a>
                </div>
            </div>
        </footer>
    );
};

export default memo(Footer);
