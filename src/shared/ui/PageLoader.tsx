import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logoo.png';

const PARTICLES = Array.from({ length: 12 }, (_, index) => ({
    top: `${(index * 37 + 11) % 100}%`,
    left: `${(index * 61 + 7) % 100}%`,
    animationDelay: `${((index * 13) % 25) / 5}s`,
    opacity: 0.08 + ((index * 7) % 20) / 100,
}));

/**
 * PageLoader — "Quantum Pulse" Edition
 * Premium, 3D-effect, high-fidelity loading animation.
 */
const PageLoader = () => {
    const { t } = useTranslation(["common", "mails"]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 30);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={`
                page-loader-shell fixed inset-0 z-[9999]
                flex flex-col items-center justify-center
                transition-all duration-700
                ${isVisible ? 'animate-loader-in' : 'opacity-0'}
            `}
            role="status"
            aria-label={t("common:loading")}
        >
            {/* ── Background Aurora Effects ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none animate-aurora">
                <div
                    className="page-loader-aurora-orb-main absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full opacity-20 blur-[100px]"
                />
                <div
                    className="page-loader-aurora-orb-secondary absolute right-[-10%] bottom-[-10%] h-[50%] w-[50%] rounded-full opacity-15 blur-[100px]"
                />

                {/* Particles */}
                {PARTICLES.map((style, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full animate-float-particle"
                        style={style}
                    />
                ))}
            </div>

            {/* ── Main Animation Core ── */}
            <div className="relative flex items-center justify-center mb-16">

                {/* Outer Ring - Dynamic Conic */}
                <div
                    className="absolute animate-spin-ring"
                    style={{
                        width: '360px',
                        height: '360px',
                        borderRadius: '50%',
                        background: `conic-gradient(from 0deg, transparent, var(--color-main), transparent)`,
                        padding: '2px',
                        maskImage: `radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))`,
                        WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))`,
                        opacity: 0.4
                    }}
                />

                {/* Middle Ring - Reverse Rotation */}
                <div
                    className="absolute animate-spin-ring-rev"
                    style={{
                        width: '310px',
                        height: '310px',
                        borderRadius: '50%',
                        border: '2px dashed var(--color-purple-light)',
                        opacity: 0.2
                    }}
                />

                {/* Inner Glow Ring */}
                <div
                    className="absolute animate-spin-ring-slow"
                    style={{
                        width: '260px',
                        height: '260px',
                        borderRadius: '50%',
                        background: `linear-gradient(to right, var(--color-main), var(--color-purple))`,
                        padding: '3px',
                        maskImage: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
                        WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
                        filter: 'blur(1px)'
                    }}
                />

                {/* Logo Container with Glassmorphism */}
                <div
                    className={`
                        relative z-10 flex items-center justify-center
                        w-56 h-56 rounded-full animate-pulse-glow
                        ${isVisible ? 'animate-logo-reveal' : 'opacity-0'}
                    `}
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 0 80px rgba(87, 106, 219, 0.25), inset 0 0 30px rgba(255, 255, 255, 0.05)'
                    }}
                >
                    <img
                        src={logo}
                        alt="Elchi Logo"
                        className="w-32 h-32 object-contain filter drop-shadow(0 0 12px rgba(255,255,255,0.4))"
                        draggable={false}
                    />
                </div>
            </div>

            {/* ── Brand Typography ── */}
            <div className={`text-center transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <h1
                    className="text-3xl font-black tracking-[0.6em] uppercase animate-letter-expand"
                    style={{
                        color: 'var(--color-primary)',
                        textShadow: '0 0 20px rgba(255, 255, 255, 0.2)'
                    }}
                >
                    Elchi
                </h1>
                <div className="flex items-center justify-center gap-3 mt-4">
                    <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-white/20" />
                    <p
                        className="text-xs font-medium tracking-[0.3em] uppercase opacity-40"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        {t("mails:title")}
                    </p>
                    <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-white/20" />
                </div>
            </div>

            {/* ── Progress Indicators ── */}
            <div className="absolute bottom-12 flex gap-3">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full animate-dot-bounce"
                        style={{
                            background: i === 1 ? 'var(--color-main)' : 'rgba(255, 255, 255, 0.2)',
                            animationDelay: `${i * 0.15}s`,
                            boxShadow: i === 1 ? '0 0 10px var(--color-main)' : 'none'
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default memo(PageLoader);
