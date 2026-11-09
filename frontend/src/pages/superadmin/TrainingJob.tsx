import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ActivateModelDialog } from "../../components/ActivateModelDialog";
import { TrainingStatusBadge } from "../../components/Badges";
import { ConfirmDialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { Card, DataView, EmptyState, Notice, PageHeader } from "../../components/ui";
import { bestMap50, formatDateTime, formatMetric } from "../../format";
import { useIdParam } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { useTheme } from "../../services/theme";
import { usePolling } from "../../services/usePolling";
import type { EpochMetrics, TrainingJob } from "../../types/api";

export function SuperadminTrainingJob() {
  const id = useIdParam();
  if (id === null) return <Notice tone="error">This training job does not exist.</Notice>;
  return <JobDetail key={id} id={id} />;
}

function JobDetail({ id }: { id: number }) {
  const job = usePolling(() => api.training.job(id), [id], 3_000);
  return (
    <DataView data={job.data} error={job.error} onRetry={job.reload}>
      {(data) => <JobBody job={data} reload={job.reload} />}
    </DataView>
  );
}

function JobBody({ job, reload }: { job: TrainingJob; reload: () => void }) {
  const models = usePolling(() => api.training.models(), [job.id], 10_000);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const result = models.data?.find((m) => m.id === job.resultModelId);
  const running = job.status === "QUEUED" || job.status === "RUNNING";

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.training.cancelJob(job.id);
      setCancelling(false);
      reload();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={`Training job #${job.id}`} description={`${job.dataset.name} · started from ${job.baseName}`}>
        <Link to="/superadmin/training" className="btn btn-ghost btn-sm">
          <Icon name="chevronLeft" size="sm" />
          All training
        </Link>
        {running && !job.cancelRequested && (
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setCancelling(true)}>
            Cancel job
          </button>
        )}
      </PageHeader>

      <StatusNotice job={job} />
      {job.status === "COMPLETED" && result && (
        <Notice
          tone="success"
          title={`New model: ${result.name}`}
          actions={
            result.isActive ? (
              <span className="badge status-badge tone-done">
                <span className="dot" aria-hidden="true" />
                Active
              </span>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setActivating(true)}>
                Use this model for detection
              </button>
            )
          }
        >
          {formatMetric(result.map50)} mAP50 on the validation images. Compare it with the other models before switching.
        </Notice>
      )}

      <div className="job-status-line">
        <TrainingStatusBadge status={job.status} />
        <span>
          Epoch <strong className="num">{job.currentEpoch}</strong> of {job.epochs}
        </span>
        <span>
          Best mAP50 <strong className="num">{formatMetric(bestMap50(job))}</strong>
        </span>
        <span>
          Recall <strong className="num">{formatMetric(job.finalMetrics?.recall ?? job.history.at(-1)?.recall)}</strong>
        </span>
      </div>
      <div className="progress" role="progressbar" aria-label="Training progress" aria-valuemin={0} aria-valuemax={job.epochs} aria-valuenow={job.currentEpoch}>
        <span style={{ width: `${(job.currentEpoch / job.epochs) * 100}%` }} />
      </div>

      <div className="grid-2">
        <Card title="Accuracy on validation images" icon="chart">
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
        </Card>
        <Card title="Training loss" icon="activity">
          <MetricChart
            history={job.history}
            lines={[
              { key: "boxLoss", name: "Box loss", color: "#dc2626" },
              { key: "clsLoss", name: "Class loss", color: "#ca8a04" },
            ]}
          />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Settings" icon="cpu">
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
            <dd>{[job.useFalseAlarms && "false alarms", job.useConfirmed && "confirmed accidents"].filter(Boolean).join(", ") || "none"}</dd>
            <dt>Worker</dt>
            <dd>{job.workerName ?? "—"}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(job.createdAt)}</dd>
            <dt>Started / finished</dt>
            <dd>
              {job.startedAt ? formatDateTime(job.startedAt) : "—"} / {job.finishedAt ? formatDateTime(job.finishedAt) : "—"}
            </dd>
          </dl>
        </Card>
        <Card title="Worker log" icon="file">
          <JobLog log={job.log} />
        </Card>
      </div>

      {cancelling && (
        <ConfirmDialog
          title={`Cancel training job #${job.id}?`}
          icon="x"
          tone="danger"
          confirmLabel="Cancel the job"
          cancelLabel="Keep training"
          busyLabel="Cancelling…"
          busy={busy}
          error={error}
          onConfirm={() => void cancel()}
          onCancel={() => setCancelling(false)}
        >
          <p>Training stops at the end of the current epoch. No model is produced.</p>
        </ConfirmDialog>
      )}
      {activating && result && (
        <ActivateModelDialog
          model={result}
          active={models.data?.find((m) => m.isActive)}
          onCancel={() => setActivating(false)}
          onDone={() => {
            setActivating(false);
            models.reload();
          }}
        />
      )}
    </>
  );
}

function StatusNotice({ job }: { job: TrainingJob }) {
  if (job.status === "QUEUED") return <Notice tone="info">Waiting for a training worker (python -m ai.trainer) to pick this job up.</Notice>;
  if (job.status === "RUNNING" && job.cancelRequested) return <Notice tone="warning">Cancelling: training stops at the end of the current epoch.</Notice>;
  if (job.status === "FAILED") return <Notice tone="error" title="Training failed">{job.error ?? "Unknown error"}</Notice>;
  if (job.status === "CANCELLED") return <Notice tone="info">This job was cancelled.</Notice>;
  return null;
}

type MetricKey = Exclude<keyof EpochMetrics, "epoch">;

function MetricChart({ history, lines, percent = false }: { history: EpochMetrics[]; lines: { key: MetricKey; name: string; color: string }[]; percent?: boolean }) {
  const theme = useTheme();
  if (history.length === 0) {
    return (
      <EmptyState compact icon="chart" title="No curve yet">
        The curves appear after the first epoch.
      </EmptyState>
    );
  }
  const axis = theme === "dark" ? "#a9b6c9" : "#475569";
  const grid = theme === "dark" ? "#22304b" : "#e2e8f0";
  const scale = (value: number | null) => (value === null ? null : percent ? Math.round(value * 1000) / 10 : value);
  const data = history.map((h) => ({ epoch: h.epoch, ...Object.fromEntries(lines.map((l) => [l.key, scale(h[l.key])])) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
        <XAxis dataKey="epoch" tickLine={false} allowDecimals={false} tick={{ fill: axis, fontSize: 12 }} />
        <YAxis tickLine={false} domain={percent ? [0, 100] : ["auto", "auto"]} unit={percent ? "%" : undefined} tick={{ fill: axis, fontSize: 12 }} />
        <Tooltip labelFormatter={(epoch) => `Epoch ${String(epoch)}`} />
        <Legend />
        {lines.map((line) => (
          <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
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
  if (!log) {
    return (
      <EmptyState compact icon="file" title="No log yet">
        The worker's output appears here while it trains.
      </EmptyState>
    );
  }
  return (
    <pre ref={ref} className="log" tabIndex={0} aria-label="Worker log">
      {log}
    </pre>
  );
}
