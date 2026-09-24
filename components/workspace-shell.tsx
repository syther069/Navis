"use client";

import {
  CaretRight,
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
import { InfoHint } from "@/components/shared/info-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";
import { WalletControl } from "@/components/wallet/wallet-control";

type WorkspaceShellProps = {
  capabilities: PublicCapabilities;
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  icon: Icon;
  href: string;
  match: string;
  helpTopic?: InfoHintKey;
};

const navigation: readonly NavItem[] = [
  { label: "Agents", icon: Compass, href: "/agents", match: "/agents" },
  {
    label: "Decisions",
    icon: Gauge,
    href: "/decisions",
    match: "/decisions",
    helpTopic: "navDecisions",
  },
  {
    label: "Markets",
    icon: ChartDonut,
    href: "/markets/launch",
    match: "/markets",
    helpTopic: "navMarkets",
  },
  {
    label: "Transactions",
    icon: ListChecks,
    href: "/transactions",
    match: "/transactions",
  },
  {
    label: "Proofs",
    icon: FileMagnifyingGlass,
    href: "/proofs",
    match: "/proofs",
    helpTopic: "navProofs",
  },
  {
    label: "Disclosures",
    icon: ShieldWarning,
    href: "/disclosures",
    match: "/disclosures",
  },
];

type BreadcrumbSegment = {
  label: string;
  href?: string;
  technical?: boolean;
};

type RouteContext = {
  icon: Icon;
  href: string;
  label: string;
  breadcrumbs: BreadcrumbSegment[];
  detail?: string;
  technical?: boolean;
};

/**
 * Where the reader is, derived from the pathname. The second line and breadcrumb
 * hierarchy are only shown when they are truthfully known from the route itself.
 */
function routeContextFor(pathname: string): RouteContext {
  if (pathname.startsWith("/agents/atlas/decisions/")) {
    const match = /^\/agents\/atlas\/decisions\/([^/]+)/.exec(pathname);
    const id = match ? match[1].slice(0, 8) : "detail";
    return {
      icon: Gauge,
      href: pathname,
      label: "Decision",
      breadcrumbs: [
        { label: "Agents", href: "/agents" },
        { label: "Atlas", href: "/agents/atlas" },
        { label: `Decision ${id}`, technical: true },
      ],
      detail: "Demo run",
    };
  }

  if (pathname === "/agents/atlas") {
    return {
      icon: Compass,
      href: "/agents/atlas",
      label: "Atlas",
      breadcrumbs: [
        { label: "Agents", href: "/agents" },
        { label: "Atlas", href: "/agents/atlas" },
      ],
      detail: "Demo agent",
    };
  }

  if (pathname === "/agents/new") {
    return {
      icon: Plus,
      href: "/agents/new",
      label: "New agent",
      breadcrumbs: [
        { label: "Agents", href: "/agents" },
        { label: "New agent", href: "/agents/new" },
      ],
      detail: "Mandate draft",
    };
  }

  const agentMatch = /^\/agents\/([^/]+)/.exec(pathname);
  if (agentMatch) {
    const slug = agentMatch[1];
    return {
      icon: Compass,
      href: `/agents/${slug}`,
      label: "Agent",
      breadcrumbs: [
        { label: "Agents", href: "/agents" },
        { label: slug, href: `/agents/${slug}`, technical: true },
      ],
      detail: slug,
      technical: true,
    };
  }

  if (pathname === "/agents") {
    return {
      icon: Compass,
      href: "/agents",
      label: "Agents",
      breadcrumbs: [{ label: "Agents", href: "/agents" }],
      detail: "Registry",
    };
  }

  if (pathname.startsWith("/decisions/")) {
    const decMatch = /^\/decisions\/([^/]+)/.exec(pathname);
    const id = decMatch ? decMatch[1].slice(0, 8) : "detail";
    return {
      icon: Gauge,
      href: pathname,
      label: "Decision",
      breadcrumbs: [
        { label: "Decisions", href: "/decisions" },
        { label: `Decision ${id}`, technical: true },
      ],
      detail: "Policy evaluation",
    };
  }

  if (pathname === "/decisions") {
    return {
      icon: Gauge,
      href: "/decisions",
      label: "Decisions",
      breadcrumbs: [{ label: "Decisions", href: "/decisions" }],
      detail: "Ledger",
    };
  }

  if (pathname === "/markets/launch" || pathname.startsWith("/markets")) {
    return {
      icon: ChartDonut,
      href: "/markets/launch",
      label: "Markets",
      breadcrumbs: [{ label: "Markets", href: "/markets/launch" }, { label: "Launch" }],
      detail: "ClawPump & Meteora DBC",
    };
  }

  if (pathname === "/transactions" || pathname.startsWith("/transactions/")) {
    return {
      icon: ListChecks,
      href: "/transactions",
      label: "Transactions",
      breadcrumbs: [{ label: "Transactions", href: "/transactions" }],
      detail: "Settlement ledger",
    };
  }

  if (pathname.startsWith("/proofs/")) {
    const proofMatch = /^\/proofs\/([^/]+)/.exec(pathname);
    const proofId = proofMatch ? proofMatch[1] : "receipt";
    const isDemo = proofId === "demo-proof";
    return {
      icon: FileMagnifyingGlass,
      href: pathname,
      label: "Proof",
      breadcrumbs: [
        { label: "Proofs", href: "/proofs" },
        {
          label: isDemo ? "Demo receipt" : `Receipt ${proofId.slice(0, 8)}`,
          technical: !isDemo,
        },
      ],
      detail: isDemo ? "Deterministic demo" : "Hash verification",
    };
  }

  if (pathname === "/proofs") {
    return {
      icon: FileMagnifyingGlass,
      href: "/proofs",
      label: "Proofs",
      breadcrumbs: [{ label: "Proofs", href: "/proofs" }],
      detail: "Evidence registry",
    };
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return {
      icon: SlidersHorizontal,
      href: "/settings",
      label: "Settings",
      breadcrumbs: [{ label: "Settings", href: "/settings" }],
      detail: "Capabilities",
    };
  }

  if (pathname === "/disclosures" || pathname.startsWith("/disclosures/")) {
    return {
      icon: ShieldWarning,
      href: "/disclosures",
      label: "Disclosures",
      breadcrumbs: [{ label: "Disclosures", href: "/disclosures" }],
      detail: "Risk & boundaries",
    };
  }

  return {
    icon: Compass,
    href: "/",
    label: "Navis",
    breadcrumbs: [{ label: "Navis", href: "/" }],
    detail: "Overview",
  };
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
    pathname === match || (match !== "/" && pathname.startsWith(`${match}/`));

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

        <nav className="rail-navigation" aria-label="Workspace sections">
          {navigation.map(({ label, icon: Icon, href, match, helpTopic }) => {
            const current = isCurrent(match);
            return (
              <div className="rail-item" key={label}>
                <Link
                  className="rail-link"
                  data-current={current || undefined}
                  data-label={label}
                  href={href}
                  aria-current={current ? "page" : undefined}
                >
                  <Icon aria-hidden="true" size={20} weight="regular" />
                  <span>{label}</span>
                </Link>
                {helpTopic ? (
                  <span className="rail-item-hint">
                    <InfoHint topic={helpTopic} label={`About ${label}`} />
                  </span>
                ) : null}
              </div>
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
        <div className="mobile-header-actions">
          <span className="network-truth">
            <ModeStamp mode={capabilities.mode} />
            <ClusterStamp cluster={capabilities.cluster} />
          </span>
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
        </div>
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
          <nav className="mobile-navigation" aria-label="Mobile navigation">
            {navigation.map(({ label, icon: Icon, href, match, helpTopic }) => {
              const current = isCurrent(match);
              return (
                <div className="mobile-nav-item" key={label}>
                  <Link
                    className="rail-link"
                    data-current={current || undefined}
                    href={href}
                    onClick={() => setMobileNavOpen(false)}
                    aria-current={current ? "page" : undefined}
                  >
                    <Icon aria-hidden="true" size={20} />
                    <span>{label}</span>
                  </Link>
                  {helpTopic ? (
                    <span className="mobile-nav-hint">
                      <InfoHint topic={helpTopic} label={`About ${label}`} />
                    </span>
                  ) : null}
                </div>
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
          <div className="route-context">
            <span className="route-context-icon" aria-hidden="true">
              <ContextIcon size={16} />
            </span>
            <div className="route-context-copy">
              <nav className="route-breadcrumbs" aria-label="Breadcrumb">
                <ol className="breadcrumbs-list">
                  {context.breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === context.breadcrumbs.length - 1;
                    return (
                      <li key={crumb.label} className="breadcrumb-segment">
                        {idx > 0 ? (
                          <CaretRight
                            size={11}
                            className="breadcrumb-separator"
                            aria-hidden="true"
                          />
                        ) : null}
                        {isLast || !crumb.href ? (
                          <span
                            className="breadcrumb-current"
                            aria-current={isLast ? "page" : undefined}
                            data-technical={crumb.technical || undefined}
                          >
                            {crumb.label}
                          </span>
                        ) : (
                          <Link
                            className="breadcrumb-link"
                            href={crumb.href}
                            data-technical={crumb.technical || undefined}
                          >
                            {crumb.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
              {context.detail ? (
                <small data-technical={context.technical || undefined}>
                  {context.detail}
                </small>
              ) : null}
            </div>
          </div>

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
