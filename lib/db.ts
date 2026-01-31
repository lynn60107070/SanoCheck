/**
 * Supabase database utilities for SanoCheck
 * Replaces the in-memory store with persistent database operations
 */

import { supabase, supabaseAdmin } from './supabase';

/** Required for API: verification and bathroom reads must use service role or RLS blocks persistence. */
const SERVICE_ROLE_REQUIRED =
  'SUPABASE_SERVICE_ROLE_KEY is required. In .env.local add: SUPABASE_SERVICE_ROLE_KEY=<your key>. Get it from Supabase Dashboard → Project Settings → API → service_role (secret). Then restart the dev server.';

function wrapWriteError(op: string, err: { message?: string; code?: string }): Error {
  const msg = err?.message ?? 'Unknown error';
  const isRls = err?.code === '42501' || /policy|row-level security|permission|denied/i.test(msg);
  return new Error(isRls ? `${op}: ${msg}. ${SERVICE_ROLE_REQUIRED}` : `${op}: ${msg}`);
}
import { Bathroom, VolunteerVerification, ResidentSignal, SensorReading, MaintenanceRequest, BathroomStatus, ZoneCoverageItem, CoverageStatus, BathroomWithUsage, UsageScoreLabel } from './types';
import { calculateBathroomScore } from './scoring';

// Type mappings from database to TypeScript
interface DbBathroom {
  id: string;
  zone: string;
  type: 'male' | 'female' | 'accessible';
  high_traffic: boolean;
  sensor_attached: boolean;
  last_verified_at: string | null;
  health_score: number;
  status: string;
  location?: string;
}

interface DbVerification {
  id: string;
  bathroom_id: string;
  volunteer_id: string | null;
  water_available: boolean;
  clogged: boolean;
  usable: boolean;
  notes: string | null;
  created_at: string;
}

interface DbResidentSignal {
  id: string;
  bathroom_id: string;
  signal: 'usable' | 'unusable';
  anonymous: boolean;
  created_at: string;
}

interface DbSensorReading {
  id: string;
  bathroom_id: string;
  sensor_type?: 'gas' | 'water' | 'humidity'; // Optional for backward compatibility
  gas_type?: 'H2S' | 'NH3' | null;
  value: number;
  unit?: string | null;
  created_at: string;
}

interface DbMaintenanceTask {
  id: string;
  bathroom_id: string;
  issue_type: 'plumbing' | 'water' | 'hygiene' | 'structural';
  status: 'not_assigned' | 'in_progress' | 'resolved';
  contact_method: 'phone' | 'whatsapp' | 'ticket' | null;
  contact_info: string | null;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
}

/**
 * Parse timestamp from DB (e.g. "2026-01-26 00:01:29.558506+00") to milliseconds.
 * Normalizes PostgreSQL format (space, +00) to ISO 8601 so Date parses reliably.
 */
function parseDbTimestamp(createdAt: string): number {
  if (!createdAt) return 0;
  let s = String(createdAt).trim();
  // Replace space between date and time with 'T' for ISO 8601
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    s = s.replace(' ', 'T');
  }
  // Expand +00 / -05 etc. (2-digit TZ without colon) to +00:00 / -05:00 for reliable parsing
  if (/[+-]\d{2}$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
    s = s.replace(/([+-])(\d{2})$/, '$1$2:00');
  }
  return new Date(s).getTime();
}

const VALID_BATHROOM_STATUSES: BathroomStatus[] = ['verified_usable', 'flagged', 'verified_unusable'];

/** Convert raw DB bathroom rows to Bathroom[] (for use in API routes with request-time client). */
export function getBathroomsFromDbRows(rows: unknown[]): Bathroom[] {
  return (rows || []).map((r) => dbBathroomToBathroom(r as DbBathroom));
}

