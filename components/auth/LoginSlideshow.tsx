'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

const images = ['/images/1.webp', '/images/2.webp', '/images/3.webp', '/images/4.webp'];

const headlines = [
  { top: 'Try a Free', bottom: 'Demo Session', sub: 'Experience a live 30-minute class with our expert teachers — no commitment required' },
  { top: 'Live Classes,', bottom: 'Real Results', sub: 'Interactive whiteboards, HD video & real-time doubt clearing in every session' },
  { top: 'Smart Attention', bottom: 'Monitoring', sub: 'AI-powered focus tracking ensures every student stays engaged throughout the class' },
  { top: 'Trusted by', bottom: 'Parents & Students', sub: 'Detailed session reports, attendance tracking & transparent progress updates' },
];

/**
 * Fullscreen cinematic slideshow with Ken-Burns zoom effect.
 * Shuffled order, 10 s per slide, 1.5 s crossfade.
 */
export default function LoginSlideshow() {
  const platformName = usePlatformName();
  const [current, setCurrent] = useState(0);
  const [shuffled, setShuffled] = useState<number[]>([]);

  useEffect(() => {
    const order = [0, 1, 2, 3];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setShuffled(order);
  }, []);

  const advance = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, []);

  useEffect(() => {
    if (shuffled.length === 0) return;
    // 14s per slide: 12s animation (zoom-in 6s + zoom-out 6s) + 2s hold before crossfade
    const timer = setInterval(advance, 14000);
    return () => clearInterval(timer);
  }, [shuffled, advance]);

  if (shuffled.length === 0) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Stacked images with Ken-Burns zoom */}
      {shuffled.map((imgIdx, i) => (
        <div
          key={imgIdx}
          className="absolute inset-0 transition-opacity duration-1500 ease-in-out"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img
            src={images[imgIdx]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              animation: i === current ? 'kenburns 12s ease-in-out' : 'none',
            }}
          />
        </div>
      ))}

      {/* Gradient overlay — darker on right where the panel sits */}
      <div className="absolute inset-0 bg-linear-to-r from-black/20 via-black/30 to-black/50" />

      {/* Bottom vignette */}
      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />

      {/* ── Big promotional text per slide ── */}
      <div className="absolute inset-0 z-10 flex items-end pointer-events-none">
        <div className="w-full pb-24 pl-8 pr-[35%] sm:pl-12 sm:pr-[40%] lg:pr-[45%]">
          {shuffled.map((imgIdx, i) => (
            <div
              key={imgIdx}
              className="absolute bottom-24 left-8 sm:left-12 right-[35%] sm:right-[40%] lg:right-[45%] transition-all duration-1000 ease-in-out"
              style={{
                opacity: i === current ? 1 : 0,
                transform: i === current ? 'translateY(0)' : 'translateY(20px)',
              }}
            >
              <p className="text-primary/80 text-sm font-semibold tracking-widest uppercase mb-3 drop-shadow-lg">
                {platformName}
              </p>
              <h2 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-xl">
                {headlines[imgIdx].top}
                <br />
                <span className="text-primary/80">{headlines[imgIdx].bottom}</span>
              </h2>
              <p className="mt-4 text-white/70 text-base sm:text-lg max-w-md leading-relaxed drop-shadow-lg">
                {headlines[imgIdx].sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators — bottom-left (visible area) */}
      <div className="absolute bottom-8 left-8 z-10 hidden sm:flex gap-2.5">
        {shuffled.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            className={`rounded-full transition-all duration-500 ${
              i === current
                ? 'h-2.5 w-8 bg-white shadow-lg'
                : 'h-2.5 w-2.5 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* Ken-Burns keyframes — zoom in then slowly return to original */}
      <style jsx>{`
        @keyframes kenburns {
          0% {
            transform: scale(1) translate(0, 0);
          }
          50% {
            transform: scale(1.08) translate(-1%, -1%);
          }
          100% {
            transform: scale(1) translate(0, 0);
          }
        }
      `}</style>
    </div>
  );
}
