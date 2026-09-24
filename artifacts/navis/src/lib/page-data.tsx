import { createContext, useContext } from "react";
export const PageDataContext = createContext<any>(null);
export function usePageData(): any {
  const data = useContext(PageDataContext);
  if (!data) throw new Error("Workspace data has not loaded.");
  return data;
}