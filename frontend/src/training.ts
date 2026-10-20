// Rules shared by the AI Training pages.
import { formatMetric } from "./format";
import type { AIModel, TrainingDataset } from "./types/api";

const ACCIDENT_CLASSES = ["accident", "crash", "collision"]; // as in ai/detector.py

export function hasAccidentClass(dataset: TrainingDataset): boolean {
  return dataset.detectorClasses.some((name) => ACCIDENT_CLASSES.includes(name.toLowerCase()));
}

/** Ask before switching the detector to `model`, warning when it scored below the active one. */
export function confirmActivation(model: AIModel, active: AIModel | undefined): boolean {
  let message = `Use "${model.name}" for accident detection? The detector picks it up when it next starts.`;
  if (active && model.map50 !== null && active.map50 !== null && model.map50 < active.map50) {
    message =
      `Warning: "${model.name}" scored ${formatMetric(model.map50)} mAP50, lower than the active model ` +
      `"${active.name}" (${formatMetric(active.map50)}). The scores come from different validation images, ` +
      `so compare them with care.\n\n${message}`;
  }
  return window.confirm(message);
}
