import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { TrainingStatusBadge } from "../../components/Badges";
import { DataState, PageHeader, Panel, StatTile } from "../../components/ui";
import { bestMap50, formatBytes, formatMetric, timeAgo } from "../../format";
import { IMAGE_SIZES, STOCK_CHECKPOINTS } from "../../labels";
import { api, errorMessage } from "../../services/api";
import { usePolling } from "../../services/usePolling";
import { confirmActivation, hasAccidentClass } from "../../training";
import type { AIModel, BaseCheckpoint, TrainingDataset, TrainingJob, TrainingOverview } from "../../types/api";

/** The admin "AI Training" page: models, datasets and training jobs. */
export function AdminTraining() {
  const overview = usePolling(() => api.training.overview(), []);
  const models = usePolling(() => api.training.models(), []);
  const datasets = usePolling(() => api.training.datasets(), [], 15_000);
  const jobs = usePolling(() => api.training.jobs(), []);

  return (
    <>
      <PageHeader title="AI Training" />
      <OverviewTiles overview={overview.data} />
      {overview.data && !overview.data.worker?.online && <WorkerNotice />}
      <ModelsPanel
        models={models.data}
        error={models.error}
        onActivated={() => {
          models.reload();
          overview.reload();
        }}
      />
      <div className="grid-2">
        <DatasetsPanel datasets={datasets.data} error={datasets.error} onUploaded={datasets.reload} />
        <NewJobPanel datasets={datasets.data ?? []} models={models.data ?? []} overview={overview.data} />
      </div>
      <JobsPanel jobs={jobs.data} error={jobs.error} />
    </>
  );
}

function OverviewTiles({ overview }: { overview: TrainingOverview | undefined }) {
  if (overview === undefined) return null;
  const { activeModel, worker } = overview;
  return (
    <div className="tiles">
      <StatTile
        label={activeModel ? `Active: ${activeModel.name}` : "No active model"}
        value={activeModel ? `${formatMetric(activeModel.map50)} mAP50` : "—"}
      />
      <StatTile
        label={worker?.online ? worker.device || worker.name : "No worker running"}
        value={worker?.online ? "Worker online" : "Worker offline"}
        tone={worker?.online ? undefined : "warning"}
      />
      <StatTile label={`${overview.queuedJobs} queued`} value={`${overview.runningJobs} training`} />
      <StatTile
        label={`False alarms to learn from · ${overview.feedback.confirmed} confirmed accidents`}
        value={overview.feedback.falseAlarms}
      />
    </div>
  );
}

function WorkerNotice() {
  return (
    <div className="notice warning">
      No training worker is running, so jobs wait in the queue. On the machine with the GPU, from the
      repository root, run <code>.venv\Scripts\python -m ai.trainer --backend http://localhost:8000</code>
    </div>
  );
}

