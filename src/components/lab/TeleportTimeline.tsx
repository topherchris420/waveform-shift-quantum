import React from 'react';
import type { TeleportStep } from './TeleportationCircuit';
import type { BellRecord } from './EntanglementOverlay';

interface TeleportTimelineProps {
  events: BellRecord[];
  selectedEventId: number | null;
  onSelectEvent: (id: number | null) => void;
  scrubStep: TeleportStep;
  onScrubStep: (s: TeleportStep) => void;
  isLive: boolean;
  onGoLive: () => void;
  liveStep: TeleportStep;
}

const STEP_LABELS: Record<Exclude<TeleportStep, 0>, string> = {
  1: 'Bell prep',
  2: 'Entangle',
  3: 'Measurement',
  4: 'Correction',
};

export const TeleportTimeline: React.FC<TeleportTimelineProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  scrubStep,
  onScrubStep,
  isLive,
  onGoLive,
  liveStep,
}) => {
  const teleportEvents = events.filter((e) => e.mode === 'teleportation').slice(-24);
  const hasEvents = teleportEvents.length > 0;
  const minT = hasEvents ? teleportEvents[0].t : 0;
  const maxT = hasEvents ? Math.max(teleportEvents[teleportEvents.length - 1].t, minT + 1) : 1;

  const selected =
    teleportEvents.find((e) => e.id === selectedEventId) ??
    (teleportEvents.length ? teleportEvents[teleportEvents.length - 1] : undefined);

  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between">
        <p className="section-eyebrow">Event timeline</p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${
              isLive
                ? 'border-lime/40 bg-lime/[0.14] text-lime-foreground'
                : 'border-copper/40 bg-copper/[0.12] text-copper'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-lime animate-pulse' : 'bg-copper'}`}
              aria-hidden
            />
            {isLive ? 'live' : 'scrubbing'}
          </span>
          {!isLive && (
            <button
              type="button"
              onClick={onGoLive}
              className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            >
              Go live
            </button>
          )}
        </div>
      </div>

      {/* Event dots */}
      <div className="relative mt-3 h-10 rounded border border-white/5 bg-white/[0.02] px-2">
        <div
          aria-hidden
          className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2"
          style={{ background: 'hsl(var(--primary) / 0.3)' }}
        />
        {!hasEvents && (
          <p className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-muted-foreground">
            Run the teleportation protocol to record events.
          </p>
        )}
        {teleportEvents.map((e) => {
          const pct = maxT === minT ? 100 : ((e.t - minT) / (maxT - minT)) * 100;
          const active = selected?.id === e.id && !isLive;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEvent(e.id)}
              aria-label={`Teleportation event bits ${e.bits[0]}${e.bits[1]} at t=${e.t.toFixed(2)}`}
              aria-pressed={active}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-110"
              style={{ left: `calc(${pct}% + 0.5rem - ${pct * 0.01}rem)` }}
            >
              <span
                className={`block h-3 w-3 rounded-full border transition-all ${
                  active
                    ? 'border-primary bg-primary shadow-[0_0_12px_hsl(var(--primary))]'
                    : 'border-white/40 bg-white/10 group-hover:border-primary/70'
                }`}
              />
              <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 font-mono text-[8.5px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {e.bits[0]}
                {e.bits[1]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step scrubber */}
      <div className="mt-3">
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>Protocol step</span>
          <span>
            {isLive
              ? `live · step ${liveStep || 0}/4`
              : selected
              ? `event t=${selected.t.toFixed(2)} · step ${scrubStep}/4`
              : `step ${scrubStep}/4`}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {([1, 2, 3, 4] as const).map((s) => {
            const currentStep = isLive ? liveStep : scrubStep;
            const reached = currentStep >= s;
            const active = currentStep === s;
            const disabled = isLive || !hasEvents;
            return (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onScrubStep(s)}
                aria-pressed={active}
                className={`rounded border px-1.5 py-1.5 text-left transition-all ${
                  active
                    ? 'border-primary/70 bg-primary/[0.14] shadow-[0_0_14px_hsl(var(--primary)/0.35)]'
                    : reached
                    ? 'border-lime/40 bg-lime/[0.08]'
                    : 'border-white/10 bg-white/[0.02]'
                } ${disabled ? 'cursor-not-allowed opacity-70' : 'hover:border-primary/50'}`}
              >
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  step {s}
                </p>
                <p
                  className="mt-0.5 font-mono text-[10.5px]"
                  style={{
                    color: active ? 'hsl(var(--primary))' : reached ? 'hsl(var(--lime))' : 'hsl(var(--foreground) / 0.6)',
                  }}
                >
                  {STEP_LABELS[s]}
                </p>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-2 flex items-center justify-between rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[10.5px]">
            <span className="text-muted-foreground">
              m₁m₂ = <span className="text-foreground">{selected.bits[0]}{selected.bits[1]}</span>
            </span>
            <span className="text-muted-foreground">
              F = <span className="text-foreground">{selected.fidelity.toFixed(3)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};