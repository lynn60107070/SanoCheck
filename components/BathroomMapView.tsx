'use client';

import { Bathroom, ZoneCoverageItem, CoverageStatus } from '@/lib/types';

/** Map marker color by bathroom status (Supabase status). */
export function getStatusColor(status: Bathroom['status']): string {
  switch (status) {
    case 'verified_usable':
      return '#22c55e';
    case 'flagged':
      return '#f59e0b';
    case 'verified_unusable':
      return '#ef4444';
    default:
      return '#9ca3af';
  }
}

export function getStatusLabel(status: Bathroom['status']): string {
  switch (status) {
    case 'verified_usable':
      return 'Usable';
    case 'flagged':
      return 'Flagged';
    case 'verified_unusable':
      return 'Not usable';
    default:
      return status || 'Unknown';
  }
}

/** Zone coverage background: adequate = green, strained = yellow, critical = red */
export function getCoverageFillStroke(status: CoverageStatus): { fill: string; stroke: string; labelFill: string } {
  switch (status) {
    case 'adequate':
      return { fill: '#dcfce7', stroke: '#22c55e', labelFill: '#166534' };
    case 'strained':
      return { fill: '#fef9c3', stroke: '#eab308', labelFill: '#854d0e' };
    case 'critical':
      return { fill: '#fee2e2', stroke: '#ef4444', labelFill: '#991b1b' };
    default:
      return { fill: '#f1f5f9', stroke: '#94a3b8', labelFill: '#475569' };
  }
}

interface BathroomMapViewProps {
  bathrooms: Bathroom[];
  showLabels?: boolean;
  compact?: boolean;
  /** When provided (e.g. admin), zone background reflects coverage; show coverage legend */
  zoneCoverage?: ZoneCoverageItem[];
}

/** Zone corner positions (percent): A=top-left, B=top-right, C=bottom-left, D=bottom-right */
const ZONE_CORNERS: Record<string, { cx: number; cy: number; labelY: number }> = {
  A: { cx: 22, cy: 22, labelY: 8 },
  B: { cx: 78, cy: 22, labelY: 8 },
  C: { cx: 22, cy: 78, labelY: 92 },
  D: { cx: 78, cy: 78, labelY: 92 },
};

/**
 * Demo map: one map with 4 corners = zones A, B, C, D. Toilet circles in each corner.
 * If zoneCoverage is provided, zone background color reflects coverage (adequate/strained/critical).
 */
export default function BathroomMapView({
  bathrooms,
  showLabels = true,
  zoneCoverage,
}: BathroomMapViewProps) {
  const zones = ['A', 'B', 'C', 'D'] as const;
  const byZone = new Map<string, Bathroom[]>();
  zones.forEach((z) => byZone.set(z, bathrooms.filter((b) => b.zone === z)));
  const coverageByZone = new Map<string, ZoneCoverageItem>();
  zoneCoverage?.forEach((z) => coverageByZone.set(z.zone, z));

  // Position circles in a small cluster around the zone corner so they don't overlap
  function getCirclePosition(zone: string, index: number, total: number): { cx: number; cy: number } {
    const base = ZONE_CORNERS[zone] ?? ZONE_CORNERS.A;
    if (total <= 1) return { cx: base.cx, cy: base.cy };
    const spread = 6;
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const offsetX = (col - (cols - 1) / 2) * spread;
    const offsetY = (row - (Math.ceil(total / cols) - 1) / 2) * spread;
    return { cx: base.cx + offsetX, cy: base.cy + offsetY };
  }

  const showCoverageLegend = zoneCoverage != null && zoneCoverage.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4">
        <span className="font-semibold text-gray-900">Toilet status</span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full border-2 border-green-700" style={{ backgroundColor: '#22c55e' }} />
          Usable
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full border-2 border-amber-600" style={{ backgroundColor: '#f59e0b' }} />
          Flagged
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="w-3 h-3 rounded-full border-2 border-red-700" style={{ backgroundColor: '#ef4444' }} />
          Not usable
        </span>
        {showCoverageLegend && (
          <>
            <span className="text-gray-400">|</span>
            <span className="font-semibold text-gray-900">Zone coverage</span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-3 h-3 rounded border border-green-600" style={{ backgroundColor: '#dcfce7' }} />
              Adequate
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-3 h-3 rounded border border-yellow-600" style={{ backgroundColor: '#fef9c3' }} />
              Strained
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-3 h-3 rounded border border-red-600" style={{ backgroundColor: '#fee2e2' }} />
              Critical Gap
            </span>
          </>
        )}
      </div>
      <div className="p-2 sm:p-4">
        <svg
          viewBox="0 0 100 100"
          className="w-full max-w-2xl mx-auto block"
          style={{ aspectRatio: '1', minHeight: '280px' }}
          aria-label="Demo map: toilets by zone (A, B, C, D)"
        >
          {/* Map background: subtle "ground" and paths between zones */}
          <defs>
            <pattern id="mapDots" patternUnits="userSpaceOnUse" width="4" height="4">
              <circle cx="2" cy="2" r="0.5" fill="#e5e7eb" />
            </pattern>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.15" />
            </filter>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="#f8fafc" />
          <rect x="0" y="0" width="100" height="100" fill="url(#mapDots)" opacity="0.5" />
          {/* Central "paths" / cross */}
          <path d="M 50 5 L 50 95 M 5 50 L 95 50" stroke="#e2e8f0" strokeWidth="1.2" fill="none" strokeDasharray="2 1.5" />
          {/* Zone ellipses: background color by zone coverage when zoneCoverage provided */}
          {zones.map((zone) => {
            const cov = coverageByZone.get(zone);
            const { fill, stroke, labelFill } = getCoverageFillStroke(cov?.coverageStatus ?? 'adequate');
            const pos = ZONE_CORNERS[zone];
            return (
              <g key={zone}>
                <ellipse cx={pos.cx} cy={pos.cy} rx={18} ry={18} fill={fill} fillOpacity="0.85" stroke={stroke} strokeWidth="0.8" strokeDasharray="2 1" />
                <text x={pos.cx} y={pos.labelY} textAnchor="middle" fontSize="5" fontWeight="bold" fill={labelFill}>Zone {zone}</text>
              </g>
            );
          })}
          {/* Toilet circles in each zone corner */}
          {zones.map((zone) => {
            const list = byZone.get(zone) ?? [];
            return list.map((b, i) => {
              const { cx, cy } = getCirclePosition(zone, i, list.length);
              const r = 3.2;
              return (
                <g key={b.id} filter="url(#shadow)">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={getStatusColor(b.status)}
                    stroke={b.status === 'verified_usable' ? '#15803d' : b.status === 'flagged' ? '#b45309' : '#b91c1c'}
                    strokeWidth="0.8"
                  />
                  {showLabels && (
                    <text
                      x={cx}
                      y={cy + 0.9}
                      textAnchor="middle"
                      fontSize="2.6"
                      fill="white"
                      fontWeight="bold"
                    >
                      {b.id.replace('-', '')}
                    </text>
                  )}
                  <title>
                    {b.id} — {getStatusLabel(b.status)}
                    {b.location ? ` (${b.location})` : ''}
                  </title>
                </g>
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}
