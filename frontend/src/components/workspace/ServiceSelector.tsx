import { useId } from "react";

import { formatDistance, stationDistance } from "../../format";
import { SERVICE_LABELS, SERVICES } from "../../labels";
import type { ServiceType, Station, SuggestedService } from "../../types/api";
import { AiTag } from "../Badges";
import { Icon } from "../Icon";

interface Props {
  suggested: SuggestedService[];
  selected: ServiceType[];
  onChange: (services: ServiceType[]) => void;
  /** Each service's nearest stations, nearest first; undefined while loading. */
  nearby: Partial<Record<ServiceType, Station[]>> | undefined;
  /** The station that will respond for each selected service. */
  chosen: Partial<Record<ServiceType, Station>>;
  onChooseStation: (service: ServiceType, stationId: string) => void;
  disabled: boolean;
}

/** The AI's recommendation, which the admin reviews and changes before sending the alert. */
export function ServiceSelector({ suggested, selected, onChange, nearby, chosen, onChooseStation, disabled }: Props) {
  const reasons = new Map(suggested.map((s) => [s.service, s.reason]));
  const aiChoice = SERVICES.filter((s) => reasons.has(s));
  const changed = aiChoice.length !== selected.length || aiChoice.some((s) => !selected.includes(s));
  const toggle = (service: ServiceType) =>
    onChange(
      selected.includes(service) ? selected.filter((s) => s !== service) : SERVICES.filter((s) => s === service || selected.includes(s)),
    );

  return (
    <fieldset className="service-selector" disabled={disabled}>
      <legend className="visually-hidden">Services to alert</legend>
      {SERVICES.map((service) => (
        <ServiceRow
          key={service}
          service={service}
          reason={reasons.get(service)}
          checked={selected.includes(service)}
          onToggle={() => toggle(service)}
          options={nearby?.[service]}
          loadingStations={nearby === undefined}
          chosen={chosen[service]}
          onChoose={(id) => onChooseStation(service, id)}
        />
      ))}
      {changed && !disabled && (
        <button type="button" className="btn btn-ghost btn-sm reset-ai" onClick={() => onChange(aiChoice)}>
          <Icon name="replay" size="sm" />
          Back to the AI recommendation
        </button>
      )}
    </fieldset>
  );
}

interface RowProps {
  service: ServiceType;
  reason: string | undefined;
  checked: boolean;
  onToggle: () => void;
  options: Station[] | undefined;
  loadingStations: boolean;
  chosen: Station | undefined;
  onChoose: (stationId: string) => void;
}

function ServiceRow({ service, reason, checked, onToggle, options, loadingStations, chosen, onChoose }: RowProps) {
  const reasonId = useId();
  return (
    <div className={`service-row${checked ? " checked" : ""}`}>
      <label className="service-check">
        <input type="checkbox" checked={checked} onChange={onToggle} aria-describedby={reasonId} />
        <span className="service-text">
          <span className="service-name">
            {SERVICE_LABELS[service]}
            {reason && <AiTag>AI suggested</AiTag>}
          </span>
          <span className="service-reason" id={reasonId}>
            {reason ?? "Not suggested by the AI. Add it if the clip shows it is needed."}
          </span>
        </span>
      </label>
      {checked && (
        <div className="station-choice">
          {loadingStations ? (
            <span className="small muted">Finding the nearest stations…</span>
          ) : chosen === undefined ? (
            <span className="small muted">No station on record: the alert goes to the service without one.</span>
          ) : (options?.length ?? 0) < 2 ? (
            <span className="small">
              <span className="muted">Station: </span>
              <strong>{chosen.name}</strong> · {stationDistance(chosen)}
            </span>
          ) : (
            <label className="station-select">
              <span className="small muted">Responding station</span>
              <select className="select input-sm" value={chosen.id} onChange={(event) => onChoose(event.target.value)}>
                {options?.map((station, index) => (
                  <option key={station.id} value={station.id}>
                    {station.name} · {formatDistance(station.distanceM)}
                    {index === 0 ? " (nearest)" : ""}
                  </option>
                ))}
              </select>
              <span className="station-meta">
                ~{chosen.etaMinutes} min drive (estimate){chosen.address ? ` · ${chosen.address}` : ""}
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
