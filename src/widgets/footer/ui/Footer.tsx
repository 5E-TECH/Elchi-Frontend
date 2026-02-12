import { memo } from "react";

const Footer = () => {
    return (
        <footer className="w-full bg-sidebar backdrop-blur-md border-t border-main py-6 px-8 text-center text-sm text-maindark transition-colors duration-300">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p>&copy; {new Date().getFullYear()} <span className="text-[--main] font-bold">Elchi</span>. Barcha huquqlar himoyalangan.</p>
                <div className="flex gap-6">
                    <a href="#" className="hover:text-[--main] transition-colors">Yordam</a>
                    <a href="#" className="hover:text-[--main] transition-colors">Maxfiylik siyosati</a>
                </div>
            </div>
        </footer>
    );
};

export default memo(Footer);
