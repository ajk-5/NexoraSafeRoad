# Nexora SafeRoad — AI

The AI side of the platform, in two programs:

- **`ai.main` — the accident detector.** Reads a video file, a webcam or a stream, detects
  accidents with YOLO, confirms them over several frames, estimates the severity, records a clip
  around each accident and reports it to the backend.
- **`ai.trainer` — the training worker.** Runs on the GPU machine, takes the training jobs the super
  admin starts in the console, fine-tunes YOLO and sends back the new model.

The AI only reports what it saw. The backend suggests the services, and an admin confirms every
accident before anyone is alerted.

Back to the [main README](../README.md) · [backend](../backend/README.md) · [frontend](../frontend/README.md).

---

## Set up

From the repository root, in the same virtual environment as the backend:

```bash
pip install -r ai/requirements.txt     # ultralytics, opencv-python, numpy
python -m ai.download_models           # pretrained accident model -> ai/model/accident_model.pt
```

- For a GPU, install the CUDA build of PyTorch first (see pytorch.org); otherwise `pip` installs the
  CPU build through Ultralytics.
- The COCO object model (`yolo11n.pt`) is downloaded by Ultralytics on first use.
- Model files are not in git (`ai/model/*.pt`). Downloads are checked against a pinned sha256.

## Run the detector

```bash
# a video file, showing the detections in a window (press q to quit)
python -m ai.main --source dataset/videos/crash.mp4 --show

# a webcam, reporting to the backend
python -m ai.main --source 0 --backend http://localhost:8000

# a camera stream with its real position, on the first GPU
python -m ai.main --source rtsp://camera.local/stream --camera-id cam-07 --lat 48.8443 --lon 2.3740 --backend http://localhost:8000 --device 0
```

Without `--backend` the detector still runs and writes everything to `ai/output/`; with it, each
incident and its clip are also sent to the backend, where an admin reviews them.

### Options

| Option | Default | Meaning |
|---|---|---|
| `--source` | (required) | Video file, webcam index (`0`) or stream URL (RTSP/HTTP) |
| `--camera-id` | `cam-01` | Camera name shown to operators |
| `--lat`, `--lon` | `48.8566`, `2.3522` | Camera position (decimal degrees) |
| `--object-model` | `ai/model/yolo11n.pt` | COCO model counting vehicles and people |
| `--accident-model` | see below | Weights trained on accidents |
| `--accident-conf` | `0.25` | Minimum accident confidence in a frame |
| `--confirm-frames` | `5` | Consecutive frames needed to confirm an accident |
| `--clip-seconds` | `10` | Footage kept before **and** after the detection |
| `--cooldown` | `30` | Seconds before the same camera can report again |
| `--output` | `ai/output` | Folder for clips and incident JSON |
| `--backend` | none | Backend URL, e.g. `http://localhost:8000` |
| `--api-key` | `AI_API_KEY` from .env or environment | Must match the backend's `AI_API_KEY` |
| `--device` | auto | `0` for the first GPU, `cpu` to force the CPU |
| `--show` | off | Display the annotated video |

### Which accident model is used

1. `--accident-model`, when given.
2. Otherwise, with `--backend`: the model the super admin **activated** on the AI & Training Data
   page. It is downloaded once into `ai/model/trained/` and its sha256 is checked before loading
   (model files are pickles, which run code when loaded).
3. Otherwise `ai/model/accident_model.pt`.
4. With no accident model at all, a placeholder (overlapping vehicle boxes) stands in — expect
   false positives; a warning is logged.

## How a detection becomes an incident

```text
frame ─► object model (vehicles, people) ─┐
      └► accident model (accident, fire, overturned) ─► frame analysis
                                                           │
                         seen in --confirm-frames consecutive frames?
                                                           │ yes
                         severity rules ─► incident JSON ─► clip recording starts
                                                           │ --clip-seconds later
                         ai/output/<camera>_<time>.mp4 + .json ─► POST /api/incidents
                                                                 PUT  /api/incidents/{id}/video
```

