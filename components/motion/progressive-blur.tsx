type ProgressiveBlurProps = {
  position?: "top" | "bottom";
  height?: string;
};

/** Adapted from Skiper 41 ProgressiveBlur. Attribution: docs/ATTRIBUTIONS.md */
export function ProgressiveBlur({
  position = "top",
  height = "7rem",
}: ProgressiveBlurProps) {
  return (
    <div
      className="navis-progressive-blur"
      data-position={position}
      style={{ height }}
      aria-hidden="true"
    />
  );
}
