"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type MenuToggleProps = ButtonHTMLAttributes<HTMLButtonElement> & { open: boolean };

/** Adapted from Skiper 99 MenuIcon. CSS morph. Attribution: docs/ATTRIBUTIONS.md */
export const MenuToggle = forwardRef<HTMLButtonElement, MenuToggleProps>(
  function MenuToggle({ open, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={["icon-button navis-menu-toggle", className]
          .filter(Boolean)
          .join(" ")}
        data-open={open || undefined}
        {...props}
      >
        <span />
        <span />
        <span />
      </button>
    );
  },
);
