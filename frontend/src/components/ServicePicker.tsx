import { stationDistance } from "../format";
import { SERVICE_LABELS, SERVICES } from "../labels";
import type { ServiceType, Station, SuggestedService } from "../types/api";

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

/** The AI's suggestion, which the admin can change before sending (README "Human Validation"),
 * with the station each service would respond from. */
export function ServicePicker({ suggested, selected, onChange, nearby, chosen, onChooseStation, disabled }: Props) {
  const reasons = new Map(suggested.map((s) => [s.service, s.reason]));
  const toggle = (service: ServiceType) =>
    onChange(
      selected.includes(service)
        ? selected.filter((s) => s !== service)
        : SERVICES.filter((s) => s === service || selected.includes(s)),
    );

  return (
    <div className="service-picker">
      {SERVICES.map((service) => {
        const reason = reasons.get(service);
        const checked = selected.includes(service);
        return (
          <div key={service} className={`service-option${checked ? " checked" : ""}`}>
            <label className="service-check">
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(service)} />
              <span className="service-name">{SERVICE_LABELS[service]}</span>
              {reason ? (
                <span className="service-reason">
                  <span className="ai-tag">AI</span> {reason}
                </span>
              ) : (
                <span className="service-reason muted">Not suggested</span>
              )}
            </label>
            {checked && nearby && (
              <StationChoice
                service={service}
                options={nearby[service] ?? []}
                chosen={chosen[service]}
                onChoose={(id) => onChooseStation(service, id)}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
      {!disabled && (
        <button type="button" className="button ghost small" onClick={() => onChange([...SERVICES])}>
          Select all
        </button>
      )}
    </div>
  );
}

interface StationChoiceProps {
  service: ServiceType;
  options: Station[];
  chosen: Station | undefined;
  onChoose: (stationId: string) => void;
  disabled: boolean;
}

function StationChoice({ service, options, chosen, onChoose, disabled }: StationChoiceProps) {
  if (chosen === undefined) return <div className="station-choice muted">No {SERVICE_LABELS[service]} station on record.</div>;
  return (
    <div className="station-choice">
      <span className="station-label">{options[0]?.id === chosen.id ? "Nearest station" : "Responding station"}</span>
      {disabled || options.length < 2 ? (
        <strong className="station-name">{chosen.name}</strong>
      ) : (
        <select
          value={chosen.id}
          onChange={(event) => onChoose(event.target.value)}
          aria-label={`${SERVICE_LABELS[service]} station`}
        >
          {options.map((station, index) => (
            <option key={station.id} value={station.id}>
              {station.name} ({stationDistance(station)}){index === 0 ? " · nearest" : ""}
            </option>
          ))}
        </select>
      )}
      <span className="station-meta">
        {stationDistance(chosen)}
        {chosen.address && ` · ${chosen.address}`}
      </span>
    </div>
  );
}
