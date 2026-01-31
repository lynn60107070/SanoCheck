// Core data models for SanoCheck system

export type BathroomType = "male" | "female" | "accessible";
export type BathroomStatus = "verified_usable" | "flagged" | "verified_unusable";

export interface Bathroom {
  id: string; // e.g. "A-03"
  zone: string;
  type: BathroomType;
  hasSensor: boolean;
  high_traffic?: boolean;
  lastVerifiedAt: number | null; // timestamp
  score: number; // 0-3 (whole numbers only)
  status: BathroomStatus;
  location?: string; // optional description
}

/** Zone coverage (gaps) – derived per zone, no new table */
export type CoverageStatus = 'adequate' | 'strained' | 'critical';

export interface ZoneCoverageItem {
  zone: string;
  totalBathrooms: number;
  usableBathrooms: number;
  avgHealthScore: number;
  coverageStatus: CoverageStatus;
  alerts: string[];
}

/** Usage pressure 0–3 (not literal use counts); MVP-safe, explainable */
export type UsageScoreLabel = 'High Use' | 'Moderate' | 'Low' | 'Unknown';

export interface BathroomWithUsage extends Bathroom {
  usageScore: number; // 0–3
  usageLabel: UsageScoreLabel;
}

export interface VolunteerVerification {
  bathroomId: string;
  waterAvailable: boolean;
  clogged: boolean;
  usable: boolean;
  timestamp: number;
  volunteerName?: string;
}

export interface ResidentSignal {
  bathroomId: string;
  signal: "usable" | "unusable";
  timestamp: number;
}

export type SensorType = "gas" | "water" | "humidity";
export type GasType = "H2S" | "NH3";

export interface SensorReading {
  bathroomId: string;
  sensorType: SensorType;
  gasType?: GasType; // Only for gas sensors
  value: number; // ppm for gas, L/min for water, % for humidity
  unit?: string; // e.g., 'ppm', '%', 'L/min'
  timestamp: number;
}

export interface MaintenanceRequest {
  id: string;
  bathroomId: string;
  issueType: "plumbing" | "water_supply" | "structural" | "hygiene_cleaning";
  contactName?: string;
  contactPhone?: string;
  status: "not_assigned" | "in_progress" | "resolved";
  createdAt: number;
  resolvedAt?: number;
}

// Scoring configuration
export interface ScoringConfig {
  baseScore: number;
  noWaterPenalty: number;
  cloggedPenalty: number;
  unusablePenalty: number;
  daysSinceVerificationPenalty: number; // per day
  // Gas sensor thresholds
  gasThreshold: number; // gas level threshold (ppm)
  gasPenalty: number;
  // Water sensor thresholds
  waterFlowThreshold: number; // minimum water flow (L/min) - below this indicates no/low water
  noWaterSensorPenalty: number; // penalty if sensor detects no/low water
  // Humidity sensor thresholds
  humidityOptimalMin: number; // optimal humidity range min (%)
  humidityOptimalMax: number; // optimal humidity range max (%)
  humidityHighPenalty: number; // penalty for humidity above optimal (indicates poor ventilation)
  humidityLowPenalty: number; // penalty for humidity below optimal (indicates dryness)
  // Resident signals
  residentUsableBonus: number; // small bonus per confirmation
  residentUnusablePenalty: number;
}

/** Live sensor payload from ESP32 GET /live */
export interface LiveSensorPayload {
  timestamp: number;
  humidity: number;
  water: number;
  gas: number;
  status: string;
}

/** Row from live_sensor_logs for charts */
export interface LiveSensorLogPoint {
  time: string;
  timestamp: number;
  humidity: number | null;
  water: number | null;
  gas: number | null;
  status: string;
}

// Default scoring configuration
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseScore: 100,
  noWaterPenalty: 40,
  cloggedPenalty: 40,
  unusablePenalty: 50,
  daysSinceVerificationPenalty: 10,
  // Gas sensor (H2S/NH3 in ppm)
  gasThreshold: 50, // ppm - above this indicates poor air quality
  gasPenalty: 20,
  // Water sensor (flow rate in L/min)
  waterFlowThreshold: 0.5, // L/min - below this indicates no/low water flow
  noWaterSensorPenalty: 30, // penalty if sensor detects no/low water
  // Humidity sensor (relative humidity %)
  humidityOptimalMin: 30, // % - optimal range for bathroom
  humidityOptimalMax: 60, // % - optimal range for bathroom
  humidityHighPenalty: 15, // penalty for humidity > 60% (poor ventilation, mold risk)
  humidityLowPenalty: 5, // penalty for humidity < 30% (too dry, but less critical)
  // Resident signals
  residentUsableBonus: 2,
  residentUnusablePenalty: 15,
};
