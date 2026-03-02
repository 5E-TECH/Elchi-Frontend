import { memo, useEffect, useState } from 'react';
import logo from '../assets/logoo.png';

/**
 * PageLoader — Brendga mos, zamonaviy loading animatsiyasi.
 * React Suspense fallback sifatida ishlatiladi.
 *
 * Animatsiya bosqichlari:
 * 1. Overlay fade-in
 * 2. Logo scale + fade reveal
 * 3. Gradient ring aylanishi (logo atrofida)
 * 4. 3 ta bounce dot (pastda)
 * 5. Komponent unmount bo'lishida smooth fade-out
 */
const PageLoader = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Minimal delay bilan trigger — smooth kirish uchun
        const timer = setTimeout(() => setIsVisible(true), 30);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div
            className={`
        fixed inset-0 z-[9999]
        flex flex-col items-center justify-center
        transition-opacity duration-400
        ${isVisible ? 'animate-loader-in' : 'opacity-0'}
      `}
            style={{
                background: `linear-gradient(135deg, var(--color-maindark) 0%, #1a1835 50%, var(--color-maindark) 100%)`,
            }}
            role="status"
            aria-label="Yuklanmoqda"
        >
            {/* ── Fon dekor nurlari ── */}
            <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                aria-hidden="true"
            >
                {/* Chap yuqori gradient doira */}
                <div
                    className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
                    style={{ background: `radial-gradient(circle, var(--color-main), transparent 70%)` }}
                />
                {/* O'ng pastki gradient doira */}
                <div
                    className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl"
                    style={{ background: `radial-gradient(circle, var(--color-purple), transparent 70%)` }}
                />
                {/* Markaziy yumshoq glow */}
                <div
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <div
                        className="w-64 h-64 rounded-full opacity-10 blur-2xl"
                        style={{ background: `radial-gradient(circle, var(--color-main), transparent 60%)` }}
                    />
                </div>
            </div>

            {/* ── Logo + Ring konteyner ── */}
            <div className="relative flex items-center justify-center mb-10">

                {/* Aylanuvchi gradient ring (tashqi) */}
                <div
                    className="absolute animate-spin-ring"
                    aria-hidden="true"
                    style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        background: `conic-gradient(
              from 0deg,
              var(--color-main),
              var(--color-purple),
              var(--color-main)
            )`,
                        padding: '3px',
                        maskImage: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
                        WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))`,
                    }}
                />

                {/* Ichki statik ring (depth effekti) */}
                <div
                    className="absolute"
                    aria-hidden="true"
                    style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        border: '1px solid var(--color-glass-border)',
                    }}
                />

                {/* Logo konteyner */}
                <div
                    className={`
            relative z-10 flex items-center justify-center
            w-24 h-24 rounded-full
            ${isVisible ? 'animate-logo-reveal' : 'opacity-0'}
          `}
                    style={{
                        background: `rgba(255, 255, 255, 0.06)`,
                        backdropFilter: 'blur(8px)',
                        border: '1px solid var(--color-glass-border)',
                        boxShadow: `0 0 40px rgba(87, 106, 219, 0.3)`,
                    }}
                >
                    <img
                        src={logo}
                        alt="Elchi Logo"
                        className="w-14 h-14 object-contain"
                        draggable={false}
                    />
                </div>
            </div>

            {/* ── Brand nomi ── */}
            <div
                className={`
          mb-8 text-center
          ${isVisible ? 'animate-logo-reveal' : 'opacity-0'}
        `}
                style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
            >
                <h1
                    className="text-2xl font-bold tracking-widest uppercase"
                    style={{ color: 'var(--color-primary)' }}
                >
                    Elchi
                </h1>
                <p
                    className="text-sm mt-1 tracking-wider"
                    style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                >
                    Admin Panel
                </p>
            </div>

            {/* ── Bounce Dots ── */}
            <div
                className="flex items-end gap-2"
                aria-hidden="true"
            >
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="block rounded-full animate-dot-bounce"
                        style={{
                            width: '8px',
                            height: '8px',
                            background: i === 1
                                ? `var(--color-main)`
                                : `var(--color-purple-light)`,
                            animationDelay: `${i * 0.18}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default memo(PageLoader);
