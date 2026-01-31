/**
 * Simple scoring: only volunteer verification and resident flagging.
 *
 * - Volunteer verifies usable → score 3, status verified_usable
 * - Volunteer verifies unusable → score 0, status verified_unusable
 * - Resident flags as not usable → score 2, status flagged
 * - No time decay, no sensor-based adjustments.
 */

import { Bathroom, BathroomStatus, VolunteerVerification, ResidentSignal, SensorReading } from './types';

export interface ScoreResult {
  healthScore: number; // 0, 2, or 3
  status: BathroomStatus;
  priorityFlags: string[];
  explanation: {
    baseScore: number;
    adjustments: Array<{ reason: string; value: number }>;
    finalScore: number;
    status: string;
  };
}

/**
 * Score from only: volunteer verification (3 or 0) or resident flag (2).
 * Sensor readings and time decay are ignored.
 */
export function calculateBathroomScore(
  _bathroom: Bathroom,
  latestVerification: VolunteerVerification | null,
  recentSignals: ResidentSignal[],
  _sensorReadings: SensorReading[]
): ScoreResult {
  const adjustments: Array<{ reason: string; value: number }> = [];
  const priorityFlags: string[] = [];

  // 1. Volunteer verification wins
  if (latestVerification) {
    const isUnusable =
      latestVerification.usable === false || latestVerification.waterAvailable === false;
    if (isUnusable) {
      return {
        healthScore: 0,
        status: 'verified_unusable',
        priorityFlags: ['volunteer_marked_unusable'],
        explanation: {
          baseScore: 3,
          adjustments: [{ reason: 'Volunteer marked unusable', value: -3 }],
          finalScore: 0,
          status: 'verified_unusable',
        },
      };
    }
    // Volunteer marked usable
    return {
      healthScore: 3,
      status: 'verified_usable',
      priorityFlags: [],
      explanation: {
        baseScore: 3,
        adjustments: [{ reason: 'Volunteer verified usable', value: 0 }],
        finalScore: 3,
        status: 'verified_usable',
      },
    };
  }

  // 2. Resident flagged (no volunteer verification)
  const hasResidentFlag = recentSignals.some((s) => s.signal === 'unusable');
  if (hasResidentFlag) {
    return {
      healthScore: 2,
      status: 'flagged',
      priorityFlags: ['resident_flagged'],
      explanation: {
        baseScore: 3,
        adjustments: [{ reason: 'Resident flagged as not usable', value: -1 }],
        finalScore: 2,
        status: 'flagged',
      },
    };
  }

  // 3. Default: needs check → score 2, flagged
  return {
    healthScore: 2,
    status: 'flagged',
    priorityFlags: [],
    explanation: {
      baseScore: 3,
      adjustments: [{ reason: 'No recent verification', value: -1 }],
      finalScore: 2,
      status: 'flagged',
    },
  };
}

/**
 * Rank bathrooms for volunteer inspection: lower score first, then by last check.
 */
export function rankBathroomsForInspection(
  bathrooms: Bathroom[],
  _verifications: Map<string, VolunteerVerification>,
  signals: Map<string, ResidentSignal[]>,
  _sensorReadings: Map<string, SensorReading[]>
): Bathroom[] {
  return [...bathrooms].sort((a, b) => {
    const scoreDiff = a.score - b.score;
    if (scoreDiff !== 0) return scoreDiff;
    const aSignals = signals.get(a.id) || [];
    const bSignals = signals.get(b.id) || [];
    const aRecent = aSignals.filter((s) => s.signal === 'unusable').length;
    const bRecent = bSignals.filter((s) => s.signal === 'unusable').length;
    if (aRecent !== bRecent) return bRecent - aRecent;
    const aLast = a.lastVerifiedAt || 0;
    const bLast = b.lastVerifiedAt || 0;
    return aLast - bLast;
  });
}
