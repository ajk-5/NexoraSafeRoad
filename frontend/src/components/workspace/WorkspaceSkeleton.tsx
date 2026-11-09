/** The workspace's shape while the incident loads, so nothing jumps when it arrives. */
export function WorkspaceSkeleton() {
  return (
    <div className="workspace" role="status" aria-label="Loading incident">
      <div className="skeleton" style={{ height: 96 }} />
      <div className="workspace-grid">
        <div className="ws-col ws-col-main">
          <div className="ws-area-video skeleton" style={{ minHeight: 360 }} />
          <div className="ws-area-ai skeleton" style={{ minHeight: 200 }} />
        </div>
        <div className="ws-col ws-col-side">
          <div className="ws-area-decision skeleton" style={{ minHeight: 260 }} />
          <div className="ws-area-location skeleton" style={{ minHeight: 280 }} />
        </div>
      </div>
    </div>
  );
}
