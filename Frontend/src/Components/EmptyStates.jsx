import React from 'react';
import { motion } from 'framer-motion';

/**
 * Empty-state SVG illustrations — pure CSS + inline SVG + Framer Motion
 * Used for: no search results, empty menu, restaurant closed
 */

// ─── No Search Results ─────────────────────────────────────────
export const NoSearchResultsIllustration = ({ themeColor = '#f97316', size = 160 }) => (
  <motion.svg
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background circle */}
    <circle cx="100" cy="100" r="90" fill={`${themeColor}08`} />
    <circle cx="100" cy="100" r="70" fill={`${themeColor}06`} />

    {/* Plate */}
    <motion.ellipse
      cx="100" cy="130" rx="55" ry="12"
      fill="#e5e7eb"
      initial={{ scaleX: 0.7 }}
      animate={{ scaleX: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    />
    <motion.ellipse
      cx="100" cy="125" rx="50" ry="32"
      fill="#f3f4f6"
      stroke="#d1d5db"
      strokeWidth="2"
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
    />
    <ellipse cx="100" cy="120" rx="35" ry="20" fill="white" />

    {/* Question mark on plate */}
    <motion.text
      x="100" y="128"
      textAnchor="middle"
      fontSize="28"
      fontWeight="bold"
      fill={`${themeColor}60`}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4, type: 'spring' }}
    >
      ?
    </motion.text>

    {/* Magnifying glass */}
    <motion.g
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <circle cx="140" cy="65" r="22" fill="white" stroke={themeColor} strokeWidth="3" />
      <circle cx="140" cy="65" r="15" fill={`${themeColor}10`} />
      <line x1="156" y1="81" x2="170" y2="95" stroke={themeColor} strokeWidth="4" strokeLinecap="round" />
    </motion.g>

    {/* Small X marks (not found) */}
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.4 }}
      transition={{ delay: 0.6 }}
    >
      <line x1="133" y1="58" x2="147" y2="72" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="147" y1="58" x2="133" y2="72" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" />
    </motion.g>
  </motion.svg>
);


// ─── Empty Menu ────────────────────────────────────────────────
export const EmptyMenuIllustration = ({ themeColor = '#f97316', size = 160 }) => (
  <motion.svg
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Background */}
    <circle cx="100" cy="100" r="90" fill={`${themeColor}08`} />

    {/* Menu/clipboard */}
    <motion.rect
      x="55" y="30" width="90" height="130" rx="10"
      fill="white"
      stroke="#d1d5db"
      strokeWidth="2"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 30, opacity: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
    />

    {/* Clipboard top */}
    <rect x="80" y="24" width="40" height="14" rx="4" fill={themeColor} />
    <circle cx="100" cy="31" r="4" fill="white" />

    {/* Empty lines (dashed) */}
    {[0, 1, 2, 3].map((i) => (
      <motion.rect
        key={i}
        x="72" y={60 + i * 22} width={50 - i * 6} height="6" rx="3"
        fill="#e5e7eb"
        initial={{ width: 0 }}
        animate={{ width: 50 - i * 6 }}
        transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
      />
    ))}

    {/* Sad face on clipboard */}
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
    >
      <circle cx="90" cy="138" r="2" fill="#9ca3af" />
      <circle cx="110" cy="138" r="2" fill="#9ca3af" />
      <path d="M88 148 C93 144, 107 144, 112 148" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" fill="none" />
    </motion.g>

    {/* Small sparkles */}
    <motion.circle
      cx="45" cy="55" r="3" fill={`${themeColor}40`}
      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    <motion.circle
      cx="155" cy="75" r="2.5" fill={`${themeColor}30`}
      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
    />
  </motion.svg>
);


