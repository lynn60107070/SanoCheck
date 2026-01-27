/**
 * Rule-based Bathroom Health Scoring Engine
 * 
 * HARD CONSTRAINTS:
 * - Volunteer verification is the highest authority
 * - Only volunteers can mark bathrooms unusable
 * - Resident and sensor inputs NEVER directly change usability
 * - All scoring must be deterministic and explainable
 * - Scores must degrade over time if not re-verified
 * 
 * This is a pure, explainable scoring system - no black-box ML.
 * All rules are transparent and auditable.
 */

import { Bathroom, BathroomStatus, VolunteerVerification, ResidentSignal, SensorReading } from './types';

export interface ScoreResult {
  healthScore: number; // 0-3 (whole numbers only)
  status: BathroomStatus;
  priorityFlags: string[]; // Array of reasons for priority
  explanation: {
    baseScore: number;
    adjustments: Array<{ reason: string; value: number }>;
    finalScore: number;
    status: string;
  };
}

/**
 * Calculate bathroom health score based on all available data
 * 
 * RULE 1: BASE SCORE
 * healthScore = 3 (on 0-3 scale, whole numbers only)
 */
export function calculateBathroomScore(
  bathroom: Bathroom,
  latestVerification: VolunteerVerification | null,
  recentSignals: ResidentSignal[],
  sensorReadings: SensorReading[]
): ScoreResult {
  const priorityFlags: string[] = [];
  const adjustments: Array<{ reason: string; value: number }> = [];
  
  // RULE 1: BASE SCORE (0-3 scale, whole numbers only)
  let healthScore = 3;
  const baseScore = 3;

  // RULE 2: VOLUNTEER VERIFICATION (HIGHEST AUTHORITY)
  let volunteerMarkedUnusable = false;
  let volunteerJustVerifiedUsable = false; // Track this early for use in other rules
  
  if (latestVerification) {
    // RULE 2A: Volunteer Confirms USABLE
    // Conditions: water_available = true, clogged = false, usable = true
    if (
      latestVerification.waterAvailable === true &&
      latestVerification.clogged === false &&
      latestVerification.usable === true
    ) {
      // Effect: Start with 3, but allow sensor adjustments to reduce score
      // Status will be "verified_usable" regardless of final score
      volunteerJustVerifiedUsable = true;
      healthScore = 3;
      adjustments.push({
        reason: 'Volunteer verified usable (water available, not clogged)',
        value: 0, // Sets base to 3, but sensors can still adjust
      });
      
      // Clear active flags but keep history (flags are informational only)
      // Note: We don't clear priorityFlags here as they're informational
      
      // Status will be set to verified_usable at the end
    }
    // RULE 2B: Volunteer Confirms PARTIALLY DEGRADED
    else if (latestVerification.usable === true) {
      // Example: water_available = true, clogged = true, usable = true
      if (!latestVerification.waterAvailable) {
        healthScore -= 2; // noWaterPenalty (on 0-3 scale)
        adjustments.push({
          reason: 'No water available (volunteer verified)',
          value: -2,
        });
      }
      
      if (latestVerification.clogged) {
        healthScore -= 2; // cloggedPenalty (on 0-3 scale)
        adjustments.push({
          reason: 'Clogged (volunteer verified)',
          value: -2,
        });
      }
      
      // Status will be determined by score thresholds
    }
    // RULE 2C: Volunteer Confirms UNUSABLE
    // Conditions: usable = false OR water_available = false OR severe clogging
    else if (
      latestVerification.usable === false ||
      latestVerification.waterAvailable === false
    ) {
      // Effect: healthScore = 0, status = "verified_unusable", trigger maintenance task
      healthScore = 0;
      volunteerMarkedUnusable = true;
      adjustments.push({
        reason: 'Marked unusable by volunteer',
        value: -3, // Sets to 0
      });
      priorityFlags.push('volunteer_marked_unusable');
      // Status will be set to verified_unusable at the end
    }
  }

  // RULE 3: TIME DECAY (APPLIED DAILY)
  // Only skip time decay if volunteer JUST verified (within last 24 hours)
  // Otherwise, apply time decay based on last verification timestamp
  
  // Check if verification was very recent (within 24 hours) - if so, skip time decay
  // Define this once for use in both time decay and status derivation
  const verificationVeryRecent = latestVerification && 
    latestVerification.waterAvailable === true &&
    latestVerification.clogged === false &&
    latestVerification.usable === true &&
    (Date.now() - latestVerification.timestamp) < (24 * 60 * 60 * 1000);
  
  if (!verificationVeryRecent) {
    // Use verification timestamp if it's more recent than bathroom's lastVerifiedAt
    const lastCheckTimestamp = latestVerification && latestVerification.timestamp > (bathroom.lastVerifiedAt || 0)
      ? latestVerification.timestamp
      : bathroom.lastVerifiedAt;
    
    if (lastCheckTimestamp) {
      const daysSinceCheck = Math.floor(
        (Date.now() - lastCheckTimestamp) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCheck > 0) {
        // Time decay: -1 per day (on 0-3 scale, whole numbers)
        const timeDecay = daysSinceCheck; // -1 per day
        healthScore -= timeDecay;
        adjustments.push({
          reason: `Time decay (${daysSinceCheck} days since verification)`,
          value: -timeDecay,
        });
        console.log(`[Scoring] ${bathroom.id}: Applied time decay: -${timeDecay} (${daysSinceCheck} days since check)`);
      } else {
        console.log(`[Scoring] ${bathroom.id}: No time decay (verified today)`);
      }
    } else {
      // Never verified - assume 3 days (max penalty on 0-3 scale)
      const timeDecay = 3;
      healthScore -= timeDecay;
      adjustments.push({
        reason: 'Never verified (assumed 3 days)',
        value: -timeDecay,
      });
      console.log(`[Scoring] ${bathroom.id}: Applied time decay: -${timeDecay} (never verified)`);
    }
  } else {
    console.log(`[Scoring] ${bathroom.id}: Skipped time decay (verified within 24h)`);
  }

  // RULE 4: SENSOR-BASED ADJUSTMENTS (PRIORITY + DECAY ONLY)
  // Never overrides volunteer verification status, but can adjust score
  
  // Get latest reading for each sensor type
  const latestGasReading = sensorReadings
    .filter(r => r.sensorType === 'gas')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const latestWaterReading = sensorReadings
    .filter(r => r.sensorType === 'water')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const latestHumidityReading = sensorReadings
    .filter(r => r.sensorType === 'humidity')
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  // Debug: Log sensor readings for this bathroom (only if readings exist)
  if (sensorReadings.length > 0) {
    console.log(`[Scoring] Bathroom ${bathroom.id} - ${sensorReadings.length} sensor readings:`, {
      gas: latestGasReading ? `${latestGasReading.value} ${latestGasReading.unit || 'ppm'}` : 'none',
      water: latestWaterReading ? `${latestWaterReading.value} ${latestWaterReading.unit || 'L/min'}` : 'none',
      humidity: latestHumidityReading ? `${latestHumidityReading.value} ${latestHumidityReading.unit || '%'}` : 'none',
    });
  }

  // RULE 4A: Gas Sensor (H₂S / NH₃)
  if (latestGasReading) {
    const gasLevel = latestGasReading.value;
    // Normal: 0 (no penalty)
    // Elevated: -10 (need to define threshold - assume 30-50 ppm)
    // High spike: -25 + priority (assume > 50 ppm)
    
    if (gasLevel > 50) {
      // High spike: -1 (on 0-3 scale)
      const penalty = 1;
      healthScore -= penalty;
      adjustments.push({
        reason: `Gas spike detected (${gasLevel.toFixed(1)} ppm > 50 ppm)`,
        value: -penalty,
      });
      priorityFlags.push('gas_spike');
      console.log(`[Scoring] ${bathroom.id}: Applied gas spike penalty: -${penalty} (gas level: ${gasLevel} ppm)`);
    } else if (gasLevel > 30) {
      // Elevated: -1 (on 0-3 scale)
      const penalty = 1;
      healthScore -= penalty;
      adjustments.push({
        reason: `Elevated gas level (${gasLevel.toFixed(1)} ppm > 30 ppm)`,
        value: -penalty,
      });
      console.log(`[Scoring] ${bathroom.id}: Applied elevated gas penalty: -${penalty} (gas level: ${gasLevel} ppm)`);
    } else {
      console.log(`[Scoring] ${bathroom.id}: Gas level normal (${gasLevel} ppm) - no penalty`);
    }
    // Normal (0-30): no penalty
  }

  // RULE 4B: Humidity Sensor
  if (latestHumidityReading) {
    const humidity = latestHumidityReading.value;
    // >80%: -10
    // >80% for 3+ days: -20
    
    if (humidity > 80) {
      // Check if >80% for 3+ days
      const highHumidityReadings = sensorReadings
        .filter(r => r.sensorType === 'humidity' && r.value > 80)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      if (highHumidityReadings.length > 0) {
        const oldestHighHumidity = highHumidityReadings[highHumidityReadings.length - 1];
        const daysHighHumidity = Math.floor(
          (Date.now() - oldestHighHumidity.timestamp) / (1000 * 60 * 60 * 24)
        );
        
        if (daysHighHumidity >= 3) {
          // -1 (on 0-3 scale)
          const penalty = 1;
          healthScore -= penalty;
          adjustments.push({
            reason: `High humidity >80% for ${daysHighHumidity} days (poor ventilation)`,
            value: -penalty,
          });
          console.log(`[Scoring] ${bathroom.id}: Applied high humidity penalty (3+ days): -${penalty} (humidity: ${humidity}%)`);
        } else {
          // -1 (on 0-3 scale)
          const penalty = 1;
          healthScore -= penalty;
          adjustments.push({
            reason: `High humidity detected (${humidity.toFixed(1)}% > 80%)`,
            value: -penalty,
          });
          console.log(`[Scoring] ${bathroom.id}: Applied high humidity penalty: -${penalty} (humidity: ${humidity}%)`);
        }
      }
    } else {
      console.log(`[Scoring] ${bathroom.id}: Humidity normal (${humidity}%) - no penalty`);
    }
  }

  // RULE 4C: Water Flow Sensor
  if (latestWaterReading) {
    const waterFlow = latestWaterReading.value;
    // Intermittent: -15 (assume 0.1-0.5 L/min)
    // No flow: -30 + priority (assume < 0.1 L/min)
    
    if (waterFlow < 0.1) {
      // No flow: -2 (on 0-3 scale)
      const penalty = 2;
      healthScore -= penalty;
      adjustments.push({
        reason: `No water flow detected (${waterFlow.toFixed(2)} L/min < 0.1 L/min)`,
        value: -penalty,
      });
      priorityFlags.push('no_water_flow');
      console.log(`[Scoring] ${bathroom.id}: Applied no water flow penalty: -${penalty} (flow: ${waterFlow} L/min)`);
    } else if (waterFlow < 0.5) {
      // Intermittent: -1 (on 0-3 scale)
      const penalty = 1;
      healthScore -= penalty;
      adjustments.push({
        reason: `Intermittent water flow (${waterFlow.toFixed(2)} L/min < 0.5 L/min)`,
        value: -penalty,
      });
      console.log(`[Scoring] ${bathroom.id}: Applied intermittent water penalty: -${penalty} (flow: ${waterFlow} L/min)`);
    } else {
      console.log(`[Scoring] ${bathroom.id}: Water flow normal (${waterFlow} L/min) - no penalty`);
    }
  }

  // RULE 5: RESIDENT SIGNALS REMOVED
  // Resident signals are no longer used in scoring
  // Only volunteer verification and sensor readings affect scores

  // RULE 6: LOCATION IMPORTANCE (PRIORITY ONLY)
  // Does NOT reduce score, only affects priority
  // Check if bathroom is high-traffic or near important locations
  // This would be based on bathroom metadata (not in current schema, but we can check zone/type)
  if (bathroom.zone === 'A' || bathroom.type === 'accessible') {
    priorityFlags.push('high_traffic_location');
  }

  // RULE 7: FINAL CLAMP (0-3 scale, whole numbers only)
  healthScore = Math.max(0, Math.min(3, Math.round(healthScore)));
  
  console.log(`[Scoring] ${bathroom.id}: Final score after all adjustments: ${healthScore}`);

  // RULE 8: STATUS DERIVATION (FINAL STEP)
  // Status is determined by volunteer verification and score only
  // Resident signals no longer affect status
  let status: BathroomStatus;
  
  // Note: verificationVeryRecent is already defined in RULE 3 above
  
  // Thresholds on 0-3 scale (whole numbers):
  // - 0 = verified_unusable (if volunteer marked) or flagged (if score-based)
  // - 1 = flagged (needs volunteer check)
  // - 2 = flagged (needs volunteer check)
  // - 3 = verified_usable (good)
  
  if (volunteerMarkedUnusable) {
    // Volunteer confirmed it's unusable - highest priority
    status = 'verified_unusable';
    console.log(`[Scoring] ${bathroom.id}: Status = verified_unusable (volunteer marked)`);
  } else if (healthScore < 2) {
    // Score 0 or 1 - flagged for volunteer check
    status = 'flagged';
    console.log(`[Scoring] ${bathroom.id}: Status = flagged (score < 2)`);
  } else if (volunteerJustVerifiedUsable && verificationVeryRecent) {
    // Volunteer JUST verified (within 24h) as fully usable
    status = 'verified_usable';
    console.log(`[Scoring] ${bathroom.id}: Status = verified_usable (volunteer verified within 24h)`);
  } else if (volunteerJustVerifiedUsable) {
    // Volunteer verified as fully usable (but >24h ago) AND score is >= 2
    status = 'verified_usable';
    console.log(`[Scoring] ${bathroom.id}: Status = verified_usable (volunteer verified, score >= 2)`);
  } else if (healthScore >= 2) {
    // Score is 2 or 3 - verified usable
    status = 'verified_usable';
    console.log(`[Scoring] ${bathroom.id}: Status = verified_usable (score >= 2)`);
  } else {
    // Fallback: flagged
    status = 'flagged';
    console.log(`[Scoring] ${bathroom.id}: Status = flagged (fallback)`);
  }

  // Build explanation
  const explanation = {
    baseScore,
    adjustments,
    finalScore: healthScore,
    status,
  };

  return {
    healthScore,
    status,
    priorityFlags,
    explanation,
  };
}

