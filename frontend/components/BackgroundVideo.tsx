'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Locally hosted, freely licensed Japanese footage. Full attribution and
// license terms live in frontend/public/videos/ATTRIBUTION.md. Every entry
// ships both MP4 (H.264, broad support) and WebM fallbacks plus a poster.
const VIDEO_SOURCES = [
  {
    label: 'Togetsukyo Bridge, Kyoto in spring',
    mp4: '/videos/cherry-blossom.mp4',
    webm: '/videos/cherry-blossom.webm',
    poster: '/videos/posters/cherry-blossom.jpg',
  },
  {
    label: 'Diamond Fuji over Mihama-Ohashi Bridge',
    mp4: '/videos/mt-fuji.mp4',
    webm: '/videos/mt-fuji.webm',
    poster: '/videos/posters/mt-fuji.jpg',
  },
  {
    label: 'Tokyo street performance',
    mp4: '/videos/japanese-street.mp4',
    webm: '/videos/japanese-street.webm',
    poster: '/videos/posters/japanese-street.jpg',
  },
  {
    label: 'Rain chain at a Japanese temple',
    mp4: '/videos/temple-rain-chain.mp4',
    webm: '/videos/temple-rain-chain.webm',
    poster: '/videos/posters/temple-rain-chain.jpg',
  },
];

export function BackgroundVideo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const current = VIDEO_SOURCES[currentIndex];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Advancing the playlist also reloads the element so the new <source>
    // list takes effect without remounting the component.
    video.load();
    const play = video.play();
    if (play) play.catch(() => undefined);
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[-10] overflow-hidden bg-washi">
      <video
        ref={videoRef}
        key={current.mp4}
        autoPlay
        muted
        loop={VIDEO_SOURCES.length === 1}
        playsInline
        preload="metadata"
        poster={current.poster}
        aria-label={`Ambient background footage: ${current.label}`}
        className="w-full h-full object-cover opacity-40"
        onEnded={() => setCurrentIndex((prev) => (prev + 1) % VIDEO_SOURCES.length)}
      >
        <source src={current.mp4} type="video/mp4" />
        <source src={current.webm} type="video/webm" />
      </video>
      {/* Gradient overlay to soften video */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-washi/10 to-washi/40 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,_rgba(230,57,70,0.03)_0%_,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_20%_80%,_rgba(46,64,87,0.03)_0%_,transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-20" />
    </div>
  );
}

type Petal = {
  left: number;
  delay: number;
  duration: number;
  size: number;
};

export function SakuraOverlay({ count = 24 }: { count?: number }) {
  // Petals are rendered declaratively so React owns their lifecycle; the
  // CSS `sakura-fall` keyframes drive the animation with zero JS per frame.
  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 97.3 + 11) % 100,
        delay: (i * 1.37) % 10,
        duration: 8 + ((i * 2.11) % 12),
        size: 6 + ((i * 1.73) % 6),
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {petals.map((petal, i) => (
        <span
          key={i}
          className="sakura-petal"
          style={{
            left: `${petal.left}vw`,
            width: petal.size,
            height: petal.size,
            animationDelay: `${petal.delay}s`,
            animationDuration: `${petal.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function JapaneseWave() {
  return (
    <div className="fixed inset-0 z-[-5] pointer-events-none opacity-30">
      <svg width="100%" height="200" preserveAspectRatio="none" className="animate-wave-pulse">
        <defs>
          <pattern id="wave" width="100" height="100" patternUnits="userSpaceOnUse">
            <path
              d="M0 50 Q 25 0 50 50 T 100 50 V100 H0 Z"
              fill="var(--color-aijiro)"
              fillOpacity={0.06}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wave)" />
      </svg>
    </div>
  );
}
