import type { ReactNode, SVGProps } from "react";

import { cx } from "./cx";

export type IconName =
  | "alert-circle"
  | "alert-triangle"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "calendar"
  | "car"
  | "check"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "clock"
  | "cloud"
  | "compass"
  | "copy"
  | "device"
  | "download"
  | "edit"
  | "ferry"
  | "file"
  | "home"
  | "info"
  | "map"
  | "menu"
  | "minus"
  | "moon"
  | "more"
  | "pin"
  | "plus"
  | "print"
  | "refresh"
  | "route"
  | "search"
  | "settings"
  | "sun"
  | "tent"
  | "trash"
  | "undo"
  | "upload"
  | "users"
  | "wallet"
  | "wifi-off"
  | "x";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  label?: string;
  size?: number | string;
}

const icons: Record<IconName, ReactNode> = {
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.7v5.1" />
      <path d="M12 16.4h.01" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="M10.3 3.4 2.6 17a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 3.4a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8.5v4.3" />
      <path d="M12 16.5h.01" />
    </>
  ),
  "arrow-down": <path d="M12 4v16m0 0 6-6m-6 6-6-6" />,
  "arrow-left": <path d="m19 12-14 0m0 0 6-6m-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  "arrow-up": <path d="M12 20V4m0 0-6 6m6-6 6 6" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  car: (
    <>
      <path d="m5 11 1.5-4h11l1.5 4" />
      <path d="M4 11h16a1 1 0 0 1 1 1v5H3v-5a1 1 0 0 1 1-1Z" />
      <path d="M5 17v2M19 17v2M6.5 14h.01M17.5 14h.01" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-up": <path d="m18 15-6-6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  cloud: <path d="M7.5 18H18a4 4 0 0 0 .3-8A6.2 6.2 0 0 0 6.5 8.7 4.7 4.7 0 0 0 7.5 18Z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  device: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10 5h4M11.4 18.5h1.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
      <path d="M5 20h14" />
    </>
  ),
  edit: (
    <>
      <path d="m14.5 5.5 4 4" />
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    </>
  ),
  ferry: (
    <>
      <path d="M5 10h14l-1.2 7H6.2L5 10Z" />
      <path d="M8 10V6h8v4M10 6V3h4v3" />
      <path d="M3 20c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" />
    </>
  ),
  file: (
    <>
      <path d="M6 2.5h8l4 4V21H6V2.5Z" />
      <path d="M14 2.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  minus: <path d="M5 12h14" />,
  moon: <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7zM17 12h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M18.5 16A8 8 0 1 1 20 12" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h-1" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  tent: (
    <>
      <path d="m3 20 9-16 9 16H3Z" />
      <path d="m12 4 3 16M9 20l3-6 3 6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 14h9l1-14M10 11v6M14 11v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 8 4 12l5 4" />
      <path d="M5 12h8a6 6 0 0 1 6 6v1" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0-5 5m5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17 14a5.5 5.5 0 0 1 3.5 5.1V20" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 6.5h14a2 2 0 0 1 2 2V19H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12" />
      <path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="m3 3 18 18" />
      <path d="M8.5 8.8A11.8 11.8 0 0 1 21 10M3 10a14 14 0 0 1 2.7-1.5M6 14a9 9 0 0 1 6-2.2M10 18a3 3 0 0 1 4 0" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

export function Icon({ name, label, size = "1em", className, ...props }: IconProps) {
  const labelled = Boolean(label ?? props["aria-label"]);

  return (
    <svg
      {...props}
      aria-hidden={labelled ? undefined : true}
      aria-label={label ?? props["aria-label"]}
      className={cx("ca-icon", className)}
      fill="none"
      focusable="false"
      height={size}
      role={labelled ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
      width={size}
    >
      {icons[name]}
    </svg>
  );
}
