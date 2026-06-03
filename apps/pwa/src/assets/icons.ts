// All inline SVG strings — zero network requests
// Style: clean outlined minimalist

export const ICONS = {
  logo: `<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 8 C20 8 8 24 8 40 C8 56 20 72 40 72 C60 72 72 56 72 40 C72 24 60 8 40 8Z"/>
    <path d="M20 40 Q30 20 40 28 Q50 20 60 40"/>
    <path d="M28 52 Q40 64 52 52"/>
    <circle cx="40" cy="40" r="3"/>
  </svg>`,

  archDome: `<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
    <path d="M10 58 Q10 10 60 10 Q110 10 110 58"/>
    <path d="M25 58 Q25 25 60 25 Q95 25 95 58"/>
  </svg>`,

  coffee: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22h32v24c0 6-6 10-16 10s-16-4-16-10V22z"/>
    <path d="M44 28h6c4 0 6 3 6 6s-2 6-6 6h-6"/>
    <path d="M20 14c0-4 4-4 4 0"/>
    <path d="M28 12c0-6 4-6 4 0"/>
    <path d="M36 14c0-4 4-4 4 0"/>
  </svg>`,

  food: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="32" cy="40" rx="26" ry="12"/>
    <path d="M6 40c0-16 12-26 26-26s26 10 26 26"/>
    <path d="M20 34c2-4 6-6 12-6s10 2 12 6"/>
    <line x1="32" y1="8" x2="32" y2="14"/>
    <path d="M28 10c2-4 6-4 8 0"/>
  </svg>`,

  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,

  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,

  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>`,

  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
  </svg>`,

  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,

  // Mini versions for drawer toggle (same SVGs, used at smaller scale)
  coffeeMini: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 8h12v10c0 2-3 4-6 4s-6-2-6-4V8z"/>
    <path d="M16 10h2c2 0 3 1 3 2s-1 2-3 2h-2"/>
    <path d="M7 5c0-2 2-2 2 0"/>
    <path d="M10 4c0-2 2-2 2 0"/>
    <path d="M13 5c0-2 2-2 2 0"/>
  </svg>`,

  foodMini: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="12" cy="16" rx="9" ry="4"/>
    <path d="M3 16c0-6 4-10 9-10s9 4 9 10"/>
    <line x1="12" y1="3" x2="12" y2="6"/>
  </svg>`,

  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>`,
} as const;
