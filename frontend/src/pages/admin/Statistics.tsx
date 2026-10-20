import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DataState, PageHeader, Panel, StatTile } from "../../components/ui";
import { formatDay, formatDuration } from "../../format";
import { SERVICE_LABELS, SERVICES, SEVERITIES, SEVERITY_COLORS } from "../../labels";
import { api } from "../../services/api";
import { usePolling } from "../../services/usePolling";

const BAR_COLOR = "#2563eb";

interface Row {
  name: string;
  count: number;
  color?: string;
}

/** README "Admin Statistics Page": a few simple figures, no analytics dashboard. */
export function AdminStatistics() {
  const { data: stats, error } = usePolling(() => api.statistics(), [], 15_000);
  if (stats === undefined) return <DataState error={error} loading />;

  const alertsSent = Object.values(stats.alertsByService).reduce((sum, n) => sum + n, 0);
  const perDay = stats.incidentsPerDay.map((d) => ({ name: formatDay(d.date), count: d.count }));
  const bySeverity = SEVERITIES.map((s) => ({ name: s, count: stats.incidentsBySeverity[s], color: SEVERITY_COLORS[s] }));
  const byService = SERVICES.map((s) => ({ name: SERVICE_LABELS[s], count: stats.alertsByService[s] }));
  const byCamera = Object.entries(stats.incidentsByCamera).map(([name, count]) => ({ name, count }));

  return (
    <>
      <PageHeader title="Statistics" />
      <div className="tiles">
        <StatTile label="Total incidents" value={stats.totalIncidents} />
        <StatTile label="Resolved incidents" value={stats.resolvedIncidents} />
        <StatTile label="Alerts sent" value={alertsSent} />
        <StatTile
          label="Average response time"
          value={stats.averageResponseSeconds === null ? "—" : formatDuration(stats.averageResponseSeconds)}
        />
      </div>
      <div className="grid-2">
        <ChartPanel title="Incidents per day" rows={perDay} />
        <ChartPanel title="Incidents by severity" rows={bySeverity} />
        <ChartPanel title="Alerts by service" rows={byService} />
        <ChartPanel title="Incidents by camera" rows={byCamera} empty="No incidents yet." />
      </div>
    </>
  );
}

function ChartPanel({ title, rows, empty }: { title: string; rows: Row[]; empty?: string }): ReactNode {
  return (
    <Panel title={title}>
      {rows.length === 0 && empty ? (
        <div className="empty">{empty}</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} />
            <YAxis allowDecimals={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
            <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.name} fill={row.color ?? BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