// ─── Restaurant Closed ─────────────────────────────────────────
export const RestaurantClosedIllustration = ({ themeColor = '#f97316', size = 180 }) => (
  <motion.svg
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Night sky circle */}
    <circle cx="100" cy="100" r="90" fill="#1e293b" opacity="0.05" />

    {/* Storefront */}
    <motion.g
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 180 }}
    >
      {/* Building */}
      <rect x="45" y="65" width="110" height="85" rx="6" fill="white" stroke="#d1d5db" strokeWidth="2" />
      
      {/* Awning */}
      <path
        d="M40 68 Q55 55, 70 68 Q85 55, 100 68 Q115 55, 130 68 Q145 55, 160 68"
        stroke={themeColor}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="40" y="58" width="120" height="12" rx="3" fill={themeColor} opacity="0.85" />

      {/* Door */}
      <rect x="85" y="100" width="30" height="48" rx="4" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5" />
      <circle cx="109" cy="125" r="2.5" fill="#9ca3af" />

      {/* Windows (dark / lights off) */}
      <rect x="55" y="78" width="22" height="18" rx="3" fill="#1e293b" opacity="0.15" />
      <rect x="123" y="78" width="22" height="18" rx="3" fill="#1e293b" opacity="0.15" />
    </motion.g>

    {/* "CLOSED" sign hanging */}
    <motion.g
      initial={{ rotate: -15, opacity: 0 }}
      animate={{ rotate: 0, opacity: 1 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 150, damping: 12 }}
      style={{ transformOrigin: '100px 100px' }}
    >
      {/* Chain */}
      <line x1="100" y1="100" x2="100" y2="108" stroke="#9ca3af" strokeWidth="1.5" />
      {/* Sign */}
      <rect x="72" y="108" width="56" height="24" rx="4" fill={themeColor} />
      <text x="100" y="124" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">
        CERRADO
      </text>
    </motion.g>

    {/* Moon */}
    <motion.g
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      <circle cx="155" cy="38" r="14" fill="#fbbf24" opacity="0.2" />
      <circle cx="155" cy="38" r="10" fill="#fbbf24" opacity="0.35" />
      <path d="M150 28 C148 38, 155 48, 165 46 C158 50, 146 44, 146 34 C146 28, 150 25, 150 28Z" fill="#fbbf24" opacity="0.5" />
    </motion.g>

    {/* Stars */}
    <motion.circle
      cx="50" cy="35" r="2" fill="#fbbf24" opacity="0.4"
      animate={{ opacity: [0.2, 0.6, 0.2] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
    <motion.circle
      cx="130" cy="25" r="1.5" fill="#fbbf24" opacity="0.3"
      animate={{ opacity: [0.15, 0.5, 0.15] }}
      transition={{ duration: 2.5, repeat: Infinity, delay: 0.7 }}
    />
    <motion.circle
      cx="170" cy="55" r="1.5" fill="#fbbf24" opacity="0.25"
      animate={{ opacity: [0.1, 0.45, 0.1] }}
      transition={{ duration: 2.8, repeat: Infinity, delay: 1.2 }}
    />

    {/* Zzz */}
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ delay: 0.8 }}
    >
      <motion.text
        x="160" y="78" fontSize="12" fontWeight="bold" fill={themeColor}
        animate={{ y: [78, 73, 78], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        z
      </motion.text>
      <motion.text
        x="168" y="68" fontSize="10" fontWeight="bold" fill={themeColor}
        animate={{ y: [68, 62, 68], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
      >
        z
      </motion.text>
    </motion.g>
  </motion.svg>
);


// ─── Empty Cart illustration (bonus) ───────────────────────────
export const EmptyCartIllustration = ({ themeColor = '#f97316', size = 140 }) => (
  <motion.svg
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    width={size}
    height={size}
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="100" cy="100" r="90" fill={`${themeColor}08`} />

    {/* Cart body */}
    <motion.g
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
    >
      <path
        d="M50 60 L65 60 L80 120 L140 120 L155 75 L75 75"
        stroke="#d1d5db"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wheels */}
      <circle cx="90" cy="135" r="7" fill="white" stroke="#d1d5db" strokeWidth="2.5" />
      <circle cx="130" cy="135" r="7" fill="white" stroke="#d1d5db" strokeWidth="2.5" />
      <circle cx="90" cy="135" r="2" fill="#d1d5db" />
      <circle cx="130" cy="135" r="2" fill="#d1d5db" />
    </motion.g>

    {/* Dotted empty space inside */}
    <motion.rect
      x="82" y="82" width="52" height="30" rx="6"
      fill="none"
      stroke={`${themeColor}30`}
      strokeWidth="2"
      strokeDasharray="4 4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    />

    {/* Arrow pointing into cart */}
    <motion.g
      animate={{ y: [0, 5, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <line x1="108" y1="50" x2="108" y2="78" stroke={themeColor} strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="100,70 108,80 116,70" stroke={themeColor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </motion.g>
  </motion.svg>
);

export default {
  NoSearchResultsIllustration,
  EmptyMenuIllustration,
  RestaurantClosedIllustration,
  EmptyCartIllustration,
};
