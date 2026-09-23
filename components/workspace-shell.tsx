"use client";

import {
  ChartDonut,
  Compass,
  FileMagnifyingGlass,
  Gauge,
  ListChecks,
  List,
  LockKey,
  Plus,
  ShieldWarning,
  SlidersHorizontal,
  X,
  type Icon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { PublicCapabilities } from "@/lib/env-core";
import { ClusterStamp, ModeStamp } from "@/components/shared/domain-primitives";
import { WalletControl } from "@/components/wallet/wallet-control";

type WorkspaceShellProps = {
  capabilities: PublicCapabilities;
  children: React.ReactNode;
};

const navigation = [
  { label: "Agents", icon: Compass, href: "/agents", match: "/agents" },
  { label: "Decisions", icon: Gauge, href: "/decisions", match: "/decisions" },
  { label: "Markets", icon: ChartDonut, href: "/markets/launch", match: "/markets" },
  {
    label: "Transactions",
    icon: ListChecks,
    href: "/transactions",
    match: "/transactions",
  },
  { label: "Proofs", icon: FileMagnifyingGlass, href: "/proofs", match: "/proofs" },
  {
    label: "Disclosures",
    icon: ShieldWarning,
    href: "/disclosures",
    match: "/disclosures",
  },
];

type RouteContext = {
  icon: Icon;
  href: string;
  label: string;
  detail?: string;
  technical?: boolean;
};

/**
 * Where the reader is, derived from the pathname. The second line is only
 * shown when it is truthfully known from the route itself.
 */
function routeContextFor(pathname: string): RouteContext {
  if (pathname === "/agents/atlas" || pathname.startsWith("/agents/atlas/")) {
    return {
      icon: Compass,
      href: "/agents/atlas",
      label: "Atlas",
      detail: "Demo agent",
    };
  }
  if (pathname === "/agents/new") {
    return { icon: Plus, href: "/agents/new", label: "New agent", detail: "Agents" };
  }
  const agentMatch = /^\/agents\/([^/]+)/.exec(pathname);
  if (agentMatch) {
    return {
      icon: Compass,
      href: `/agents/${agentMatch[1]}`,
      label: "Agent",
      detail: agentMatch[1],
      technical: true,
    };
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return { icon: SlidersHorizontal, href: "/settings", label: "Settings" };
  }
  const section = navigation.find(
    ({ match }) => pathname === match || pathname.startsWith(`${match}/`),
  );
  if (section) {
    return { icon: section.icon, href: section.href, label: section.label };
  }
  return { icon: Compass, href: "/", label: "Navis", detail: "Overview" };
}

function BearingMark() {
  return (
    <span className="bearing-mark" aria-hidden="true">
      <span />
    </span>
  );
}

export function WorkspaceShell({ capabilities, children }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isCurrent = (match: string) =>
    pathname === match || pathname.startsWith(`${match}/`);
  const context = routeContextFor(pathname);
  const ContextIcon = context.icon;

  useEffect(() => {
    if (!mobileNavOpen) return;

    const drawer = drawerRef.current;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavOpen(false);
        return;
      }

      if (event.key !== "Tab" || !drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileNavOpen]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      <aside
        className="side-rail"
        aria-label="Primary navigation"
        inert={mobileNavOpen ? true : undefined}
      >
        <Link className="brand-lockup" href="/agents/atlas" aria-label="Navis home">
          <BearingMark />
          <span>NAVIS</span>
        </Link>

        <nav className="rail-navigation">
          {navigation.map(({ label, icon: Icon, href, match }) => {
            const current = isCurrent(match);
            return (
              <Link
                className="rail-link"
                data-current={current || undefined}
                data-label={label}
                href={href}
                key={label}
                aria-current={current ? "page" : undefined}
              >
                <Icon aria-hidden="true" size={20} weight="regular" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rail-footer">
          <Link
            className="rail-link"
            data-current={isCurrent("/settings") || undefined}
            data-label="Settings"
            href="/settings"
            aria-current={isCurrent("/settings") ? "page" : undefined}
          >
            <SlidersHorizontal aria-hidden="true" size={20} />
            <span>Settings</span>
          </Link>
          <div className="system-state">
            <LockKey aria-hidden="true" size={16} />
            <span>
              <span className="system-state-mode">{capabilities.mode}</span> safeguards
              active
            </span>
          </div>
        </div>
      </aside>

      <header className="mobile-header" inert={mobileNavOpen ? true : undefined}>
        <Link className="brand-lockup" href="/agents/atlas" aria-label="Navis home">
          <BearingMark />
          <span>NAVIS</span>
        </Link>
        <button
          ref={menuButtonRef}
          className="icon-button"
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
        >
          <List aria-hidden="true" size={22} />
        </button>
      </header>

      {mobileNavOpen ? (
        <div
          ref={drawerRef}
          id="mobile-navigation"
          className="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
        >
          <div className="mobile-drawer-header">
            <div className="brand-lockup">
              <BearingMark />
              <span id="mobile-navigation-title">NAVIS</span>
            </div>
            <button
              ref={closeButtonRef}
              className="icon-button"
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <X size={22} />
            </button>
          </div>
          <nav className="mobile-navigation">
            {navigation.map(({ label, icon: Icon, href, match }) => {
              const current = isCurrent(match);
              return (
                <Link
                  className="rail-link"
                  data-current={current || undefined}
                  href={href}
                  key={label}
                  onClick={() => setMobileNavOpen(false)}
                  aria-current={current ? "page" : undefined}
                >
                  <Icon aria-hidden="true" size={20} />
                  <span>{label}</span>
                </Link>
              );
            })}
            <Link
              className="rail-link"
              data-current={isCurrent("/settings") || undefined}
              href="/settings"
              onClick={() => setMobileNavOpen(false)}
              aria-current={isCurrent("/settings") ? "page" : undefined}
            >
              <SlidersHorizontal aria-hidden="true" size={20} />
              <span>Settings</span>
            </Link>
          </nav>
          <div className="system-state">
            <LockKey aria-hidden="true" size={16} />
            <span>
              <span className="system-state-mode">{capabilities.mode}</span> safeguards
              active
            </span>
          </div>
        </div>
      ) : null}

      <div className="workspace-column" inert={mobileNavOpen ? true : undefined}>
        <header className="workspace-bar">
          <Link
            className="route-context"
            href={context.href}
            aria-label={
              context.detail ? `${context.label}, ${context.detail}` : context.label
            }
          >
            <span className="route-context-icon" aria-hidden="true">
              <ContextIcon size={16} />
            </span>
            <span className="route-context-copy">
              <strong>{context.label}</strong>
              {context.detail ? (
                <small data-technical={context.technical || undefined}>
                  {context.detail}
                </small>
              ) : null}
            </span>
          </Link>

          <div className="workspace-actions">
            <span className="network-truth">
              <ModeStamp mode={capabilities.mode} />
              <ClusterStamp cluster={capabilities.cluster} />
            </span>
            <WalletControl
              authenticationConfigured={
                capabilities.walletAuthenticationConfigured &&
                capabilities.persistenceConfigured
              }
            />
          </div>
        </header>

        <main className="workspace" id="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
