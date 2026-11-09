import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, DataView, EmptyState, PageHeader } from "../../components/ui";
import { formatDay, formatDuration, percent } from "../../format";
import { SERVICE_SHORT_LABELS, SERVICES, SEVERITIES, SEVERITY_COLORS, SEVERITY_LABELS } from "../../labels";
import { api } from "../../services/api";
import { useLive } from "../../services/live";
import { useTheme } from "../../services/theme";
import { usePolling } from "../../services/usePolling";
import type { Incident, Statistics } from "../../types/api";

interface Row {
  name: string;
  count: number;
  color?: string;
}

/** The super admin's home: figures for the whole platform, derived from recorded data only. */
export function SuperadminOverview() {
  const statistics = usePolling(() => api.statistics(), [], 15_000);
  const { incidents } = useLive();
  return (
    <>
      <PageHeader description="Aggregated figures for the whole platform. No personal data: operators are not ranked." />
      <DataView data={statistics.data} error={statistics.error} onRetry={statistics.reload}>
        {(stats) => <AnalyticsBody stats={stats} incidents={incidents.data} />}
      </DataView>
    </>
  );
}

function AnalyticsBody({ stats, incidents }: { stats: Statistics; incidents: Incident[] | undefined }) {
  const by = stats.incidentsByStatus;
  const confirmed = by.ALERT_SENT + by.IN_PROGRESS + by.RESOLVED;
  const rejected = by.DECLINED;
  const undecided = by.DETECTED + by.WAITING_FOR_OPERATOR + by.ASSIGNED + by.UNDER_REVIEW;
  const reviewed = confirmed + rejected;
  const decisionSeconds = useMemo(() => averageDecisionSeconds(incidents ?? []), [incidents]);

  if (stats.totalIncidents === 0) {
    return (
      <Card>
        <EmptyState icon="chart" title="No data yet">
          Figures appear once the AI has reported incidents.
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <p className="analytics-summary">
        <strong>{stats.totalIncidents}</strong> incidents detected, <strong>{confirmed}</strong> confirmed as real accidents
        {reviewed > 0 && (
          <>
            {" "}
            (<strong>{percent(rejected / reviewed)}</strong> of reviewed detections were false alarms)
          </>
        )}
        .
        {decisionSeconds !== null && (
          <span title="From detection to the operator's decision, including time waiting in the queue (latest 100 incidents)">
            {" "}
            Operators decide in <strong>{formatDuration(decisionSeconds, true)}</strong> on average
          </span>
        )}
        {stats.averageResponseSeconds !== null && (
          <span title="From the alert being sent to a service operator accepting it">
            {decisionSeconds !== null ? "; services" : " Services"} accept alerts in{" "}
            <strong>{formatDuration(stats.averageResponseSeconds, true)}</strong> on average
          </span>
        )}
        {(decisionSeconds !== null || stats.averageResponseSeconds !== null) && "."}
      </p>

      <div className="grid-2">
        <ChartCard
          title="Incidents per day"
          description="Last 7 days"
          rows={stats.incidentsPerDay.map((d) => ({ name: formatDay(d.date), count: d.count }))}
        />
        <ChartCard
          title="Severity"
          description="All incidents, as estimated by the AI"
          rows={SEVERITIES.map((s) => ({ name: SEVERITY_LABELS[s], count: stats.incidentsBySeverity[s], color: SEVERITY_COLORS[s] }))}
        />
        <ChartCard
          title="Outcome of detections"
          description={reviewed === 0 ? "Nothing reviewed yet" : `${percent(confirmed / reviewed)} of reviewed detections were real accidents`}
          rows={[
            { name: "Confirmed", count: confirmed, color: "#15803d" },
            { name: "False alarm", count: rejected, color: "#64748b" },
            { name: "Not decided yet", count: undecided, color: "#d97706" },
          ]}
        />
        <ChartCard
          title="Alerts by service"
          rows={SERVICES.map((s) => ({ name: SERVICE_SHORT_LABELS[s], count: stats.alertsByService[s] }))}
          empty="No alert sent yet."
        />
        <ChartCard
          title="Incidents by camera"
          description="Where incidents are detected"
          rows={Object.entries(stats.incidentsByCamera)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))}
        />
      </div>
    </>
  );
}

/** Mean time from detection to the operator's decision, over the incidents loaded. */
function averageDecisionSeconds(incidents: Incident[]): number | null {
  const times = incidents.flatMap((i) => (i.decidedAt ? [(Date.parse(i.decidedAt) - Date.parse(i.detectedAt)) / 1000] : []));
  return times.length === 0 ? null : times.reduce((sum, t) => sum + t, 0) / times.length;
}

function ChartCard({ title, description, rows, empty }: { title: string; description?: string; rows: Row[]; empty?: string }) {
  const theme = useTheme();
  const axis = theme === "dark" ? "#a9b6c9" : "#475569";
  const grid = theme === "dark" ? "#22304b" : "#e2e8f0";
  const bar = theme === "dark" ? "#60a5fa" : "#2563eb";
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card title={title} icon="chart">
      {description && <p className="chart-description">{description}</p>}
      {total === 0 ? (
        <EmptyState compact icon="chart" title="Nothing to show">
          {empty ?? "No data for this chart yet."}
        </EmptyState>
      ) : (
        <figure className="chart" aria-label={title}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: grid }} tick={{ fill: axis, fontSize: 12 }} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: theme === "dark" ? "rgb(96 165 250 / 0.1)" : "rgb(37 99 235 / 0.06)" }}
                contentStyle={{
                  background: theme === "dark" ? "#111a2c" : "#ffffff",
                  border: `1px solid ${grid}`,
                  borderRadius: 8,
                  color: theme === "dark" ? "#e2e8f0" : "#0f172a",
                }}
              />
              <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.color ?? bar} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <table className="visually-hidden">
            <caption>{title}</caption>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      )}
    </Card>
  );
}
