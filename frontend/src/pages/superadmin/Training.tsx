import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ActivateModelDialog } from "../../components/ActivateModelDialog";
import { TrainingStatusBadge } from "../../components/Badges";
import { Icon } from "../../components/Icon";
import { Card, DataView, Disclosure, EmptyState, Notice, SegmentedControl, Tabs } from "../../components/ui";
import { aiPrediction } from "../../domain/incidents";
import { bestMap50, formatBytes, formatDateTime, formatMetric, percent, timeAgo } from "../../format";
import { IMAGE_SIZES, STOCK_CHECKPOINTS } from "../../labels";
import { workspacePath } from "../../paths";
import { api, errorMessage } from "../../services/api";
import { useLive } from "../../services/live";
import { useTheme } from "../../services/theme";
import { usePolling } from "../../services/usePolling";
import { datasetFileProblem, hasAccidentClass } from "../../training";
import type { AIModel, BaseCheckpoint, Incident, TrainingDataset, TrainingJob, TrainingOverview } from "../../types/api";

type Tab = "models" | "train" | "jobs" | "review";

/** Models, datasets, training jobs and the operators' verdicts on the AI's detections. */
export function SuperadminTraining() {
  const overview = usePolling(() => api.training.overview(), []);
  const models = usePolling(() => api.training.models(), []);
  const datasets = usePolling(() => api.training.datasets(), [], 15_000);
  const jobs = usePolling(() => api.training.jobs(), []);
  const [tab, setTab] = useState<Tab>("models");

  return (
    <>
      {overview.data && !overview.data.worker?.online && <WorkerNotice />}
      <Tabs
        idBase="training"
        label="AI and training data"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "models", label: "Models", icon: "cpu" },
          { key: "train", label: "Datasets & training", icon: "upload" },
          { key: "jobs", label: "Training jobs", icon: "activity" },
          { key: "review", label: "Prediction review", icon: "check" },
        ]}
      >
        {tab === "models" && (
          <ModelsPanel
            models={models.data}
            error={models.error}
            onRetry={models.reload}
            onActivated={() => {
              models.reload();
              overview.reload();
            }}
          />
        )}
        {tab === "train" && (
          <div className="grid-2 align-start">
            <DatasetsPanel datasets={datasets.data} error={datasets.error} onRetry={datasets.reload} onUploaded={datasets.reload} />
            <NewJobPanel datasets={datasets.data ?? []} models={models.data ?? []} overview={overview.data} />
          </div>
        )}
        {tab === "jobs" && <JobsPanel jobs={jobs.data} error={jobs.error} onRetry={jobs.reload} />}
        {tab === "review" && <PredictionReview overview={overview.data} />}
      </Tabs>
    </>
  );
}

function WorkerNotice() {
  return (
    <Notice tone="warning" title="No training worker is running">
      Jobs wait in the queue until one starts. On the machine with the GPU, from the repository root, run{" "}
      <code>.venv\Scripts\python -m ai.trainer --backend http://localhost:8000</code>
    </Notice>
  );
}

// ---------- Models ----------

