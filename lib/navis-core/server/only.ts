// Fail closed if a server-only module is accidentally imported into a browser.
if (typeof window !== "undefined") {
  throw new Error("This NAVIS module is server-only.");
}
export {};