import { ReactNode, SVGProps } from "react";

type P = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function make(children: ReactNode, filled = false) {
  return function Icon({ size = 16, ...rest }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

export const IFolder = make(
  <path d="M3 7a2 2 0 0 1 2-2h4.2a1 1 0 0 1 .8.4L11.6 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
);
export const IBot = make(
  <>
    <rect x="4" y="9" width="16" height="10" rx="2.5" />
    <path d="M12 9V5.5" />
    <circle cx="12" cy="4.2" r="1.2" />
    <circle cx="9" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13.5" r="0.7" fill="currentColor" stroke="none" />
    <path d="M9.3 16.4h5.4" />
  </>
);
export const ITerminal = make(
  <>
    <path d="M4 16.5l5.5-4.5L4 7.5" />
    <path d="M12 17.5h8" />
  </>
);
export const IGear = make(
  <>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.9 1.9M17.1 17.1L19 19M19 5l-1.9 1.9M6.9 17.1L5 19" />
  </>
);
export const IDownload = make(
  <>
    <path d="M12 3.5v11" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </>
);
export const IX = make(<path d="M6 6l12 12M18 6L6 18" />);
export const ICheck = make(<path d="M4.5 12.5l4.8 4.8L19.5 7" />);
export const IAlert = make(
  <>
    <path d="M10.3 4.1L2.6 17.6a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4.2" />
    <circle cx="12" cy="16.8" r="0.6" fill="currentColor" stroke="none" />
  </>
);
export const IInfo = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" />
  </>
);
export const IChevronDown = make(<path d="M6 9.5l6 6 6-6" />);
export const IChevronRight = make(<path d="M9.5 6l6 6-6 6" />);
export const ICopy = make(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 14.5V6a2 2 0 0 1 2-2h8.5" />
  </>
);
export const IPlay = make(<path d="M8 5.5l11 6.5-11 6.5z" />);
export const IFile = make(
  <>
    <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3z" />
    <path d="M13.5 3v5.5H19" />
  </>
);
export const ISearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.4-4.4" />
  </>
);
export const IPulse = make(<path d="M22 12h-3.5l-3 7.5-6-15-3 7.5H2" />);
export const IClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 2" />
  </>
);
export const IArrowRight = make(
  <>
    <path d="M4.5 12h15" />
    <path d="M13.5 6l6 6-6 6" />
  </>
);
export const ILayers = make(
  <>
    <path d="M12 2.8L2.5 7.6 12 12.4l9.5-4.8L12 2.8z" />
    <path d="M2.5 12.4l9.5 4.8 9.5-4.8" />
    <path d="M2.5 17.2l9.5 4.8 9.5-4.8" />
  </>
);
export const ICpu = make(
  <>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <rect x="9.7" y="9.7" width="4.6" height="4.6" />
    <path d="M9 2.8v3M15 2.8v3M9 18.2v3M15 18.2v3M2.8 9h3M2.8 15h3M18.2 9h3M18.2 15h3" />
  </>
);
export const ITrash = make(
  <>
    <path d="M4.5 6.5h15" />
    <path d="M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5v1.5" />
    <path d="M6.5 6.5l1 12.5A1.8 1.8 0 0 0 9.3 20.6h5.4a1.8 1.8 0 0 0 1.8-1.6l1-12.5" />
  </>
);
export const IPlus = make(<path d="M12 5v14M5 12h14" />);
export const IGit = make(
  <>
    <circle cx="6.5" cy="6.5" r="2.3" />
    <circle cx="6.5" cy="17.5" r="2.3" />
    <circle cx="17.5" cy="9" r="2.3" />
    <path d="M6.5 8.8v6.4M17.5 11.3c0 3.2-4.5 3-7.6 4.4" />
  </>
);

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#101725" />
      <rect width="32" height="32" rx="8" fill="none" stroke="#1e2a3e" />
      <path
        d="M10 11 L22 11 L16 22 Z"
        fill="none"
        stroke="#576880"
        strokeWidth="1.3"
      />
      <circle cx="10" cy="11" r="3.2" fill="#ffb454" />
      <circle cx="22" cy="11" r="3.2" fill="#2fd8c3" />
      <circle cx="16" cy="22" r="3.2" fill="#56c8ff" />
    </svg>
  );
}
