import React from "react";

export function Icon({ name, size = 18, className = "", ...props }) {
  const s = { width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 };
  const base = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: s,
    className: `svg-icon ${className}`,
    "aria-hidden": "true",
    ...props,
  };

  switch (name) {
    case "truck":
      return (
        <svg {...base}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.24-4.05a1 1 0 0 0-.78-.38H14v9.7" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      );
    case "shield-check":
      return (
        <svg {...base}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "shield-alert":
      return (
        <svg {...base}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case "wind":
      return (
        <svg {...base}>
          <path d="M17.7 7.7A2.5 2.5 0 1 1 19 12H2" />
          <path d="M14.6 3.6A2 2 0 1 1 16 7H2" />
          <path d="M15.4 16.4A2.5 2.5 0 1 0 17 21H2" />
        </svg>
      );
    case "rain":
      return (
        <svg {...base}>
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="m8 19-1 3" />
          <path d="m12 19-1 3" />
          <path d="m16 19-1 3" />
        </svg>
      );
    case "snow":
      return (
        <svg {...base}>
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <line x1="8" y1="19" x2="8" y2="19.01" />
          <line x1="8" y1="22" x2="8" y2="22.01" />
          <line x1="12" y1="18" x2="12" y2="18.01" />
          <line x1="12" y1="21" x2="12" y2="21.01" />
          <line x1="16" y1="19" x2="16" y2="19.01" />
          <line x1="16" y1="22" x2="16" y2="22.01" />
        </svg>
      );
    case "thermometer":
      return (
        <svg {...base}>
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
      );
    case "map-pin":
      return (
        <svg {...base}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "swap":
      return (
        <svg {...base}>
          <path d="m7 16-4-4 4-4" />
          <path d="m17 8 4 4-4 4" />
          <path d="M3 12h18" />
        </svg>
      );
    case "clock":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "scale":
      return (
        <svg {...base}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...base}>
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...base}>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        </svg>
      );
    case "play":
      return (
        <svg {...base}>
          <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
        </svg>
      );
    case "pause":
      return (
        <svg {...base}>
          <rect x="6" y="4" width="4" height="16" fill="currentColor" />
          <rect x="14" y="4" width="4" height="16" fill="currentColor" />
        </svg>
      );
    case "check":
      return (
        <svg {...base}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg {...base}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case "x":
      return (
        <svg {...base}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "layers":
      return (
        <svg {...base}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "maximize":
      return (
        <svg {...base}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...base}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "chevron-up":
      return (
        <svg {...base}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...base}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...base}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case "sun":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case "moon":
      return (
        <svg {...base}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "search":
      return (
        <svg {...base}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "navigation":
      return (
        <svg {...base}>
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case "compass":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...base}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    default:
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
