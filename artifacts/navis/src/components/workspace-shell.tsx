import {
  Bot,
  Compass,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Lock,
  Menu,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";

import type { PublicCapabilities } from "@workspace/navis-core/lib/env-core";
import { ClusterStamp, ModeStamp } from "@/components/shared/domain-primitives";
import { WalletControl } from "@/components/wallet/wallet-control";

type WorkspaceShellProps = {
  capabilities: PublicCapabilities;
  children: ReactNode;
};

type NavItem = Readonly<{
  label: string;
  icon: LucideIcon;
  href: string;
  match: string;
  group: "Workspace" | "Records" | "Reference";
}>;

const navigation: readonly NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/", match: "/", group: "Workspace" },
  { label: "Atlas", icon: Compass, href: "/agents/atlas", match: "/agents/atlas", group: "Workspace" },
  { label: "Agents", icon: Bot, href: "/agents", match: "/agents", group: "Workspace" },
  { label: "Decisions", icon: Gauge, href: "/decisions", match: "/decisions", group: "Records" },
  { label: "Transactions", icon: ListChecks, href: "/transactions", match: "/transactions", group: "Records" },
  { label: "Proofs", icon: FileSearch, href: "/proofs", match: "/proofs", group: "Records" },
  { label: "Markets", icon: LineChart, href: "/markets/launch", match: "/markets", group: "Reference" },
  { label: "Disclosures", icon: ShieldAlert, href: "/disclosures", match: "/disclosures", group: "Reference" },
];

const navGroups = ["Workspace", "Records", "Reference"] as const;

/** Exact match for Overview; Atlas owns /agents/atlas so Agents excludes it. */
function matches(pathname: string, match: string) {
  if (match === "/") return pathname === "/";
  const hit = pathname === match || pathname.startsWith(`${match}/`);
  if (match === "/agents" && (pathname === "/agents/atlas" || pathname.startsWith("/agents/atlas/"))) {
    return false;
  }
  return hit;
}

type RouteContext = {
  icon: LucideIcon;
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
  const section = navigation.find(({ match }) => match !== "/" && matches(pathname, match));
  if (section) {
    return { icon: section.icon, href: section.href, label: section.label };
  }
  return { icon: LayoutDashboard, href: "/", label: "Overview", detail: "Navis" };
}

function BearingMark() {
  return (
    <span className="bearing-mark" aria-hidden="true">
      <span />
    </span>
  );
}

export function WorkspaceShell({ capabilities, children }: WorkspaceShellProps) {
  const [pathname] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isCurrent = (match: string) => matches(pathname, match);
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
        <Link className="brand-lockup" href="/" aria-label="Navis overview">
          <BearingMark />
          <span>NAVIS</span>
        </Link>

        <nav className="rail-navigation">
          {navGroups.map((group) => (
            <div className="rail-group" key={group} role="group" aria-label={group}>
              <span className="rail-group-label" aria-hidden="true">
                {group}
              </span>
              {navigation
                .filter((item) => item.group === group)
                .map(({ label, icon: Icon, href, match }) => {
                  const current = isCurrent(match);
                  return (
                    <Link
                      className="rail-link"
                      data-current={current || undefined}
                      data-label={label}
                      href={href}
                      key={label}
                      aria-current={current ? "page" : undefined}
                      data-testid={`nav-${label.toLowerCase()}`}
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="rail-footer">
          <Link
            className="rail-link"
            data-current={isCurrent("/settings") || undefined}
            data-label="Settings"
            href="/settings"
            aria-current={isCurrent("/settings") ? "page" : undefined}
          >
            <SlidersHorizontal aria-hidden="true" size={18} strokeWidth={1.75} />
            <span>Settings</span>
          </Link>
          <div className="system-state">
            <Lock aria-hidden="true" size={14} />
            <span>
              <span className="system-state-mode">{capabilities.mode}</span> safeguards
              active
            </span>
          </div>
        </div>
      </aside>

      <header className="mobile-header" inert={mobileNavOpen ? true : undefined}>
        <Link className="brand-lockup" href="/" aria-label="Navis overview">
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
          <Menu aria-hidden="true" size={22} />
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
              <X aria-hidden="true" size={22} />
            </button>
          </div>
          <nav className="mobile-navigation">
            {navGroups.map((group) => (
              <div className="rail-group" key={group} role="group" aria-label={group}>
                <span className="rail-group-label" aria-hidden="true">
                  {group}
                </span>
                {navigation
                  .filter((item) => item.group === group)
                  .map(({ label, icon: Icon, href, match }) => {
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
                        <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
              </div>
            ))}
            <Link
              className="rail-link"
              data-current={isCurrent("/settings") || undefined}
              href="/settings"
              onClick={() => setMobileNavOpen(false)}
              aria-current={isCurrent("/settings") ? "page" : undefined}
            >
              <SlidersHorizontal aria-hidden="true" size={18} strokeWidth={1.75} />
              <span>Settings</span>
            </Link>
          </nav>
          <div className="system-state">
            <Lock aria-hidden="true" size={14} />
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
