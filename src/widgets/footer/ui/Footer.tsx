import { memo } from "react";

const Footer = () => {
    return (
        <footer className="w-full bg-sidebar backdrop-blur-md border-t dark:bg-maindark border-main py-4 md:py-6 px-4 md:px-8 text-center text-sm text-maindark transition-colors duration-300 pb-24 md:pb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-xs md:text-sm">&copy; {new Date().getFullYear()} <span className="text-[--main] font-bold">Elchi</span>. Barcha huquqlar himoyalangan.</p>
                <div className="flex gap-4 md:gap-6 text-xs md:text-sm">
                    <a href="#" className="hover:text-[--main] transition-colors">Yordam</a>
                    <a href="#" className="hover:text-[--main] transition-colors">Maxfiylik siyosati</a>
                </div>
            </div>
        </footer>
    );
};

export default memo(Footer);