function ModelsPanel({ models, error, onActivated }: { models: AIModel[] | undefined; error: string | null; onActivated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activate = async (model: AIModel) => {
    if (!confirmActivation(model, models?.find((m) => m.isActive))) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.training.activateModel(model.id);
      onActivated();
    } catch (failure) {
      setActionError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const compared = (models ?? []).filter((m) => m.map50 !== null);
  return (
    <Panel title="Models">
      <DataState error={error} loading={models === undefined} />
      {actionError && <div className="notice error">{actionError}</div>}
      {compared.length > 1 && (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={compared.map((m) => ({ name: m.name, map50: Math.round((m.map50 ?? 0) * 1000) / 10 }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} tickFormatter={(name: string) => name.split(" · ")[0] ?? name} />
            <YAxis domain={[0, 100]} unit="%" tickLine={false} />
            <Tooltip formatter={(value) => [`${String(value)}%`, "mAP50"]} />
            <Bar dataKey="map50" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {models && models.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Model</th>
              <th>mAP50</th>
              <th>mAP50-95</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>Classes</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id}>
                <td>
                  <div className="model-name">
                    {model.name}
                    {model.isActive && <span className="active-tag">Active</span>}
                  </div>
                  <div className="muted small">
                    {model.source === "PRETRAINED" ? "Pretrained" : "Trained here"}
                    {model.metricsNote && ` · ${model.metricsNote}`}
                  </div>
                </td>
                <td>{formatMetric(model.map50)}</td>
                <td>{formatMetric(model.map50_95)}</td>
                <td>{formatMetric(model.precision)}</td>
                <td>{formatMetric(model.recall)}</td>
                <td>
                  <ClassChips names={model.classNames} />
                </td>
                <td>{timeAgo(model.createdAt)}</td>
                <td>
                  {!model.isActive && (
                    <button type="button" className="button secondary small" onClick={() => void activate(model)} disabled={busy}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function ClassChips({ names, detector }: { names: string[]; detector?: string[] }) {
  return (
    <span className="chips">
      {names.map((name) => (
        <span key={name} className={`chip${detector?.includes(name) ? " detector" : ""}`}>
          {name}
        </span>
      ))}
    </span>
  );
}

function DatasetsPanel({
  datasets,
  error,
  onUploaded,
}: {
  datasets: TrainingDataset[] | undefined;
  error: string | null;
  onUploaded: () => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (file === null) return;
    setUploadError(null);
    setProgress(0);
    try {
      await api.training.uploadDataset(name.trim() || file.name.replace(/\.zip$/i, ""), file, setProgress);
      setName("");
      setFile(null);
      (event.target as HTMLFormElement).reset();
      onUploaded();
    } catch (failure) {
      setUploadError(errorMessage(failure));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Panel title="Datasets">
      <form className="upload-form" onSubmit={(event) => void upload(event)}>
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={progress !== null}
          required
        />
        <input
          className="text-input"
          placeholder="Dataset name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          disabled={progress !== null}
        />
        <button type="submit" className="button primary small" disabled={file === null || progress !== null}>
          Upload
        </button>
      </form>
      <p className="hint left">
        A YOLO-format zip, for example a Roboflow export in "YOLOv8" format: a data.yaml plus train/ and valid/ folders.
      </p>
      {progress !== null && (
        <div className="progress" aria-label="Upload progress">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {uploadError && <div className="notice error">{uploadError}</div>}
      <DataState error={error} loading={datasets === undefined} empty={datasets?.length === 0 ? "No dataset yet." : undefined} />
      <ul className="list datasets">
        {(datasets ?? []).map((dataset) => (
          <li key={dataset.id}>
            <div>
              <strong>{dataset.name}</strong>
              <div className="muted small">
                {dataset.trainImages} train · {dataset.valImages} validation · {dataset.testImages} test images ·{" "}
                {formatBytes(dataset.sizeBytes)} · {timeAgo(dataset.createdAt)}
              </div>
              <ClassChips names={dataset.classNames} detector={dataset.detectorClasses} />
              {dataset.detectorClasses.length === 0 && (
                <div className="error-text">No accident, fire or overturned class: the detector would ignore what this teaches.</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function NewJobPanel({
  datasets,
  models,
  overview,
}: {
  datasets: TrainingDataset[];
  models: AIModel[];
  overview: TrainingOverview | undefined;
}) {
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
      <Panel title="Start training">
        <div className="empty">Upload a dataset first.</div>
      </Panel>
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
    if (dataset === undefined) return;
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
      void navigate(`/admin/training/jobs/${job.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  };

  return (
    <Panel title="Start training">
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Dataset</span>
          <select value={dataset?.id} onChange={(event) => setDatasetId(Number(event.target.value))}>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.trainImages} images)
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Start from</span>
          <select value={chosenBase} onChange={(event) => setBase(event.target.value)}>
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
        <div className="field-row">
          <label className="field">
            <span>Epochs</span>
            <input type="number" min={1} max={500} value={epochs} onChange={(event) => setEpochs(Number(event.target.value))} required />
          </label>
          <label className="field">
            <span>Image size</span>
            <select value={imageSize} onChange={(event) => setImageSize(Number(event.target.value))}>
              {IMAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Batch</span>
            <input type="number" min={1} max={128} value={batch} onChange={(event) => setBatch(Number(event.target.value))} required />
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={useFalseAlarms} onChange={(event) => setUseFalseAlarms(event.target.checked)} />
          <span>
            Learn from false alarms: frames of the {falseAlarms} incident{falseAlarms === 1 ? "" : "s"} admins declined
          </span>
        </label>
        <label className={`checkbox-row${canUseConfirmed ? "" : " disabled"}`}>
          <input
            type="checkbox"
            checked={useConfirmed && canUseConfirmed}
            onChange={(event) => setUseConfirmed(event.target.checked)}
            disabled={!canUseConfirmed}
          />
          <span>
            Add the {confirmed} confirmed accident{confirmed === 1 ? "" : "s"}, boxes drawn by the active model
            {!canUseConfirmed && " (needs a dataset with an accident class)"}
          </span>
        </label>
        {error && <div className="notice error">{error}</div>}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Starting…" : "Start training"}
        </button>
      </form>
    </Panel>
  );
}

function JobsPanel({ jobs, error }: { jobs: TrainingJob[] | undefined; error: string | null }) {
  const navigate = useNavigate();
  return (
    <Panel title="Training jobs">
      <DataState error={error} loading={jobs === undefined} empty={jobs?.length === 0 ? "No training job yet." : undefined} />
      {jobs && jobs.length > 0 && (
        <table className="table clickable">
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th>Dataset</th>
              <th>Started from</th>
              <th>Progress</th>
              <th>Best mAP50</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} onClick={() => void navigate(`/admin/training/jobs/${job.id}`)}>
                <td>
                  <Link to={`/admin/training/jobs/${job.id}`}>#{job.id}</Link>
                </td>
                <td>
                  <TrainingStatusBadge status={job.status} />
                </td>
                <td>{job.dataset.name}</td>
                <td>{job.baseName}</td>
                <td className="progress-cell">
                  <div className="progress small">
                    <span style={{ width: `${(job.currentEpoch / job.epochs) * 100}%` }} />
                  </div>
                  <span className="muted small">
                    {job.currentEpoch} / {job.epochs}
                  </span>
                </td>
                <td>{formatMetric(bestMap50(job))}</td>
                <td>{timeAgo(job.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
