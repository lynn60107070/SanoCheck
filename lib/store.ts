/**
 * In-memory data store for SanoCheck
 * 
 * In production, this would be replaced with Prisma/SQLite or a database.
 * For hackathon MVP, in-memory storage is faster and sufficient.
 */

import { Bathroom, VolunteerVerification, ResidentSignal, SensorReading, MaintenanceRequest } from './types';
import { calculateBathroomScore } from './scoring';

// In-memory stores
let bathrooms: Bathroom[] = [];
let verifications: VolunteerVerification[] = [];
let residentSignals: ResidentSignal[] = [];
let sensorReadings: SensorReading[] = [];
let maintenanceRequests: MaintenanceRequest[] = [];

// Initialize with sample data
export function initializeStore() {
  if (bathrooms.length > 0) return; // Already initialized

  // Sample bathrooms
  bathrooms = [
    {
      id: 'A-03',
      zone: 'A',
      type: 'male',
      hasSensor: true,
      lastVerifiedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      score: 3,
      status: 'verified_usable',
      location: 'Main building, ground floor',
    },
    {
      id: 'A-07',
      zone: 'A',
      type: 'female',
      hasSensor: false,
      lastVerifiedAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
      score: 2,
      status: 'flagged',
      location: 'Main building, first floor',
    },
    {
      id: 'A-11',
      zone: 'A',
      type: 'accessible',
      hasSensor: true,
      lastVerifiedAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      score: 3,
      status: 'verified_usable',
      location: 'Main building, ground floor',
    },
    {
      id: 'B-04',
      zone: 'B',
      type: 'male',
      hasSensor: true,
      lastVerifiedAt: null,
      score: 1,
      status: 'flagged',
      location: 'Secondary building, ground floor',
    },
    {
      id: 'B-08',
      zone: 'B',
      type: 'female',
      hasSensor: false,
      lastVerifiedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      score: 0,
      status: 'verified_unusable',
      location: 'Secondary building, first floor',
    },
    {
      id: 'C-01',
      zone: 'C',
      type: 'accessible',
      hasSensor: false,
      lastVerifiedAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      score: 2,
      status: 'flagged',
      location: 'Clinic building',
    },
  ];

  // Sample verification
  verifications.push({
    bathroomId: 'A-03',
    waterAvailable: true,
    clogged: false,
    usable: true,
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    volunteerName: 'Volunteer 1',
  });

  // Recalculate all scores
  recalculateAllScores();
}

/**
 * Recalculate scores for all bathrooms
 */
export function recalculateAllScores() {
  const verificationMap = new Map<string, VolunteerVerification>();
  verifications.forEach(v => {
    const existing = verificationMap.get(v.bathroomId);
    if (!existing || v.timestamp > existing.timestamp) {
      verificationMap.set(v.bathroomId, v);
    }
  });

  const signalsMap = new Map<string, ResidentSignal[]>();
  residentSignals.forEach(s => {
    const existing = signalsMap.get(s.bathroomId) || [];
    signalsMap.set(s.bathroomId, [...existing, s]);
  });

  const sensorMap = new Map<string, SensorReading>();
  sensorReadings.forEach(r => {
    const existing = sensorMap.get(r.bathroomId);
    if (!existing || r.timestamp > existing.timestamp) {
      sensorMap.set(r.bathroomId, r);
    }
  });

  bathrooms = bathrooms.map(bathroom => {
    const latestVerification = verificationMap.get(bathroom.id) || null;
    const recentSignals = (signalsMap.get(bathroom.id) || []).filter(
      s => Date.now() - s.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    const latestSensorReading = sensorMap.get(bathroom.id) || null;

    const { healthScore, status } = calculateBathroomScore(
      bathroom,
      latestVerification,
      recentSignals,
      latestSensorReading ? [latestSensorReading] : []
    );

    return {
      ...bathroom,
      score: healthScore,
      status,
    };
  });
}

// Bathroom operations
export function getAllBathrooms(): Bathroom[] {
  return bathrooms;
}

export function getBathroomById(id: string): Bathroom | undefined {
  return bathrooms.find(b => b.id === id);
}

export function updateBathroom(id: string, updates: Partial<Bathroom>): Bathroom | null {
  const index = bathrooms.findIndex(b => b.id === id);
  if (index === -1) return null;
  
  bathrooms[index] = { ...bathrooms[index], ...updates };
  recalculateAllScores();
  return bathrooms[index];
}

// Verification operations
export function addVerification(verification: VolunteerVerification): void {
  verifications.push(verification);
  const bathroom = bathrooms.find(b => b.id === verification.bathroomId);
  if (bathroom) {
    bathroom.lastVerifiedAt = verification.timestamp;
  }
  recalculateAllScores();
}

export function getVerificationsByBathroom(bathroomId: string): VolunteerVerification[] {
  return verifications.filter(v => v.bathroomId === bathroomId);
}

export function getLatestVerification(bathroomId: string): VolunteerVerification | null {
  const bathroomVerifications = verifications
    .filter(v => v.bathroomId === bathroomId)
    .sort((a, b) => b.timestamp - a.timestamp);
  return bathroomVerifications[0] || null;
}

// Resident signal operations
export function addResidentSignal(signal: ResidentSignal): void {
  residentSignals.push(signal);
  recalculateAllScores();
}

export function getResidentSignalsByBathroom(bathroomId: string): ResidentSignal[] {
  return residentSignals.filter(s => s.bathroomId === bathroomId);
}

// Sensor reading operations
export function addSensorReading(reading: SensorReading): void {
  sensorReadings.push(reading);
  recalculateAllScores();
}

export function getLatestSensorReading(bathroomId: string): SensorReading | null {
  const bathroomReadings = sensorReadings
    .filter(r => r.bathroomId === bathroomId)
    .sort((a, b) => b.timestamp - a.timestamp);
  return bathroomReadings[0] || null;
}

// Maintenance operations
export function getAllMaintenanceRequests(): MaintenanceRequest[] {
  return maintenanceRequests;
}

export function getMaintenanceRequestById(id: string): MaintenanceRequest | undefined {
  return maintenanceRequests.find(r => r.id === id);
}

export function createMaintenanceRequest(
  bathroomId: string,
  issueType: MaintenanceRequest['issueType'],
  contactName?: string,
  contactPhone?: string
): MaintenanceRequest {
  const request: MaintenanceRequest = {
    id: `M-${Date.now()}`,
    bathroomId,
    issueType,
    contactName,
    contactPhone,
    status: 'not_assigned',
    createdAt: Date.now(),
  };
  maintenanceRequests.push(request);
  return request;
}

export function updateMaintenanceRequest(
  id: string,
  updates: Partial<MaintenanceRequest>
): MaintenanceRequest | null {
  const index = maintenanceRequests.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  maintenanceRequests[index] = { ...maintenanceRequests[index], ...updates };
  if (updates.status === 'resolved' && !maintenanceRequests[index].resolvedAt) {
    maintenanceRequests[index].resolvedAt = Date.now();
  }
  return maintenanceRequests[index];
}

// Demo mode helpers
export function simulateTimeDecay(days: number): void {
  bathrooms.forEach(bathroom => {
    if (bathroom.lastVerifiedAt) {
      bathroom.lastVerifiedAt = bathroom.lastVerifiedAt - days * 24 * 60 * 60 * 1000;
    }
  });
  recalculateAllScores();
}
