import { Link as WouterLink, useLocation } from "wouter";
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <WouterLink href={href} {...props} />;
}
export function usePathname() {
  return useLocation()[0].split("?")[0];
}
export function useRouter() {
  const [, navigate] = useLocation();
  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    refresh: () => window.dispatchEvent(new Event("navis:refresh")),
    back: () => window.history.back(),
  };
}
export function notFound(): never {
  throw new Error("This record was not found or is not available to this wallet.");
}