// Helper to convert DB bathroom to app bathroom (score 0-3, status one of three)
function dbBathroomToBathroom(db: DbBathroom): Bathroom {
  let rawScore = Number(db.health_score);
  const rawStatus = (db.status || '').trim();
  const status: BathroomStatus = VALID_BATHROOM_STATUSES.includes(rawStatus as BathroomStatus)
    ? (rawStatus as BathroomStatus)
    : (rawScore >= 2 ? 'verified_usable' : 'flagged');
  if (status === 'flagged' && rawScore > 2) rawScore = 2;
  const score = Math.min(3, Math.max(0, Math.round(rawScore)));
  return {
    id: db.id,
    zone: db.zone,
    type: db.type,
    hasSensor: db.sensor_attached,
    high_traffic: db.high_traffic ?? false,
    lastVerifiedAt: db.last_verified_at ? parseDbTimestamp(db.last_verified_at) : null,
    score,
    status,
    location: db.location,
  };
}

// Helper to convert DB verification to app verification
function dbVerificationToVerification(db: DbVerification): VolunteerVerification {
  return {
    bathroomId: db.bathroom_id,
    waterAvailable: db.water_available,
    clogged: db.clogged,
    usable: db.usable,
    timestamp: parseDbTimestamp(db.created_at),
    volunteerName: db.volunteer_id || undefined,
  };
}

// Helper to convert DB signal to app signal
function dbSignalToSignal(db: DbResidentSignal): ResidentSignal {
  return {
    bathroomId: db.bathroom_id,
    signal: db.signal,
    timestamp: parseDbTimestamp(db.created_at),
  };
}

// Helper to convert DB sensor reading to app reading
function dbSensorToSensor(db: DbSensorReading): SensorReading {
  // Handle legacy data where sensor_type might be missing
  // Default to 'gas' if sensor_type is not set (for backward compatibility)
  const sensorType = db.sensor_type || 'gas';
  
  return {
    bathroomId: db.bathroom_id,
    sensorType: sensorType as 'gas' | 'water' | 'humidity',
    gasType: db.gas_type || undefined,
    value: Number(db.value),
    unit: db.unit || (sensorType === 'gas' ? 'ppm' : sensorType === 'water' ? 'L/min' : '%'),
    timestamp: parseDbTimestamp(db.created_at),
  };
}

// Helper to convert DB maintenance to app maintenance
function dbMaintenanceToMaintenance(db: DbMaintenanceTask): MaintenanceRequest {
  return {
    id: db.id,
    bathroomId: db.bathroom_id,
    issueType: db.issue_type === 'water' ? 'water_supply' : db.issue_type === 'hygiene' ? 'hygiene_cleaning' : db.issue_type,
    contactName: db.contact_info || undefined,
    contactPhone: db.contact_info || undefined,
    status: db.status,
    createdAt: parseDbTimestamp(db.created_at),
    resolvedAt: db.resolved_at ? parseDbTimestamp(db.resolved_at) : undefined,
  };
}

/**
 * Recalculate and update health scores for all bathrooms
 */