/**
 * Rank bathrooms for volunteer inspection priority
 * 
 * Uses priority flags and score to determine inspection order
 */
export function rankBathroomsForInspection(
  bathrooms: Bathroom[],
  verifications: Map<string, VolunteerVerification>,
  signals: Map<string, ResidentSignal[]>,
  sensorReadings: Map<string, SensorReading[]>
): Bathroom[] {
  return [...bathrooms].sort((a, b) => {
    // Priority factors (lower number = higher priority)
    
    // 1. Score (lower score = higher priority)
    const scoreDiff = a.score - b.score;
    if (Math.abs(scoreDiff) > 5) return scoreDiff;

    // 2. Sensor anomalies (check all sensor types)
    const aReadings = sensorReadings.get(a.id) || [];
    const bReadings = sensorReadings.get(b.id) || [];
    
    // Check for gas spikes
    const aGasReading = aReadings.find(r => r.sensorType === 'gas');
    const bGasReading = bReadings.find(r => r.sensorType === 'gas');
    const aHasGasSpike = aGasReading && aGasReading.value > 50;
    const bHasGasSpike = bGasReading && bGasReading.value > 50;
    
    // Check for water anomalies (no flow)
    const aWaterReading = aReadings.find(r => r.sensorType === 'water');
    const bWaterReading = bReadings.find(r => r.sensorType === 'water');
    const aHasNoWater = aWaterReading && aWaterReading.value < 0.1;
    const bHasNoWater = bWaterReading && bWaterReading.value < 0.1;
    
    // Check for humidity anomalies (too high for 3+ days)
    const aHumidityReadings = aReadings.filter(r => r.sensorType === 'humidity' && r.value > 80);
    const bHumidityReadings = bReadings.filter(r => r.sensorType === 'humidity' && r.value > 80);
    const aHasHighHumidity = aHumidityReadings.length > 0 && 
      (Date.now() - aHumidityReadings[aHumidityReadings.length - 1].timestamp) >= 3 * 24 * 60 * 60 * 1000;
    const bHasHighHumidity = bHumidityReadings.length > 0 && 
      (Date.now() - bHumidityReadings[bHumidityReadings.length - 1].timestamp) >= 3 * 24 * 60 * 60 * 1000;
    
    const aHasAnomaly = aHasGasSpike || aHasNoWater || aHasHighHumidity;
    const bHasAnomaly = bHasGasSpike || bHasNoWater || bHasHighHumidity;
    
    if (aHasAnomaly && !bHasAnomaly) return -1;
    if (!aHasAnomaly && bHasAnomaly) return 1;

    // 3. Recent resident "unusable" signal count (24h window)
    const aSignals = signals.get(a.id) || [];
    const bSignals = signals.get(b.id) || [];
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    const aRecentUnusable = aSignals.filter(s => 
      s.signal === 'unusable' && s.timestamp >= twentyFourHoursAgo
    ).length;
    const bRecentUnusable = bSignals.filter(s => 
      s.signal === 'unusable' && s.timestamp >= twentyFourHoursAgo
    ).length;
    
    if (aRecentUnusable > bRecentUnusable) return -1;
    if (aRecentUnusable < bRecentUnusable) return 1;

    // 4. Longest time since last check
    const aLastCheck = a.lastVerifiedAt || 0;
    const bLastCheck = b.lastVerifiedAt || 0;
    return bLastCheck - aLastCheck; // Older = higher priority
  });
}