function ModelsPanel({ models, error, onRetry, onActivated }: { models: AIModel[] | undefined; error: string | null; onRetry: () => void; onActivated: () => void }) {
  const [activating, setActivating] = useState<AIModel | null>(null);
  const theme = useTheme();
  const active = models?.find((m) => m.isActive);
  const compared = (models ?? []).filter((m) => m.map50 !== null);

  return (
    <Card title="Models" icon="cpu" flush>
      <DataView data={models} error={error} onRetry={onRetry}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon="cpu" title="No model yet">
              The pretrained model is registered when the backend first starts.
            </EmptyState>
          ) : (
            <>
              {compared.length > 1 && (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={compared.map((m) => ({ name: m.name, map50: Math.round((m.map50 ?? 0) * 1000) / 10 }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#22304b" : "#e2e8f0"} />
                      <XAxis dataKey="name" tickLine={false} tick={{ fill: theme === "dark" ? "#a9b6c9" : "#475569", fontSize: 12 }} tickFormatter={(name: string) => name.split(" · ")[0] ?? name} />
                      <YAxis domain={[0, 100]} unit="%" tickLine={false} tick={{ fill: theme === "dark" ? "#a9b6c9" : "#475569", fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${String(value)}%`, "mAP50"]} />
                      <Bar dataKey="map50" fill={theme === "dark" ? "#60a5fa" : "#2563eb"} radius={[4, 4, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">Models</caption>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">mAP50</th>
                      <th scope="col">Precision</th>
                      <th scope="col">Recall</th>
                      <th scope="col">Classes</th>
                      <th scope="col">Added</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((model) => (
                      <tr key={model.id}>
                        <td>
                          <span className="strong">{model.name}</span>
                          {model.isActive && <span className="badge status-badge tone-done model-active"><span className="dot" aria-hidden="true" />Active</span>}
                          <span className="cell-sub">
                            {model.source === "PRETRAINED" ? "Pretrained" : "Trained here"}
                            {model.metricsNote && ` · ${model.metricsNote}`}
                          </span>
                        </td>
                        <td className="num">{formatMetric(model.map50)}</td>
                        <td className="num">{formatMetric(model.precision)}</td>
                        <td className="num">{formatMetric(model.recall)}</td>
                        <td>
                          <ClassChips names={model.classNames} />
                        </td>
                        <td className="nowrap">{timeAgo(model.createdAt)}</td>
                        <td className="actions">
                          {!model.isActive && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActivating(model)}>
                              Use for detection
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }
      </DataView>
      {activating && (
        <ActivateModelDialog
          model={activating}
          active={active}
          onCancel={() => setActivating(null)}
          onDone={() => {
            setActivating(null);
            onActivated();
          }}
        />
      )}
    </Card>
  );
}

function ClassChips({ names, detector }: { names: string[]; detector?: string[] }) {
  return (
    <span className="chips">
      {names.map((name) => (
        <span key={name} className={`chip${detector?.includes(name) ? " strong" : ""}`}>
          {name}
        </span>
      ))}
    </span>
  );
}

// ---------- Datasets ----------

function DatasetsPanel({
  datasets,
  error,
  onRetry,
  onUploaded,
}: {
  datasets: TrainingDataset[] | undefined;
  error: string | null;
  onRetry: () => void;
  onUploaded: () => void;
}) {
  return (
    <Card title="Datasets" icon="file">
      <div className="stack">
        <DatasetUpload onUploaded={onUploaded} />
        <DataView data={datasets} error={error} onRetry={onRetry}>
          {(list) =>
            list.length === 0 ? (
              <EmptyState compact icon="file" title="No dataset yet">
                Upload a YOLO-format zip to train on.
              </EmptyState>
            ) : (
              <ul className="dataset-list">
                {list.map((dataset) => (
                  <li key={dataset.id}>
                    <div className="dataset-head">
                      <strong>{dataset.name}</strong>
                      <span className="small muted">{timeAgo(dataset.createdAt)}</span>
                    </div>
                    <div className="small muted">
                      {dataset.trainImages} train · {dataset.valImages} validation · {dataset.testImages} test images · {formatBytes(dataset.sizeBytes)}
                    </div>
                    <ClassChips names={dataset.classNames} detector={dataset.detectorClasses} />
                    {dataset.detectorClasses.length === 0 && (
                      <p className="error-text">No accident, fire or overturned class: the detector would ignore what this teaches.</p>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </DataView>
      </div>
    </Card>
  );
}

type UploadState = { kind: "idle" } | { kind: "uploading"; progress: number } | { kind: "failed"; message: string } | { kind: "done"; name: string };

/** Drag-and-drop or pick a zip; shows progress, and keeps the file for a retry if it fails. */
function DatasetUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const uploading = state.kind === "uploading";

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const issue = datasetFileProblem(picked);
    setProblem(issue);
    setFile(issue ? null : picked);
    setState({ kind: "idle" });
  };

  const upload = async (event?: FormEvent) => {
    event?.preventDefault();
    if (file === null || uploading) return;
    setState({ kind: "uploading", progress: 0 });
    const datasetName = name.trim() || file.name.replace(/\.zip$/i, "");
    try {
      await api.training.uploadDataset(datasetName, file, (progress) => setState({ kind: "uploading", progress }));
      setState({ kind: "done", name: datasetName });
      setFile(null);
      setName("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch (failure) {
      setState({ kind: "failed", message: errorMessage(failure) });
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!uploading) choose(event.dataTransfer.files[0]);
  };

  return (
    <form className="stack" onSubmit={(event) => void upload(event)}>
      <label
        className={`dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="visually-hidden"
          onChange={(event) => choose(event.target.files?.[0])}
          disabled={uploading}
        />
        <Icon name={file ? "file" : "upload"} size="lg" />
        {file ? (
          <span>
            <strong>{file.name}</strong> · {formatBytes(file.size)}
          </span>
        ) : (
          <span>
            <strong>Drop a dataset zip here</strong> or click to choose a file
          </span>
        )}
        <span className="small muted">YOLO format, e.g. a Roboflow “YOLOv8” export: data.yaml with train/ and valid/ folders.</span>
      </label>
      {problem && (
        <Notice tone="error" live="alert">
          {problem}
        </Notice>
      )}
      {file && (
        <div className="upload-row">
          <label className="field grow">
            <span className="field-label">Name (optional)</span>
            <input className="input" placeholder={file.name.replace(/\.zip$/i, "")} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} disabled={uploading} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            <Icon name="upload" size="sm" />
            Upload
          </button>
        </div>
      )}
      {state.kind === "uploading" && (
        <div className="upload-progress" role="status">
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <span className="small muted">{state.progress >= 1 ? "Checking the dataset on the server…" : `Uploading… ${percent(state.progress)}`}</span>
        </div>
      )}
      {state.kind === "failed" && (
        <Notice
          tone="error"
          title="Upload failed"
          live="alert"
          actions={
            file && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void upload()}>
                <Icon name="refresh" size="sm" />
                Retry
              </button>
            )
          }
        >
          {state.message}
        </Notice>
      )}
      {state.kind === "done" && (
        <Notice tone="success" live="status">
          “{state.name}” uploaded and checked.
        </Notice>
      )}
    </form>
  );
}

// ---------- Start a training job ----------

function NewJobPanel({ datasets, models, overview }: { datasets: TrainingDataset[]; models: AIModel[]; overview: TrainingOverview | undefined }) {
  const navigate = useNavigate();
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [epochs, setEpochs] = useState(50);
  const [imageSize, setImageSize] = useState(640);
  const [batch, setBatch] = useState(16);
  const [useFalseAlarms, setUseFalseAlarms] = useState(true);
  const [useConfirmed, setUseConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (datasets.length === 0) {
    return (
      <Card title="Start training" icon="activity">
        <EmptyState compact icon="upload" title="Upload a dataset first">
          Training needs at least one dataset.
        </EmptyState>
      </Card>
    );
  }
  // Defaults: the newest dataset, starting from the active model.
  const dataset = datasets.find((d) => d.id === datasetId) ?? datasets[0];
  const active = models.find((m) => m.isActive);
  const chosenBase = base ?? (active ? `model:${active.id}` : "checkpoint:yolo11s.pt");
  const canUseConfirmed = dataset !== undefined && hasAccidentClass(dataset);
  const falseAlarms = overview?.feedback.falseAlarms ?? 0;
  const confirmed = overview?.feedback.confirmed ?? 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (dataset === undefined || busy) return;
    setBusy(true);
    setError(null);
    const [kind, value = ""] = chosenBase.split(":");
    try {
      const job = await api.training.createJob({
        datasetId: dataset.id,
        ...(kind === "model" ? { baseModelId: Number(value) } : { baseCheckpoint: value as BaseCheckpoint }),
        epochs,
        imageSize,
        batch,
        useFalseAlarms,
        useConfirmed: useConfirmed && canUseConfirmed,
      });
      void navigate(`/superadmin/training/jobs/${job.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Card title="Start training" icon="activity">
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span className="field-label">Dataset</span>
          <select className="select" value={dataset?.id} onChange={(event) => setDatasetId(Number(event.target.value))}>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.trainImages} images)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Start from</span>
          <select className="select" value={chosenBase} onChange={(event) => setBase(event.target.value)}>
            <optgroup label="Our models (fine-tune)">
              {models.map((m) => (
                <option key={m.id} value={`model:${m.id}`}>
                  {m.name}
                  {m.isActive ? " (active)" : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Start fresh from a general model">
              {STOCK_CHECKPOINTS.map((c) => (
                <option key={c.value} value={`checkpoint:${c.value}`}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={useFalseAlarms} onChange={(event) => setUseFalseAlarms(event.target.checked)} />
          <span>
            Learn from false alarms: frames of the {falseAlarms} incident{falseAlarms === 1 ? "" : "s"} admins rejected
          </span>
        </label>
        <label className={`check${canUseConfirmed ? "" : " disabled"}`}>
          <input type="checkbox" checked={useConfirmed && canUseConfirmed} onChange={(event) => setUseConfirmed(event.target.checked)} disabled={!canUseConfirmed} />
          <span>
            Add the {confirmed} confirmed accident{confirmed === 1 ? "" : "s"}, with boxes drawn by the active model
            {!canUseConfirmed && " (needs a dataset with an accident class)"}
          </span>
        </label>
        <Disclosure summary={`Advanced settings · ${epochs} epochs, ${imageSize}px, batch ${batch}`} icon="cpu">
          <div className="field-row">
            <label className="field">
              <span className="field-label">Epochs</span>
              <input className="input" type="number" min={1} max={500} value={epochs} onChange={(event) => setEpochs(Number(event.target.value))} required />
            </label>
            <label className="field">
              <span className="field-label">Image size</span>
              <select className="select" value={imageSize} onChange={(event) => setImageSize(Number(event.target.value))}>
                {IMAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Batch</span>
              <input className="input" type="number" min={1} max={128} value={batch} onChange={(event) => setBatch(Number(event.target.value))} required />
            </label>
          </div>
        </Disclosure>
        {error && (
          <Notice tone="error" live="alert">
            {error}
          </Notice>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {busy ? "Starting…" : "Start training"}
        </button>
        <p className="field-hint">A new model is never used automatically: you compare it and choose.</p>
      </form>
    </Card>
  );
}

// ---------- Jobs ----------

function JobsPanel({ jobs, error, onRetry }: { jobs: TrainingJob[] | undefined; error: string | null; onRetry: () => void }) {
  const navigate = useNavigate();
  return (
    <Card title="Training jobs" icon="activity" flush>
      <DataView data={jobs} error={error} onRetry={onRetry}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState icon="activity" title="No training job yet">
              Start one from “Datasets & training”.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table interactive">
                <caption className="visually-hidden">Training jobs</caption>
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Status</th>
                    <th scope="col">Dataset</th>
                    <th scope="col">Started from</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Best mAP50</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((job) => (
                    <tr key={job.id} onClick={() => void navigate(`/superadmin/training/jobs/${job.id}`)}>
                      <td>
                        <Link to={`/superadmin/training/jobs/${job.id}`} className="row-link" onClick={(event) => event.stopPropagation()}>
                          #{job.id}
                        </Link>
                      </td>
                      <td>
                        <TrainingStatusBadge status={job.status} />
                      </td>
                      <td>{job.dataset.name}</td>
                      <td>{job.baseName}</td>
                      <td className="progress-cell">
                        <div className="progress small" aria-hidden="true">
                          <span style={{ width: `${(job.currentEpoch / job.epochs) * 100}%` }} />
                        </div>
                        <span className="small muted num">
                          {job.currentEpoch} / {job.epochs}
                        </span>
                      </td>
                      <td className="num">{formatMetric(bestMap50(job))}</td>
                      <td className="nowrap">{timeAgo(job.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataView>
    </Card>
  );
}

// ---------- Prediction review ----------

type Verdict = "all" | "confirmed" | "rejected";

/**
 * How admins judged the AI's detections. Each decision in the workspace is a label: a rejected
 * incident is a false alarm, a confirmed one a real accident. Training jobs can learn from both.
 */
function PredictionReview({ overview }: { overview: TrainingOverview | undefined }) {
  const { incidents } = useLive();
  const [verdict, setVerdict] = useState<Verdict>("all");
  const reviewed = useMemo(
    () => (incidents.data ?? []).filter((i) => i.status === "DECLINED" || i.alerts.length > 0 || i.confirmedAt !== null),
    [incidents.data],
  );
  const shown = reviewed.filter((i) => verdict === "all" || (verdict === "rejected" ? i.status === "DECLINED" : i.status !== "DECLINED"));
  const toReview = (incidents.data ?? []).filter((i) => i.status !== "DECLINED" && i.alerts.length === 0 && i.confirmedAt === null).length;

  return (
    <Card title="Prediction review" icon="check" flush>
      <div className="card-body stack">
        <p className="muted">
          Every incident is an AI prediction. Admins mark it correct (confirm the accident) or incorrect (reject a false alarm) in the
          workspace; those verdicts are the labels training jobs use.
          {overview && ` The server counts ${overview.feedback.falseAlarms} false alarm${overview.feedback.falseAlarms === 1 ? "" : "s"} and ${overview.feedback.confirmed} confirmed accident${overview.feedback.confirmed === 1 ? "" : "s"} with a clip.`}
        </p>
        <div className="toolbar">
          <SegmentedControl
            label="Verdict"
            segments={[
              { key: "all", label: "All reviewed" },
              { key: "confirmed", label: "Correct (accident)" },
              { key: "rejected", label: "Incorrect (false alarm)" },
            ]}
            value={verdict}
            onChange={setVerdict}
          />
          {toReview > 0 && (
            <Link to="/superadmin/incidents" className="btn btn-ghost btn-sm">
              {toReview} not reviewed yet
              <Icon name="chevronRight" size="sm" />
            </Link>
          )}
        </div>
      </div>
      <DataView data={incidents.data} error={incidents.error} onRetry={incidents.reload}>
        {() =>
          shown.length === 0 ? (
            <EmptyState icon="check" title="No reviewed prediction yet">
              Admins build these labels when they confirm or reject incidents in their dashboard.
            </EmptyState>
          ) : (
            <ReviewTable incidents={shown} />
          )
        }
      </DataView>
    </Card>
  );
}

function ReviewTable({ incidents }: { incidents: Incident[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Reviewed predictions</caption>
        <thead>
          <tr>
            <th scope="col">Incident</th>
            <th scope="col">AI prediction</th>
            <th scope="col">Confidence</th>
            <th scope="col">Operator verdict</th>
            <th scope="col">Clip</th>
            <th scope="col">Detected</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td>
                <Link to={workspacePath("SUPERADMIN", incident.id)} className="row-link mono">
                  {incident.reference}
                </Link>
              </td>
              <td>{aiPrediction(incident)}</td>
              <td className="num">{percent(incident.confidence)}</td>
              <td>
                {incident.status === "DECLINED" ? (
                  <span className="verdict rejected">
                    <Icon name="x" size="sm" />
                    False alarm
                  </span>
                ) : (
                  <span className="verdict confirmed">
                    <Icon name="check" size="sm" />
                    Real accident
                  </span>
                )}
                {incident.assignedAdmin && <span className="cell-sub">by {incident.assignedAdmin}</span>}
              </td>
              <td>{incident.videoUrl ? <a href={incident.videoUrl}>View clip</a> : <span className="subtle">None</span>}</td>
              <td className="nowrap">{formatDateTime(incident.detectedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