export async function recalculateAllScores(): Promise<void> {
  if (!supabaseAdmin) throw new Error(SERVICE_ROLE_REQUIRED);
  console.log('🔄 Starting score recalculation...');
  
  // Get all bathrooms
  const { data: bathrooms, error: bathroomsError } = await supabaseAdmin
    .from('bathrooms')
    .select('*');
  
  if (bathroomsError || !bathrooms) {
    console.error('Error fetching bathrooms:', bathroomsError);
    throw new Error(`Recalc: failed to fetch bathrooms: ${bathroomsError?.message ?? 'unknown'}`);
  }

  console.log(`📊 Recalculating scores for ${bathrooms.length} bathrooms...`);

  const { data: verifications, error: verificationsError } = await supabaseAdmin
    .from('verifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (verificationsError) {
    console.error('Error fetching verifications:', verificationsError);
    throw new Error(`Recalc: failed to fetch verifications: ${verificationsError.message}`);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signals, error: signalsError } = await supabaseAdmin
    .from('resident_signals')
    .select('*')
    .gte('created_at', sevenDaysAgo);

  if (signalsError) {
    console.error('Error fetching signals:', signalsError);
    throw new Error(`Recalc: failed to fetch signals: ${signalsError.message}`);
  }

  // Build maps for efficient lookup (scoring only uses verifications and resident signals)
  const verificationMap = new Map<string, VolunteerVerification>();
  verifications?.forEach(v => {
    const existing = verificationMap.get(v.bathroom_id);
    if (!existing || new Date(v.created_at).getTime() > existing.timestamp) {
      verificationMap.set(v.bathroom_id, dbVerificationToVerification(v));
    }
  });

  const signalsMap = new Map<string, ResidentSignal[]>();
  signals?.forEach(s => {
    const existing = signalsMap.get(s.bathroom_id) || [];
    signalsMap.set(s.bathroom_id, [...existing, dbSignalToSignal(s)]);
  });

  // Recalculate scores for each bathroom (skip volunteer-set status so we never overwrite)
  for (const dbBathroom of bathrooms) {
    const currentStatus = (dbBathroom.status || '').trim();
    if (currentStatus === 'verified_usable' || currentStatus === 'verified_unusable') {
      console.log(`[Recalc] Skipping ${dbBathroom.id}: volunteer-set status (${currentStatus})`);
      continue;
    }
    let bathroom = dbBathroomToBathroom(dbBathroom);
    const latestVerification = verificationMap.get(bathroom.id) || null;
    
    // Sync lastVerifiedAt from latest verification
    if (latestVerification && latestVerification.timestamp > (bathroom.lastVerifiedAt || 0)) {
      bathroom = {
        ...bathroom,
        lastVerifiedAt: latestVerification.timestamp,
      };
    }
    
    const recentSignals = (signalsMap.get(bathroom.id) || []).filter(
      s => Date.now() - s.timestamp < 7 * 24 * 60 * 60 * 1000
    );

    const result = calculateBathroomScore(
      bathroom,
      latestVerification,
      recentSignals,
      [] // Simple scoring: no sensor-based adjustments
    );

    // Update bathroom in database
    // Also update last_verified_at if there's a more recent verification
    const updateData: any = {
      health_score: result.healthScore,
      status: result.status,
      updated_at: new Date().toISOString(),
    };
    
    // If there's a verification more recent than the database's last_verified_at, update it
    if (latestVerification) {
      const dbLastVerified = dbBathroom.last_verified_at 
        ? new Date(dbBathroom.last_verified_at).getTime() 
        : 0;
      if (latestVerification.timestamp > dbLastVerified) {
        updateData.last_verified_at = new Date(latestVerification.timestamp).toISOString();
      }
    }
    
    const { error: updateError, data: updateResult } = await supabaseAdmin
      .from('bathrooms')
      .update(updateData)
      .eq('id', bathroom.id)
      .select();
    
    if (updateError) {
      console.error(`Error updating bathroom ${bathroom.id}:`, updateError);
      console.error('Update data:', updateData);
      throw wrapWriteError(`Recalc: failed to update bathroom ${bathroom.id}`, updateError);
    }
    console.log(`✅ Updated bathroom ${bathroom.id}: score=${result.healthScore}, status=${result.status}`);
  }

  console.log('✅ Score recalculation complete');
}

// Keep the old function signature for backward compatibility

// Bathroom operations — API must use service role so reads see persisted writes (no RLS)
function getReadClient() {
  if (!supabaseAdmin) throw new Error(SERVICE_ROLE_REQUIRED);
  return supabaseAdmin;
}

export async function getAllBathrooms(): Promise<Bathroom[]> {
  const client = getReadClient();
  const { data, error } = await client
    .from('bathrooms')
    .select('*')
    .order('zone', { ascending: true })
    .order('id', { ascending: true });
  
  if (error) {
    console.error('Error fetching bathrooms:', error);
    return [];
  }
  
  return (data || []).map(dbBathroomToBathroom);
}

