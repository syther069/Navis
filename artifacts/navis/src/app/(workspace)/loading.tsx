export default function WorkspaceLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-eyebrow">Resolving workspace</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-copy" />
      <div className="skeleton skeleton-panel" />
      <span className="sr-only">Loading route</span>
    </div>
  );
}
