import { InfoHint } from "@/components/shared/info-hint";
import type { InfoHintKey } from "@/components/shared/info-hint-content";

/** Workspace topics now live in the shared hint content. */
export type WorkspaceHintKey = InfoHintKey;

/** Thin alias over the shared InfoHint so every hint uses one popover. */
export function WorkspaceHint({
  topic,
  label,
  align = "start",
}: {
  topic: InfoHintKey;
  label?: string;
  align?: "start" | "end";
}) {
  return <InfoHint topic={topic} label={label} align={align} />;
}