export async function getBathroomById(id: string): Promise<Bathroom | null> {
  const client = getReadClient();
  const { data, error } = await client
    .from('bathrooms')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return dbBathroomToBathroom(data);
}

export async function updateBathroom(id: string, updates: Partial<Bathroom>): Promise<Bathroom | null> {
  const client = supabaseAdmin || supabase;
  
  const dbUpdates: any = {};
  if (updates.lastVerifiedAt !== undefined) {
    dbUpdates.last_verified_at = updates.lastVerifiedAt ? new Date(updates.lastVerifiedAt).toISOString() : null;
  }
  if (updates.score !== undefined) dbUpdates.health_score = updates.score;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  
  const { data, error } = await client
    .from('bathrooms')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error || !data) {
    return null;
  }
  
  await recalculateAllScores();
  return dbBathroomToBathroom(data);
}

/**
 * Apply resident "thumbs down" feedback: set score 2, status flagged.
 * Uses same persist path as verification so it actually persists.
 */
export async function applyResidentBadFeedback(bathroomId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getWriteClient();
    const bathroom = await getBathroomById(bathroomId);
    if (!bathroom) return { ok: false, error: 'Bathroom not found' };

    // 1. Persist bathroom state (single UPDATE, .single() so we error if 0 rows)
    await persistBathroomState(bathroomId, 2, 'flagged');

    // 2. Insert resident signal (audit)
    await client.from('resident_signals').insert({
      bathroom_id: bathroomId,
      signal: 'unusable',
      anonymous: true,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to flag bathroom';
    return { ok: false, error: msg };
  }
}

/** API must use service role for writes; anon + RLS causes updates to not persist on refresh. */
function getWriteClient() {
  if (!supabaseAdmin) throw new Error(SERVICE_ROLE_REQUIRED);
  return supabaseAdmin;
}

/**
 * Single source of truth: persist bathroom score and status to DB.
 * Uses service role only. Throws if client missing or update affects 0 rows.
 * Returns the updated row so caller can confirm persistence.
 */
async function persistBathroomState(
  bathroomId: string,
  healthScore: number,
  status: BathroomStatus,
  lastVerifiedAt?: string | null
): Promise<{ id: string; health_score: number; status: string }> {
  const client = getWriteClient();
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    health_score: healthScore,
    status,
    updated_at: now,
  };
  if (lastVerifiedAt !== undefined) payload.last_verified_at = lastVerifiedAt;

  const { data, error } = await client
    .from('bathrooms')
    .update(payload)
    .eq('id', bathroomId)
    .select('id, health_score, status')
    .single();

  if (error) throw wrapWriteError('Update bathroom', error);
  if (!data) throw new Error('Update affected 0 rows. ' + SERVICE_ROLE_REQUIRED);
  return data as { id: string; health_score: number; status: string };
}

/** Create a maintenance task for a bathroom when marked unusable, if none open */
async function ensureMaintenanceTaskForUnusable(bathroomId: string): Promise<void> {
  const client = getWriteClient();
  const { data: existing } = await client
    .from('maintenance_tasks')
    .select('id')
    .eq('bathroom_id', bathroomId)
    .neq('status', 'resolved')
    .limit(1);
  if (existing && existing.length > 0) return;
  await createMaintenanceRequest(bathroomId, 'plumbing');
}

// Verification operations — returns confirmed bathroom state so API can return it to frontend
export type VerificationResult = { id: string; score: number; status: BathroomStatus };

