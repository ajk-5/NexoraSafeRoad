// Rules shared by the AI & Training Data pages.
import { formatMetric } from "./format";
import type { AIModel, TrainingDataset } from "./types/api";

const ACCIDENT_CLASSES = ["accident", "crash", "collision"]; // as in ai/detector.py

export function hasAccidentClass(dataset: TrainingDataset): boolean {
  return dataset.detectorClasses.some((name) => ACCIDENT_CLASSES.includes(name.toLowerCase()));
}

/** A warning to show before activating `model` when it scored below the active one, else null. */
export function activationWarning(model: AIModel, active: AIModel | undefined): string | null {
  if (!active || model.map50 === null || active.map50 === null || model.map50 >= active.map50) return null;
  return (
    `"${model.name}" scored ${formatMetric(model.map50)} mAP50, lower than the active model "${active.name}" ` +
    `(${formatMetric(active.map50)}). The scores come from different validation images, so compare them with care.`
  );
}

/** Dataset uploads: a YOLO-format zip. The server checks the content and its own size limit. */
export function datasetFileProblem(file: File): string | null {
  const isZip = /\.zip$/i.test(file.name) || ["application/zip", "application/x-zip-compressed"].includes(file.type);
  if (!isZip) return `"${file.name}" is not a .zip file. Export the dataset as a YOLO zip (data.yaml with train/ and valid/).`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}
