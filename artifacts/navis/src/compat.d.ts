declare module "next/link" {
  const Link: typeof import("./lib/router").default;
  export default Link;
}
declare module "next/navigation" {
  export const usePathname: typeof import("./lib/router").usePathname;
  export const useRouter: typeof import("./lib/router").useRouter;
  export const notFound: typeof import("./lib/router").notFound;
}
declare module "virtual:navis-page/*" {
  const Page: import("react").ComponentType;
  export default Page;
}