export async function addVerification(verification: VolunteerVerification): Promise<VerificationResult> {
  const client = getWriteClient();
  const isUnusable = verification.usable === false || verification.waterAvailable === false;
  const now = new Date(verification.timestamp).toISOString();

  // 1. Insert verification row (audit trail)
  const { error: insertErr } = await client.from('verifications').insert({
    bathroom_id: verification.bathroomId,
    volunteer_id: verification.volunteerName || null,
    water_available: verification.waterAvailable,
    clogged: verification.clogged,
    usable: verification.usable,
    created_at: now,
  });
  if (insertErr) throw wrapWriteError('Insert verification', insertErr);

  // 2. Persist bathroom state: single UPDATE, .single() so we error if 0 rows
  const score = isUnusable ? 0 : 3;
  const status: BathroomStatus = isUnusable ? 'verified_unusable' : 'verified_usable';
  const row = await persistBathroomState(verification.bathroomId, score, status, now);

  if (isUnusable) {
    try {
      await ensureMaintenanceTaskForUnusable(verification.bathroomId);
    } catch (e) {
      console.error('Error creating maintenance task for unusable bathroom:', e);
    }
  }
  return { id: row.id, score: Number(row.health_score), status: row.status.trim() as BathroomStatus };
}

export async function getVerificationsByBathroom(bathroomId: string): Promise<VolunteerVerification[]> {
  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .eq('bathroom_id', bathroomId)
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    return [];
  }
  
  return data.map(dbVerificationToVerification);
}

export async function getLatestVerification(bathroomId: string): Promise<VolunteerVerification | null> {
  const { data, error } = await supabase
    .from('verifications')
    .select('*')
    .eq('bathroom_id', bathroomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return dbVerificationToVerification(data);
}

// Resident signal operations
export async function addResidentSignal(signal: ResidentSignal): Promise<void> {
  const { error } = await supabase
    .from('resident_signals')
    .insert({
      bathroom_id: signal.bathroomId,
      signal: signal.signal,
      anonymous: true,
      created_at: new Date(signal.timestamp).toISOString(),
    });
  
  if (error) {
    console.error('Error adding resident signal:', error);
    return;
  }
  
  await recalculateAllScores();
}

export async function getResidentSignalsByBathroom(bathroomId: string): Promise<ResidentSignal[]> {
  const { data, error } = await supabase
    .from('resident_signals')
    .select('*')
    .eq('bathroom_id', bathroomId)
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    return [];
  }
  
  return data.map(dbSignalToSignal);
}

// Sensor reading operations
export async function addSensorReading(reading: SensorReading): Promise<void> {
  const client = supabaseAdmin || supabase;
  
  const insertData: any = {
    bathroom_id: reading.bathroomId,
    sensor_type: reading.sensorType,
    value: reading.value,
    created_at: new Date(reading.timestamp).toISOString(),
  };
  
  // Only include gas_type if it's a gas sensor
  if (reading.sensorType === 'gas' && reading.gasType) {
    insertData.gas_type = reading.gasType;
  }
  
  // Include unit if provided
  if (reading.unit) {
    insertData.unit = reading.unit;
  } else {
    // Set default units based on sensor type
    if (reading.sensorType === 'gas') {
      insertData.unit = 'ppm';
    } else if (reading.sensorType === 'water') {
      insertData.unit = 'L/min';
    } else if (reading.sensorType === 'humidity') {
      insertData.unit = '%';
    }
  }
  
  const { error } = await client
    .from('sensor_readings')
    .insert(insertData);
  
  if (error) {
    console.error('Error adding sensor reading:', error);
    return;
  }
  
  await recalculateAllScores();
}

