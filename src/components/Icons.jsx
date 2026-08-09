import React from 'react';

// 极简黑白线性图标（无填充、无渐变，颜色跟随 currentColor）
const paths = {
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20V11M12 20V4M19 20V14" />
      <path d="M3 20h18" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a2 2 0 0 0 2 3h1M16 6h3a2 2 0 0 1-2 3h-1" />
      <path d="M12 13v4M8.5 20h7M10.5 17v3M13.5 17v3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 2.5V11c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V5.5L12 3Z" />
      <path d="M9.5 11.5l1.8 1.8 3.2-3.6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.5" cy="9" r="2.3" />
      <path d="M15.2 14.6a4.3 4.3 0 0 1 5.3 0" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5L12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 1 3.6 10.8c-.7.55-1.1 1.05-1.1 2.2h-5c0-1.15-.4-1.65-1.1-2.2A6 6 0 0 1 12 3Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v3h-3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  )
};

export default function Icon({ name, className = 'w-5 h-5', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
