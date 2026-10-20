import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { TrainingStatusBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel, StatTile } from "../../components/ui";
import { bestMap50, formatDateTime, formatMetric } from "../../format";
import { useIdParam } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { usePolling } from "../../services/usePolling";
import { confirmActivation } from "../../training";
import type { EpochMetrics, TrainingJob } from "../../types/api";

export function AdminTrainingJob() {
  const id = useIdParam();
  if (id === null) return <div className="notice error">This training job does not exist.</div>;
  return <JobDetail key={id} id={id} />;
}

function JobDetail({ id }: { id: number }) {
  const { data: job, error, reload } = usePolling(() => api.training.job(id), [id], 3_000);
  const models = usePolling(() => api.training.models(), [id], 10_000);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (job === undefined) return <DataState error={error} loading />;
  const result = models.data?.find((m) => m.id === job.resultModelId);
  const running = job.status === "QUEUED" || job.status === "RUNNING";

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      models.reload();
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    if (window.confirm(`Cancel training job #${job.id}?`)) void act(() => api.training.cancelJob(job.id));
  };

  return (
    <>
      <PageHeader title={`Training job #${job.id}`}>
        {running && !job.cancelRequested && (
          <button type="button" className="button danger small" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        )}
        <Link to="/admin/training" className="button ghost small">
          ← AI Training
        </Link>
      </PageHeader>

      {actionError && <div className="notice error">{actionError}</div>}
      <StatusNotice job={job} />
      {job.status === "COMPLETED" && result && (
        <div className="notice success result-notice">
          <span>
            New model <strong>{result.name}</strong>: {formatMetric(result.map50)} mAP50 on the validation images.
            Compare it with the others on the AI Training page.
          </span>
          {result.isActive ? (
            <span className="active-tag">Active</span>
          ) : (
            <button
              type="button"
              className="button primary small"
              disabled={busy}
              onClick={() => {
                if (confirmActivation(result, models.data?.find((m) => m.isActive))) {
                  void act(() => api.training.activateModel(result.id));
                }
              }}
            >
              Use this model for detection
            </button>
          )}
        </div>
      )}

      <div className="tiles">
        <StatTile label="Status" value={<TrainingStatusBadge status={job.status} />} />
        <StatTile label="Epochs" value={`${job.currentEpoch} / ${job.epochs}`} />
        <StatTile label="Best mAP50" value={formatMetric(bestMap50(job))} />
        <StatTile label="Recall (best weights)" value={formatMetric(job.finalMetrics?.recall ?? job.history.at(-1)?.recall)} />
      </div>
      <div className="progress">
        <span style={{ width: `${(job.currentEpoch / job.epochs) * 100}%` }} />
      </div>

      <div className="grid-2">
        <Panel title="Accuracy on validation images">
          <MetricChart
            history={job.history}
            lines={[
              { key: "map50", name: "mAP50", color: "#2563eb" },
              { key: "map50_95", name: "mAP50-95", color: "#7c3aed" },
              { key: "precision", name: "Precision", color: "#16a34a" },
              { key: "recall", name: "Recall", color: "#ea580c" },
            ]}
            percent
          />
        </Panel>
        <Panel title="Training loss">
          <MetricChart
            history={job.history}
            lines={[
              { key: "boxLoss", name: "Box loss", color: "#dc2626" },
              { key: "clsLoss", name: "Class loss", color: "#ca8a04" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Settings">
          <dl className="facts">
            <dt>Dataset</dt>
            <dd>{job.dataset.name}</dd>
            <dt>Started from</dt>
            <dd>{job.baseName}</dd>
            <dt>Image size / batch</dt>
            <dd>
              {job.imageSize}px / {job.batch}
            </dd>
            <dt>Operator feedback</dt>
            <dd>
              {[job.useFalseAlarms && "false alarms", job.useConfirmed && "confirmed accidents"].filter(Boolean).join(", ") || "none"}
            </dd>
            <dt>Worker</dt>
            <dd>{job.workerName ?? "—"}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(job.createdAt)}</dd>
            <dt>Started / finished</dt>
            <dd>
              {job.startedAt ? formatDateTime(job.startedAt) : "—"} / {job.finishedAt ? formatDateTime(job.finishedAt) : "—"}
            </dd>
          </dl>
        </Panel>
        <Panel title="Worker log">
          <JobLog log={job.log} />
        </Panel>
      </div>
    </>
  );
}

function StatusNotice({ job }: { job: TrainingJob }) {
  if (job.status === "QUEUED") {
    return <div className="notice info">Waiting for a training worker (python -m ai.trainer) to pick this job up.</div>;
  }
  if (job.status === "RUNNING" && job.cancelRequested) {
    return <div className="notice warning">Cancelling: training stops at the end of the current epoch.</div>;
  }
  if (job.status === "FAILED") return <div className="notice error">Training failed: {job.error ?? "unknown error"}</div>;
  if (job.status === "CANCELLED") return <div className="notice info">This job was cancelled.</div>;
  return null;
}

type MetricKey = Exclude<keyof EpochMetrics, "epoch">;

function MetricChart({
  history,
  lines,
  percent = false,
}: {
  history: EpochMetrics[];
  lines: { key: MetricKey; name: string; color: string }[];
  percent?: boolean;
}) {
  if (history.length === 0) return <div className="empty">The curves appear after the first epoch.</div>;
  const scale = (value: number | null) => (value === null ? null : percent ? Math.round(value * 1000) / 10 : value);
  const data = history.map((h) => ({ epoch: h.epoch, ...Object.fromEntries(lines.map((l) => [l.key, scale(h[l.key])])) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="epoch" tickLine={false} allowDecimals={false} />
        <YAxis tickLine={false} domain={percent ? [0, 100] : ["auto", "auto"]} unit={percent ? "%" : undefined} />
        <Tooltip labelFormatter={(epoch) => `Epoch ${String(epoch)}`} />
        <Legend />
        {lines.map((line) => (
          <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} dot={false} strokeWidth={2} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** The worker's log, kept scrolled to the newest line. */
function JobLog({ log }: { log: string | null }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  if (!log) return <div className="empty">No log yet.</div>;
  return (
    <pre ref={ref} className="log">
      {log}
    </pre>
  );
}
