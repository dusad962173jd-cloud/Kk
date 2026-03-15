import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface Props {
  isSpeaking: boolean;
  isConnected: boolean;
  isConnecting: boolean;
}

export function AnimeCharacter({ isSpeaking, isConnected, isConnecting }: Props) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Random blinking logic
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 3000 + Math.random() * 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  const eyeScaleY = isBlinking ? 0.1 : (isConnecting ? 0.8 : 1);

  // Paths with identical command structures for smooth morphing
  const mouthIdle = "M 90 135 Q 100 140 110 135 Q 100 138 90 135";
  const mouthSpeak1 = "M 88 135 Q 100 155 112 135 Q 100 130 88 135";
  const mouthSpeak2 = "M 92 135 Q 100 145 108 135 Q 100 133 92 135";
  const mouthSpeak3 = "M 85 135 Q 100 160 115 135 Q 100 128 85 135";

  return (
    <motion.div 
      animate={{ y: isConnected ? [0, -5, 0] : 0 }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="relative w-64 h-64 flex items-center justify-center mb-16"
    >
      {/* Aura */}
      {isConnected && (
        <motion.div
          animate={{
            scale: isSpeaking ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: isSpeaking ? [0.4, 0.6, 0.4] : [0.2, 0.3, 0.2]
          }}
          transition={{ duration: isSpeaking ? 0.4 : 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-orange-500 rounded-full filter blur-3xl"
        />
      )}

      {/* High Quality Anime Avatar Placeholder */}
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-orange-500/30 shadow-[0_0_30px_rgba(234,88,12,0.3)] bg-[#1a1a2e]">
        {/* We use a highly stylized CSS character to represent the anime friend */}
        <svg viewBox="0 0 200 200" className="w-full h-full z-10 drop-shadow-2xl">
          <defs>
            <linearGradient id="skin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffe4d6" />
              <stop offset="100%" stopColor="#ffcbb3" />
            </linearGradient>
            <linearGradient id="hair" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <linearGradient id="eye" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Back Hair */}
          <path d="M 30 100 C 10 200, 190 200, 170 100 C 200 30, 0 30, 30 100 Z" fill="url(#hair)" />

          {/* Neck & Shoulders */}
          <path d="M 70 140 L 70 180 L 30 200 L 170 200 L 130 180 L 130 140 Z" fill="url(#skin)" />
          <path d="M 30 200 L 70 170 L 130 170 L 170 200 Z" fill="#1e293b" />

          {/* Face */}
          <path d="M 50 90 C 50 150, 100 165, 100 165 C 100 165, 150 150, 150 90 C 150 40, 50 40, 50 90 Z" fill="url(#skin)" />

          {/* Blush */}
          <ellipse cx="70" cy="115" rx="12" ry="6" fill="#ff9999" opacity={isConnected ? "0.6" : "0.2"} filter="blur(2px)" />
          <ellipse cx="130" cy="115" rx="12" ry="6" fill="#ff9999" opacity={isConnected ? "0.6" : "0.2"} filter="blur(2px)" />

          {/* Eyes */}
          <g transform="translate(0, -5)">
            {/* Left Eye */}
            <motion.g animate={{ scaleY: eyeScaleY }} style={{ originY: "100px", originX: "70px" }} transition={{ duration: 0.1 }}>
              <ellipse cx="70" cy="100" rx="15" ry="20" fill="white" />
              <ellipse cx="72" cy="100" rx="10" ry="16" fill="url(#eye)" />
              <circle cx="76" cy="94" r="5" fill="white" />
              <circle cx="68" cy="108" r="2" fill="white" />
              <path d="M 45 85 Q 70 65 92 88" fill="none" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
              <path d="M 40 70 Q 65 55 90 70" fill="none" stroke="#312e81" strokeWidth="2" strokeLinecap="round" />
            </motion.g>

            {/* Right Eye */}
            <motion.g animate={{ scaleY: eyeScaleY }} style={{ originY: "100px", originX: "130px" }} transition={{ duration: 0.1 }}>
              <ellipse cx="130" cy="100" rx="15" ry="20" fill="white" />
              <ellipse cx="128" cy="100" rx="10" ry="16" fill="url(#eye)" />
              <circle cx="124" cy="94" r="5" fill="white" />
              <circle cx="132" cy="108" r="2" fill="white" />
              <path d="M 108 88 Q 130 65 155 85" fill="none" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
              <path d="M 110 70 Q 135 55 160 70" fill="none" stroke="#312e81" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          </g>

          {/* Nose */}
          <path d="M 100 115 L 98 122 L 102 122 Z" fill="#e8a598" />

          {/* Mouth */}
          <motion.path
            fill={isSpeaking ? "#be123c" : "transparent"}
            stroke={isSpeaking ? "#be123c" : "#c2410c"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{
              d: isSpeaking ? [mouthSpeak1, mouthSpeak2, mouthSpeak3, mouthSpeak2, mouthSpeak1] : mouthIdle
            }}
            transition={{ repeat: isSpeaking ? Infinity : 0, duration: 0.3, ease: "linear" }}
          />

          {/* Front Hair */}
          <path d="M 40 90 Q 60 30 100 65 Q 140 30 160 90 Q 150 15 100 15 Q 50 15 40 90 Z" fill="url(#hair)" />
          <path d="M 85 20 Q 100 65 115 80 Q 125 45 115 20 Z" fill="#4338ca" />
          <path d="M 60 30 Q 80 75 95 85 Q 95 45 80 25 Z" fill="#4338ca" />
          <path d="M 30 50 Q 45 90 55 100 Q 60 60 45 40 Z" fill="#4338ca" />
          <path d="M 170 50 Q 155 90 145 100 Q 140 60 155 40 Z" fill="#4338ca" />
        </svg>
      </div>
    </motion.div>
  );
}