export async function getSensorReadingsByBathroom(bathroomId: string): Promise<SensorReading[]> {
  // Get readings from the last 25 hours to ensure we capture all data
  const twentyFiveHoursAgo = new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString();
  
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('bathroom_id', bathroomId)
    .gte('created_at', twentyFiveHoursAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`[DB] Error fetching sensor readings for ${bathroomId}:`, error);
    return [];
  }
  
  if (!data) {
    return [];
  }
  
  console.log(`[DB] Fetched ${data.length} sensor readings for ${bathroomId} from database`);
  if (data.length > 0) {
    const byType = data.reduce((acc, r) => {
      const type = r.sensor_type || 'gas';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[DB] Readings by type:`, byType);
  }
  
  return data.map(dbSensorToSensor);
}

/**
 * Fetch sensor readings for a bathroom for a specific calendar day (UTC).
 * @param bathroomId - Bathroom id
 * @param dateStr - Date as YYYY-MM-DD (treated as UTC day boundaries)
 */
export async function getSensorReadingsByBathroomForDate(bathroomId: string, dateStr: string): Promise<SensorReading[]> {
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
  const fromIso = startOfDay.toISOString();
  const toIso = endOfDay.toISOString();

  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .eq('bathroom_id', bathroomId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`[DB] Error fetching sensor readings for ${bathroomId} on ${dateStr}:`, error);
    return [];
  }

  if (!data) return [];
  console.log(`[DB] Fetched ${data.length} sensor readings for ${bathroomId} on ${dateStr}`);
  return data.map(dbSensorToSensor);
}

export async function getLatestSensorReading(bathroomId: string, sensorType?: 'gas' | 'water' | 'humidity'): Promise<SensorReading | null> {
  let query = supabase
    .from('sensor_readings')
    .select('*')
    .eq('bathroom_id', bathroomId);
  
  if (sensorType) {
    query = query.eq('sensor_type', sensorType);
  }
  
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    return null;
  }
  
  return dbSensorToSensor(data);
}

// Live sensor logs (ESP32 /live)
export async function insertLiveSensorLog(params: {
  deviceId?: string;
  timestamp: number;
  humidity: number;
  water: number;
  gas: number;
  status: string;
}): Promise<void> {
  const { error } = await supabase.from('live_sensor_logs').insert({
    device_id: params.deviceId || null,
    timestamp_ms: params.timestamp,
    humidity: params.humidity,
    water: params.water,
    gas: params.gas,
    status: params.status,
  });
  if (error) {
    console.error('[DB] Error inserting live_sensor_log:', error);
    throw error;
  }
}

export async function getLiveSensorLogsLastMinutes(minutes: number): Promise<Array<{
  created_at: string;
  timestamp_ms: number;
  humidity: number;
  water: number;
  gas: number;
  status: string;
}>> {
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('live_sensor_logs')
    .select('created_at, timestamp_ms, humidity, water, gas, status')
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[DB] Error fetching live_sensor_logs:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    created_at: row.created_at,
    timestamp_ms: Number(row.timestamp_ms),
    humidity: Number(row.humidity),
    water: Number(row.water),
    gas: Number(row.gas),
    status: String(row.status),
  }));
}

// Maintenance operations
export async function getAllMaintenanceRequests(): Promise<MaintenanceRequest[]> {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error || !data) {
    return [];
  }
  
  return data.map(dbMaintenanceToMaintenance);
}

export async function getMaintenanceRequestById(id: string): Promise<MaintenanceRequest | null> {
  const { data, error } = await supabase
    .from('maintenance_tasks')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return dbMaintenanceToMaintenance(data);
}

export async function createMaintenanceRequest(
  bathroomId: string,
  issueType: MaintenanceRequest['issueType'],
  contactName?: string,
  contactPhone?: string
): Promise<MaintenanceRequest> {
  const client = supabaseAdmin || supabase;
  
  // Map issue type to database format
  const dbIssueType = issueType === 'water_supply' ? 'water' : issueType === 'hygiene_cleaning' ? 'hygiene' : issueType;
  
  const { data, error } = await client
    .from('maintenance_tasks')
    .insert({
      bathroom_id: bathroomId,
      issue_type: dbIssueType,
      contact_info: contactPhone || contactName || null,
      status: 'not_assigned',
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error('Failed to create maintenance request');
  }
  
  return dbMaintenanceToMaintenance(data);
}

export async function updateMaintenanceRequest(
  id: string,
  updates: Partial<MaintenanceRequest>
): Promise<MaintenanceRequest | null> {
  const client = getWriteClient();
  const now = new Date().toISOString();

  const dbUpdates: any = {};
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
    if (updates.status === 'resolved' && !updates.resolvedAt) {
      dbUpdates.resolved_at = now;
    }
  }
  if (updates.contactName !== undefined || updates.contactPhone !== undefined) {
    dbUpdates.contact_info = updates.contactPhone || updates.contactName || null;
  }

  const { data, error } = await client
    .from('maintenance_tasks')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  // When status becomes resolved, set bathroom to score 3 and verified_usable
  if (updates.status === 'resolved' && data.bathroom_id) {
    await client
      .from('bathrooms')
      .update({
        health_score: 3,
        status: 'verified_usable',
        last_verified_at: now,
        updated_at: now,
      })
      .eq('id', data.bathroom_id);
  }

  return dbMaintenanceToMaintenance(data);
}

// --- Zone coverage & usage score (explainable, no ML) ---

export interface UsageCounts {
  sensorLast24h: Map<string, number>;
  maintenanceLast7d: Map<string, number>;
  verificationLast7d: Map<string, number>;
}

/** Fetch counts used for usage_score: sensor events last 24h, maintenance last 7d, verification last 7d */
export async function getUsageCountsForBathrooms(): Promise<UsageCounts> {
  const sensorLast24h = new Map<string, number>();
  const maintenanceLast7d = new Map<string, number>();
  const verificationLast7d = new Map<string, number>();

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sensorRows } = await supabase
    .from('sensor_readings')
    .select('bathroom_id')
    .gte('created_at', twentyFourHoursAgo);
  (sensorRows || []).forEach((r: { bathroom_id: string }) => {
    sensorLast24h.set(r.bathroom_id, (sensorLast24h.get(r.bathroom_id) || 0) + 1);
  });

  const { data: maintenanceRows } = await supabase
    .from('maintenance_tasks')
    .select('bathroom_id')
    .gte('created_at', sevenDaysAgo);
  (maintenanceRows || []).forEach((r: { bathroom_id: string }) => {
    maintenanceLast7d.set(r.bathroom_id, (maintenanceLast7d.get(r.bathroom_id) || 0) + 1);
  });

  const { data: verificationRows } = await supabase
    .from('verifications')
    .select('bathroom_id')
    .gte('created_at', sevenDaysAgo);
  (verificationRows || []).forEach((r: { bathroom_id: string }) => {
    verificationLast7d.set(r.bathroom_id, (verificationLast7d.get(r.bathroom_id) || 0) + 1);
  });

  return { sensorLast24h, maintenanceLast7d, verificationLast7d };
}

/** Usage score 0–3: high_traffic +1, sensorEventsLast24h>5 +1, maintenanceLast7d>1 +1. MVP-safe, explainable. */
export function computeUsageScore(bathroom: Bathroom, counts: UsageCounts): number {
  let score = 0;
  if (bathroom.high_traffic) score += 1;
  if ((counts.sensorLast24h.get(bathroom.id) || 0) > 5) score += 1;
  if ((counts.maintenanceLast7d.get(bathroom.id) || 0) > 1) score += 1;
  return Math.min(3, Math.max(0, score));
}

export function getUsageLabel(usageScore: number): UsageScoreLabel {
  if (usageScore >= 3) return 'High Use';
  if (usageScore === 2) return 'Moderate';
  if (usageScore === 1) return 'Low';
  return 'Unknown';
}

/** Attach usageScore and usageLabel to bathrooms */
export function attachUsageToBathrooms(bathrooms: Bathroom[], counts: UsageCounts): BathroomWithUsage[] {
  return bathrooms.map(b => {
    const usageScore = computeUsageScore(b, counts);
    return {
      ...b,
      usageScore,
      usageLabel: getUsageLabel(usageScore),
    };
  });
}

/** Pure: compute zone coverage from a list of bathrooms (used by API with request-time DB data). */
export function computeZoneCoverageFromBathrooms(bathrooms: Bathroom[]): ZoneCoverageItem[] {
  const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
  const byZone = new Map<string, Bathroom[]>();
  for (const b of bathrooms) {
    const list = byZone.get(b.zone) || [];
    list.push(b);
    byZone.set(b.zone, list);
  }
  const result: ZoneCoverageItem[] = [];
  const entries: [string, Bathroom[]][] = Array.from(byZone.entries());
  entries.forEach(([zone, list]) => {
    const totalBathrooms = list.length;
    const usableBathrooms = list.filter((b: Bathroom) => b.status === 'verified_usable').length;
    const allScoreLe1 = list.length > 0 && list.every((b: Bathroom) => b.score <= 1);
    const noUsable = usableBathrooms === 0;
    const sumScore = list.reduce((s: number, b: Bathroom) => s + b.score, 0);
    const avgHealthScore = totalBathrooms ? Math.round((sumScore / totalBathrooms) * 10) / 10 : 0;
    const highTrafficNoVerification48h = list.some(
      (b: Bathroom) => b.high_traffic && (b.lastVerifiedAt == null || b.lastVerifiedAt < fortyEightHoursAgo)
    );
    const overdueVerification = list.some(
      (b: Bathroom) => b.lastVerifiedAt == null || b.lastVerifiedAt < fortyEightHoursAgo
    );
    const alerts: string[] = [];
    if (noUsable) alerts.push('No usable toilets in last 48h');
    if (allScoreLe1) alerts.push('All toilets score ≤1');
    if (highTrafficNoVerification48h) alerts.push('High-traffic toilets with no verification in last 48 hours');
    let coverageStatus: CoverageStatus = 'adequate';
    if (noUsable || allScoreLe1) {
      coverageStatus = 'critical';
    } else if (usableBathrooms >= 1 && avgHealthScore >= 2 && !overdueVerification) {
      coverageStatus = 'adequate';
    } else {
      coverageStatus = 'strained';
    }
    result.push({
      zone,
      totalBathrooms,
      usableBathrooms,
      avgHealthScore,
      coverageStatus,
      alerts,
    });
  });
  result.sort((a, b) => a.zone.localeCompare(b.zone));
  return result;
}

/** Zone coverage: derived per zone (uses getAllBathrooms; prefer API route with request-time client). */
export async function getZoneCoverage(): Promise<ZoneCoverageItem[]> {
  const bathrooms = await getAllBathrooms();
  return computeZoneCoverageFromBathrooms(bathrooms);
}

// Demo mode helpers
export async function simulateTimeDecay(days: number): Promise<void> {
  const client = supabaseAdmin || supabase;
  
  // Update bathrooms' last_verified_at
  const { data: bathrooms } = await client.from('bathrooms').select('id, last_verified_at');
  
  if (!bathrooms) return;
  
  for (const bathroom of bathrooms) {
    if (bathroom.last_verified_at) {
      const oldDate = new Date(bathroom.last_verified_at);
      const newDate = new Date(oldDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      await client
        .from('bathrooms')
        .update({ last_verified_at: newDate.toISOString() })
        .eq('id', bathroom.id);
    }
  }
  
  // Also update verification timestamps to simulate time passing
  const { data: verifications } = await client
    .from('verifications')
    .select('id, created_at');
  
  if (verifications) {
    for (const verification of verifications) {
      if (verification.created_at) {
        const oldDate = new Date(verification.created_at);
        const newDate = new Date(oldDate.getTime() - days * 24 * 60 * 60 * 1000);
        
        await client
          .from('verifications')
          .update({ created_at: newDate.toISOString() })
          .eq('id', verification.id);
      }
    }
  }
  
  console.log(`⏰ Simulated time decay: Advanced all timestamps by ${days} days`);
  await recalculateAllScores();
}
