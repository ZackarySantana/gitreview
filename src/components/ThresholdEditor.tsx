import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatThreshold } from '../domain/zones';
import type { Settings } from '../types';

const MIN_HOURS = 1;
const MAX_HOURS = 2160;
const MIN_GAP = 1;

interface ThresholdEditorProps {
  onChange: (thresholds: Settings['thresholds']) => void;
  value: Settings['thresholds'];
}

function hoursToPercent(hours: number): number {
  if (hours <= 48) return (hours / 48) * 45;
  if (hours <= 336) return 45 + ((hours - 48) / 288) * 35;
  return 80 + ((hours - 336) / (MAX_HOURS - 336)) * 20;
}

function percentToHours(percent: number): number {
  if (percent <= 45) return Math.round((percent / 45) * 48);
  if (percent <= 80) return Math.round(48 + ((percent - 45) / 35) * 288);
  return Math.round(336 + ((percent - 80) / 20) * (MAX_HOURS - 336));
}

function formatSliderValue(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  if (remainingHours === 0) return formatThreshold(hours);
  return `${days} ${days === 1 ? 'day' : 'days'} ${remainingHours} hours`;
}

export function ThresholdEditor({ onChange, value }: ThresholdEditorProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function legalRange(index: number): [number, number] {
    return [
      index === 0 ? MIN_HOURS : value[index - 1]! + MIN_GAP,
      index === 2 ? MAX_HOURS : value[index + 1]! - MIN_GAP,
    ];
  }

  function updateBoundary(index: number, nextValue: number) {
    const [minimum, maximum] = legalRange(index);
    const clamped = Math.min(maximum, Math.max(minimum, Math.round(nextValue)));
    const next: Settings['thresholds'] = [...value];
    next[index] = clamped;
    setError(null);
    onChange(next);
  }

  function updateFromPointer(index: number, event: PointerEvent<HTMLElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    updateBoundary(index, percentToHours(Math.min(100, Math.max(0, percent))));
  }

  function handlePointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    draggingRef.current = index;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(index, event);
  }

  function handlePointerMove(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (draggingRef.current === index) updateFromPointer(index, event);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const current = value[index]!;
    const step = current < 24 ? 1 : 6;
    const [minimum, maximum] = legalRange(index);
    let next: number | null = null;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - step;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + step;
    if (event.key === 'PageDown') next = current - 24;
    if (event.key === 'PageUp') next = current + 24;
    if (event.key === 'Home') next = minimum;
    if (event.key === 'End') next = maximum;
    if (next === null) return;

    event.preventDefault();
    updateBoundary(index, next);
  }

  function handleTimePartChange(index: number, part: 'days' | 'hours', rawValue: string) {
    const numeric = Number(rawValue);
    const current = value[index]!;
    const days = part === 'days' ? numeric : Math.floor(current / 24);
    const hours = part === 'hours' ? numeric : current % 24;
    if (
      !Number.isInteger(numeric) ||
      days < 0 ||
      hours < 0 ||
      hours > 23
    ) {
      setError('Use whole days and 0 to 23 hours.');
      return;
    }
    const totalHours = days * 24 + hours;
    const [minimum, maximum] = legalRange(index);
    if (totalHours < minimum || totalHours > maximum) {
      setError(`Boundary ${index + 1} must be between ${formatThreshold(minimum)} and ${formatThreshold(maximum)}.`);
      return;
    }
    updateBoundary(index, totalHours);
  }

  const positions = value.map(hoursToPercent);
  const names = ['New to waiting', 'Waiting to aging', 'Aging to overdue'];

  return (
    <div className="threshold-editor">
      <div className="threshold-heading">
        <div>
          <h3>Age boundaries</h3>
          <p>Drag the pins or enter exact values. Zones update before you apply.</p>
        </div>
        <button className="text-button" onClick={() => onChange([24, 48, 168])} type="button">
          Reset
        </button>
      </div>

      <div className="threshold-track-wrap">
        <div className="threshold-track" ref={trackRef}>
          <span className="track-segment zone-new" style={{ left: 0, width: `${positions[0]}%` }} />
          <span
            className="track-segment zone-recent"
            style={{ left: `${positions[0]}%`, width: `${positions[1]! - positions[0]!}%` }}
          />
          <span
            className="track-segment zone-aging"
            style={{ left: `${positions[1]}%`, width: `${positions[2]! - positions[1]!}%` }}
          />
          <span className="track-segment zone-overdue" style={{ left: `${positions[2]}%`, right: 0 }} />
          {value.map((hours, index) => {
            const [minimum, maximum] = legalRange(index);
            return (
              <button
                aria-label={names[index]}
                aria-valuemax={maximum}
                aria-valuemin={minimum}
                aria-valuenow={hours}
                aria-valuetext={formatSliderValue(hours)}
                className="threshold-pin"
                key={names[index]}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPointerCancel={() => { draggingRef.current = null; }}
                onPointerDown={(event) => handlePointerDown(index, event)}
                onPointerMove={(event) => handlePointerMove(index, event)}
                onPointerUp={() => { draggingRef.current = null; }}
                role="slider"
                style={{ left: `${positions[index]}%` }}
                type="button"
              >
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="threshold-ticks">
          <span style={{ left: `${hoursToPercent(24)}%` }}>1d</span>
          <span style={{ left: `${hoursToPercent(48)}%` }}>2d</span>
          <span style={{ left: `${hoursToPercent(168)}%` }}>7d</span>
          <span style={{ left: `${hoursToPercent(720)}%` }}>30d</span>
          <span style={{ left: '100%' }}>90d</span>
        </div>
      </div>

      <div className="threshold-inputs">
        {value.map((hours, index) => (
          <fieldset className="threshold-input-group" key={names[index]}>
            <legend>{names[index]}</legend>
            <div>
              <label>
                <span>Days</span>
                <input
                  aria-invalid={error !== null}
                  aria-label={`${names[index]} days`}
                  min={0}
                  onChange={(event) => handleTimePartChange(index, 'days', event.target.value)}
                  step={1}
                  type="number"
                  value={Math.floor(hours / 24)}
                />
              </label>
              <label>
                <span>Hours</span>
                <input
                  aria-invalid={error !== null}
                  aria-label={`${names[index]} hours`}
                  max={23}
                  min={0}
                  onChange={(event) => handleTimePartChange(index, 'hours', event.target.value)}
                  step={1}
                  type="number"
                  value={hours % 24}
                />
              </label>
            </div>
          </fieldset>
        ))}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
