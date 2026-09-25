import Link from "next/link";
import type { ComponentProps } from "react";

import { TextRoll } from "@/components/motion/text-roll";

type CssLinkProps = ComponentProps<typeof Link> & {
  roll?: boolean;
};

/**
 * Navis original underline link. Same job as Skiper 40 CssLink, not that component.
 * Free Skiper 40 was not in the provided files.
 */
export function CssLink({ roll = false, className, children, ...props }: CssLinkProps) {
  return (
    <Link
      className={["navis-css-link", className].filter(Boolean).join(" ")}
      {...props}
    >
      {roll && typeof children === "string" ? (
        <TextRoll>{children}</TextRoll>
      ) : (
        children
      )}
    </Link>
  );
}
