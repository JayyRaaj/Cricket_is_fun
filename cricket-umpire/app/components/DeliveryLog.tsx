'use client';

import { Delivery } from '../lib/types';

interface DeliveryLogProps {
  deliveries: Delivery[];
  totalOvers: number;
}

function getDeliveryColor(delivery: Delivery): string {
  if (delivery.isWicket) return 'delivery-chip wicket';
  if (delivery.isWide) return 'delivery-chip wide';
  if (delivery.isNoBall) return 'delivery-chip noball';
  if (delivery.isBye || delivery.isLegBye) return 'delivery-chip bye';
  if (delivery.runs === 4) return 'delivery-chip four';
  if (delivery.runs === 6) return 'delivery-chip six';
  if (delivery.isDot) return 'delivery-chip dot';
  return 'delivery-chip runs';
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
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-card)',
          padding: 16,
        }}
      >
        <h3 className="label-caps" style={{ marginBottom: 8 }}>
          Delivery Log
        </h3>
        <p
          style={{
            color: 'var(--text-secondary)',
            textAlign: 'center',
            padding: '24px 0',
            fontSize: 15,
            margin: 0,
          }}
        >
          No deliveries yet
        </p>
      </div>
    );
  }

  const grouped = groupDeliveriesByOver(deliveries);
  const overEntries = Array.from(grouped.entries()).reverse(); // most recent first

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
      }}
    >
      <h3 className="label-caps" style={{ marginBottom: 16 }}>
        This Over
      </h3>
      <div
        style={{
          maxHeight: 200,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {overEntries.map(([overNum, overs]) => {
          const overRuns = overs.reduce((sum, d) => sum + d.totalRuns, 0);
          return (
            <div
              key={overNum}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  width: 40,
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Ov {overNum + 1}
              </span>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  flex: 1,
                }}
              >
                {overs.map((d, i) => (
                  <span
                    key={`${overNum}-${i}`}
                    className={getDeliveryColor(d)}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  width: 32,
                  textAlign: 'right' as const,
                  flexShrink: 0,
                }}
              >
                {overRuns}r
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