- **Classes read** from the accident model: `accident`, `crash`, `collision`; `fire`;
  `overturned`, `rollover` (names compared in lower case). From the COCO model: `car`, `truck`,
  `bus`, `motorcycle`, `bicycle` (vehicles) and `person`.
- **Confirmation**: one frame is never enough; the accident must be seen in several consecutive
  frames, which removes most single-frame false positives.
- **Clips**: the recorder keeps a rolling buffer (JPEG-compressed in memory), so a clip starts
  `--clip-seconds` *before* the detection. Windows prefers `mp4v` to avoid requiring an external
  OpenH264 DLL. Other platforms try H.264 (`avc1`) first and fall back to `mp4v`.
  The selected codec is logged. MPEG-4 clips may need to be downloaded from the console to play.
- **Windows webcams**: DirectShow is tried first, then the default backend if opening fails.
  A failed webcam read triggers one reopen attempt; if it fails again, capture stops and any
  pending clips are saved. Video files still stop normally at end of file.
- **Reported fields**: camera, position, severity, confidence, vehicles, people, fire, overturned,
  detection time. The backend derives `possibleInjuries` and the suggested services from them.

### Severity

Fixed rules on what the detector counted (`ai/severity.py`), not a separate model:

| Severity | When |
|---|---|
| High | A vehicle fire, an overturned vehicle, 2+ people or 3+ vehicles |
| Medium | 2 vehicles, or 1 person |
| Low | Anything else |

The console shows which rule applied, and labels the severity as the AI's estimate.

## Run the training worker

```bash
python -m ai.trainer --backend http://localhost:8000            # add --device 0 for the first GPU
```

| Option | Default | Meaning |
|---|---|---|
| `--backend` | `http://localhost:8000` | Backend URL |
| `--api-key` | `AI_API_KEY` from .env or environment | Must match the backend's `AI_API_KEY` |
| `--device` | auto | `0` for the first GPU, `cpu` to force the CPU |
| `--name` | the computer's name | Worker name shown to the super admin |
| `--workers` | `2` | Data loader processes |
| `--work-dir` | `ai/training` | Temporary folder for datasets and runs |

What it does, in a loop:

1. Sends a heartbeat every 10 s (the console shows the worker online) and asks for a queued job
   every 5 s.
2. Downloads the job's dataset zip and extracts **only** images and labels, with a size limit, then
   writes its own `data.yaml` — never the uploaded one, because Ultralytics executes a yaml's
   `download:` field.
3. Adds operator feedback when the job asks for it: 6 frames from each **rejected** incident clip
   as background images (false alarms the model should stop raising), and optionally from each
   **confirmed** accident, labelled with boxes drawn by the active model.
4. Fine-tunes the chosen base (a registered model or a stock YOLO11 checkpoint) with Ultralytics,
   reporting metrics and the log after every epoch, and stops after the current epoch if the job
   is cancelled.
5. Uploads `best.pt`, which the backend registers as a new model. It is never activated
   automatically: the super admin compares it with the others and decides.

## Tests

```bash
python -m unittest discover -s ai/tests -t .     # 22 tests, no GPU or model files needed
```

## Files

```text
ai/
├── main.py              the detector (entry point)
├── camera.py            video files, webcams and streams
├── detector.py          YOLO inference per frame, confirmation over frames, placeholder heuristic
├── severity.py          severity rules
├── clip_recorder.py     rolling buffer and clip writing
├── alerts.py            incident logging and delivery to the backend
├── backend_client.py    HTTP calls to the backend with the API key
├── model_store.py       downloads and verifies the backend's active model
├── download_models.py   downloads the pretrained models (pinned sha256)
├── trainer.py           the training worker (entry point)
├── requirements.txt
├── model/               weights (not in git)
├── output/              clips and incident JSON (not in git)
└── tests/
```

The pretrained accident model is [Enos-123/traffic-accident-detection-yolo11x](https://huggingface.co/Enos-123/traffic-accident-detection-yolo11x) (MIT license).
