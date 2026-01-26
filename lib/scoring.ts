/**
 * Rule-based Bathroom Health Scoring Engine
 * 
 * This is a pure, explainable scoring system - no black-box ML.
 * All rules are configurable and transparent.
 */

import { Bathroom, BathroomStatus, VolunteerVerification, ResidentSignal, SensorReading, ScoringConfig, DEFAULT_SCORING_CONFIG } from './types';

export interface ScoreExplanation {
  baseScore: number;
  adjustments: Array<{ reason: string; value: number }>;
  finalScore: number;
  status: string;
}

/**
 * Calculate bathroom health score based on all available data
 */
export function calculateBathroomScore(
  bathroom: Bathroom,
  latestVerification: VolunteerVerification | null,
  recentSignals: ResidentSignal[],
  latestSensorReading: SensorReading | null,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): { score: number; status: BathroomStatus; explanation: ScoreExplanation } {
  const explanation: ScoreExplanation = {
    baseScore: config.baseScore,
    adjustments: [],
    finalScore: 0,
    status: '',
  };

  let score = config.baseScore;

  // Apply volunteer verification penalties
  if (latestVerification) {
    if (!latestVerification.waterAvailable) {
      score -= config.noWaterPenalty;
      explanation.adjustments.push({
        reason: 'No water available (volunteer verified)',
        value: -config.noWaterPenalty,
      });
    }

    if (latestVerification.clogged) {
      score -= config.cloggedPenalty;
      explanation.adjustments.push({
        reason: 'Clogged (volunteer verified)',
        value: -config.cloggedPenalty,
      });
    }

    if (!latestVerification.usable) {
      score -= config.unusablePenalty;
      explanation.adjustments.push({
        reason: 'Marked unusable by volunteer',
        value: -config.unusablePenalty,
      });
    }
  }

  // Apply time decay penalty
  if (bathroom.lastVerifiedAt) {
    const daysSinceVerification = Math.floor(
      (Date.now() - bathroom.lastVerifiedAt) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceVerification > 0) {
      const timePenalty = daysSinceVerification * config.daysSinceVerificationPenalty;
      score -= timePenalty;
      explanation.adjustments.push({
        reason: `Time decay (${daysSinceVerification} days since verification)`,
        value: -timePenalty,
      });
    }
  } else {
    // Never verified - heavy penalty
    const timePenalty = 7 * config.daysSinceVerificationPenalty; // Assume 7 days
    score -= timePenalty;
    explanation.adjustments.push({
      reason: 'Never verified',
      value: -timePenalty,
    });
  }

  // Apply sensor reading penalty
  if (latestSensorReading && latestSensorReading.gasLevel > config.gasThreshold) {
    score -= config.gasPenalty;
    explanation.adjustments.push({
      reason: `Gas level above threshold (${latestSensorReading.gasLevel} > ${config.gasThreshold})`,
      value: -config.gasPenalty,
    });
  }

  // Apply resident signals (small adjustments)
  const recentUsableSignals = recentSignals.filter(s => s.signal === 'usable').length;
  const recentUnusableSignals = recentSignals.filter(s => s.signal === 'unusable').length;

  if (recentUsableSignals > 0) {
    const bonus = Math.min(recentUsableSignals * config.residentUsableBonus, 10); // Cap bonus
    score += bonus;
    explanation.adjustments.push({
      reason: `Resident confirmations (${recentUsableSignals} usable signals)`,
      value: bonus,
    });
  }

  if (recentUnusableSignals > 0) {
    const penalty = recentUnusableSignals * config.residentUnusablePenalty;
    score -= penalty;
    explanation.adjustments.push({
      reason: `Resident reports (${recentUnusableSignals} unusable signals)`,
      value: -penalty,
    });
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine status based on score
  let status: BathroomStatus;
  if (score >= 80) {
    status = 'usable';
  } else if (score >= 50) {
    status = 'needs_check';
  } else if (score >= 20) {
    status = 'flagged';
  } else {
    status = 'unusable';
  }

  explanation.finalScore = score;
  explanation.status = status;

  return { score, status, explanation };
}

/**
 * Rank bathrooms for volunteer inspection priority
 */
export function rankBathroomsForInspection(
  bathrooms: Bathroom[],
  verifications: Map<string, VolunteerVerification>,
  signals: Map<string, ResidentSignal[]>,
  sensorReadings: Map<string, SensorReading>
): Bathroom[] {
  return [...bathrooms].sort((a, b) => {
    // Priority factors (lower number = higher priority)
    
    // 1. Score (lower score = higher priority)
    const scoreDiff = a.score - b.score;
    if (Math.abs(scoreDiff) > 5) return scoreDiff;

    // 2. Sensor anomaly
    const aSensor = sensorReadings.get(a.id);
    const bSensor = sensorReadings.get(b.id);
    const aHasAnomaly = aSensor && aSensor.gasLevel > 50;
    const bHasAnomaly = bSensor && bSensor.gasLevel > 50;
    if (aHasAnomaly && !bHasAnomaly) return -1;
    if (!aHasAnomaly && bHasAnomaly) return 1;

    // 3. Recent resident "unusable" signal
    const aSignals = signals.get(a.id) || [];
    const bSignals = signals.get(b.id) || [];
    const aRecentUnusable = aSignals.some(s => 
      s.signal === 'unusable' && Date.now() - s.timestamp < 24 * 60 * 60 * 1000
    );
    const bRecentUnusable = bSignals.some(s => 
      s.signal === 'unusable' && Date.now() - s.timestamp < 24 * 60 * 60 * 1000
    );
    if (aRecentUnusable && !bRecentUnusable) return -1;
    if (!aRecentUnusable && bRecentUnusable) return 1;

    // 4. Longest time since last check
    const aLastCheck = a.lastVerifiedAt || 0;
    const bLastCheck = b.lastVerifiedAt || 0;
    return bLastCheck - aLastCheck; // Older = higher priority
  });
}
