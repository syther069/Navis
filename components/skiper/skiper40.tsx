import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type LinkProps = {
  children: ReactNode;
  href: string;
  className?: string;
};

/**
 * Skiper 40 CssLink variants, adapted to Next Link and Navis tokens.
 * Attribution: docs/ATTRIBUTIONS.md
 */
export function Link000({ children, href, className }: LinkProps) {
  return (
    <Link
      href={href}
      className={cn("navis-skiper-link navis-skiper-link-000", className)}
    >
      {children}
    </Link>
  );
}

export function Link001({ children, href, className }: LinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("navis-skiper-link navis-skiper-link-001", className)}
    >
      {children}
      <ExternalMark />
    </a>
  );
}

export function Link002({ children, href, className }: LinkProps) {
  return (
    <Link
      href={href}
      className={cn("navis-skiper-link navis-skiper-link-002", className)}
    >
      {children}
      <ExternalMark />
    </Link>
  );
}

export function Link003({ children, href, className }: LinkProps) {
  return (
    <Link
      href={href}
      className={cn("navis-skiper-link navis-skiper-link-003", className)}
    >
      {children}
      <ExternalMark />
    </Link>
  );
}

function ExternalMark() {
  return (
    <svg
      className="navis-skiper-link-mark"
      fill="none"
      viewBox="0 0 10 10"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
