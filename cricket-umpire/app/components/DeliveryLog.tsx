'use client';

import { Delivery } from '../lib/types';

interface DeliveryLogProps {
  deliveries: Delivery[];
  totalOvers: number;
}

function getDeliveryColor(delivery: Delivery): string {
  if (delivery.isWicket) return 'bg-red-600 text-white ring-2 ring-red-400';
  if (delivery.isWide) return 'bg-yellow-500/90 text-black';
  if (delivery.isNoBall) return 'bg-orange-500 text-black';
  if (delivery.isBye || delivery.isLegBye) return 'bg-purple-600 text-white';
  if (delivery.runs === 4) return 'bg-sky-500 text-white';
  if (delivery.runs === 6) return 'bg-emerald-500 text-white ring-2 ring-emerald-300';
  if (delivery.isDot) return 'bg-slate-600 text-slate-300';
  return 'bg-slate-500 text-white';
}

function groupDeliveriesByOver(deliveries: Delivery[]): Map<number, Delivery[]> {
  const groups = new Map<number, Delivery[]>();
  for (const d of deliveries) {
    const existing = groups.get(d.overNumber) || [];
    existing.push(d);
    groups.set(d.overNumber, existing);
  }
  return groups;
}

export default function DeliveryLog({ deliveries, totalOvers }: DeliveryLogProps) {
  if (deliveries.length === 0) {
    return (
      <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Delivery Log
        </h3>
        <p className="text-slate-600 text-center py-6 text-base">
          No deliveries yet. Start scoring!
        </p>
      </div>
    );
  }

  const grouped = groupDeliveriesByOver(deliveries);
  const overEntries = Array.from(grouped.entries()).reverse(); // most recent first

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Delivery Log
      </h3>
      <div className="space-y-3 max-h-60 overflow-y-auto scrollbar-thin">
        {overEntries.map(([overNum, overs]) => {
          const overRuns = overs.reduce((sum, d) => sum + d.totalRuns, 0);
          return (
            <div key={overNum} className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 w-12 shrink-0 tabular-nums">
                Ov {overNum + 1}
              </span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {overs.map((d, i) => (
                  <span
                    key={`${overNum}-${i}`}
                    className={`inline-flex items-center justify-center min-w-[2.5rem] h-10 rounded-lg text-sm font-bold px-1.5 transition-all ${getDeliveryColor(d)}`}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-400 tabular-nums w-8 text-right">
                {overRuns}r
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
