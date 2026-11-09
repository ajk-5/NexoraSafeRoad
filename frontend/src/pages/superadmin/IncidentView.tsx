import { Notice } from "../../components/ui";
import { IncidentWorkspace } from "../../components/workspace/IncidentWorkspace";
import { useIdParam } from "../../paths";

/** One incident, read only: the super admin follows incidents but never decides on them. */
export function SuperadminIncident() {
  const id = useIdParam();
  if (id === null) return <Notice tone="error">This incident does not exist.</Notice>;
  return (
    <div className="workspace-container">
      <IncidentWorkspace key={id} id={id} backTo="/superadmin/incidents" backLabel="Back to incidents" />
    </div>
  );
}
