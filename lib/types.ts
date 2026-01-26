// Core data models for SanoCheck system

export type BathroomType = "male" | "female" | "accessible";
export type BathroomStatus = "usable" | "needs_check" | "flagged" | "unusable";

export interface Bathroom {
  id: string; // e.g. "A-03"
  zone: string;
  type: BathroomType;
  hasSensor: boolean;
  lastVerifiedAt: number | null; // timestamp
  score: number; // 0-100
  status: BathroomStatus;
  location?: string; // optional description
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

export interface SensorReading {
  bathroomId: string;
  gasLevel: number; // ppm or similar unit
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
  gasThreshold: number; // gas level threshold
  gasPenalty: number;
  residentUsableBonus: number; // small bonus per confirmation
  residentUnusablePenalty: number;
}

// Default scoring configuration
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseScore: 100,
  noWaterPenalty: 40,
  cloggedPenalty: 40,
  unusablePenalty: 50,
  daysSinceVerificationPenalty: 10,
  gasThreshold: 50, // example threshold
  gasPenalty: 20,
  residentUsableBonus: 2,
  residentUnusablePenalty: 15,
};
