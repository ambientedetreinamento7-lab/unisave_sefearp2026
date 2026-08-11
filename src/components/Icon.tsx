export type IconName =
  | "book"
  | "graduation-cap"
  | "target"
  | "trophy"
  | "clock"
  | "cpu"
  | "users"
  | "map-pin"
  | "arrow-right"
  | "sparkles"
  | "party"
  | "sun"
  | "moon"
  | "chevron-down"
  | "log-out"
  | "shield"
  | "maximize"
  | "minimize"
  | "heart"
  | "heart-filled"
  | "message-circle"
  | "flag"
  | "more-horizontal"
  | "trash"
  | "eye-off"
  | "image"
  | "x"
  | "video"
  | "alert-triangle"
  | "help-circle"
  | "bell"

const PATHS: Record<IconName, React.ReactNode> = {
  book: (
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v14H6.5A2.5 2.5 0 0 0 4 19.5v-14ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v14h5.5a2.5 2.5 0 0 1 2.5 2.5v-14Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  "graduation-cap": (
    <path
      d="M2 8.5 12 4l10 4.5L12 13 2 8.5Zm4 2.4V16c0 1.5 2.6 3 6 3s6-1.5 6-3v-5.1M20 9.5V15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  trophy: (
    <path
      d="M7 4h10v4a5 5 0 0 1-10 0V4Zm10 1h2.5a2.5 2.5 0 0 1-2.5 2.5M7 5H4.5A2.5 2.5 0 0 0 7 7.5M12 13v3m-3 4h6m-6 0a3 3 0 0 1 0-4h6a3 3 0 0 1 0 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  users: (
    <path
      d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2.5 19c.5-3.2 3-5 6-5s5.5 1.8 6 5M14.5 14.5c2.5.1 4.5 1.7 5 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "map-pin": (
    <path
      d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  "arrow-right": (
    <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  sparkles: (
    <path
      d="m12 3 1.4 4.1L17.5 8.6 13.4 10l-1.4 4.1L10.6 10l-4.1-1.4L10.6 7.1 12 3Zm6.5 9 .8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z"
      fill="currentColor"
    />
  ),
  party: (
    <path
      d="M4 20 14 10M9 6.5 12.5 3l1 3.5L18 8l-3.5 1 1 3.5-3.5-1M18 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  moon: (
    <path
      d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  "chevron-down": (
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "log-out": (
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  shield: (
    <path
      d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6l7-2.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  maximize: (
    <path
      d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  minimize: (
    <path
      d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  heart: (
    <path
      d="M12 20.5s-7.5-4.6-9.8-9.3C.6 7.7 2.4 4 6 4c2 0 3.5 1.1 4.5 2.5C11.5 5.1 13 4 15 4c3.6 0 5.4 3.7 3.8 7.2C19.5 15.9 12 20.5 12 20.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  "heart-filled": (
    <path
      d="M12 20.5s-7.5-4.6-9.8-9.3C.6 7.7 2.4 4 6 4c2 0 3.5 1.1 4.5 2.5C11.5 5.1 13 4 15 4c3.6 0 5.4 3.7 3.8 7.2C19.5 15.9 12 20.5 12 20.5Z"
      fill="currentColor"
    />
  ),
  "message-circle": (
    <path
      d="M21 12a8.5 8.5 0 0 1-12.3 7.6L4 21l1.4-4.7A8.5 8.5 0 1 1 21 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  flag: (
    <path
      d="M5 21V4m0 1 3-1c2 .8 3.3.8 5 0l3-1c2 .8 3.3.8 5 0v9c-1.7.8-3 .8-5 0l-3-1c-1.7-.8-3-.8-5 0Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  "more-horizontal": (
    <path
      d="M5 12h.01M12 12h.01M19 12h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  ),
  trash: (
    <path
      d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m2 0-.6 12.4A2 2 0 0 1 14.4 21H9.6a2 2 0 0 1-2-1.6L7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "eye-off": (
    <path
      d="M3 3l18 18M10.6 5.2A9.4 9.4 0 0 1 12 5c5 0 9 4.5 10 7-.4.9-1 1.9-1.9 2.9M6.6 6.6C4.3 8.1 2.7 10.2 2 12c1 2.5 5 7 10 7 1.4 0 2.7-.3 3.9-.9M9.5 9.8a3 3 0 0 0 4.2 4.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
      <path d="M4 17l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  x: (
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  ),
  video: (
    <>
      <rect x="2.5" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </>
  ),
  "alert-triangle": (
    <path
      d="M12 4 2.5 20h19L12 4Zm0 6.5v4M12 17h.01"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  "help-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.2.9-1.2 1.8V14M12 17h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  bell: (
    <path
      d="M12 3.5a5 5 0 0 0-5 5v2.6c0 .7-.2 1.4-.6 2L5 15.5h14l-1.4-2.4a3.9 3.9 0 0 1-.6-2V8.5a5 5 0 0 0-5-5ZM10 18.5a2 2 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {PATHS[name]}
    </svg>
  )
}
