/**
 * Supabase database utilities for SanoCheck
 * Replaces the in-memory store with persistent database operations
 */

import { supabase, supabaseAdmin } from './supabase';
import { Bathroom, VolunteerVerification, ResidentSignal, SensorReading, MaintenanceRequest, BathroomStatus } from './types';
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

// Helper to convert DB bathroom to app bathroom
function dbBathroomToBathroom(db: DbBathroom): Bathroom {
  return {
    id: db.id,
    zone: db.zone,
    type: db.type,
    hasSensor: db.sensor_attached,
    lastVerifiedAt: db.last_verified_at ? parseDbTimestamp(db.last_verified_at) : null,
    score: db.health_score,
    status: db.status as BathroomStatus,
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
  // Always use admin client for recalculations to bypass RLS
  const client = supabaseAdmin;
  
  if (!client) {
    console.error('❌ No Supabase admin client available for recalculating scores. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local');
    // Fallback to regular client (might fail due to RLS)
    const fallbackClient = supabase;
    if (!fallbackClient) {
      console.error('❌ No Supabase client available at all');
      return;
    }
    console.warn('⚠️ Using fallback client (may fail due to RLS policies)');
  }
  
  const effectiveClient = client || supabase;
  console.log('🔄 Starting score recalculation...');
  
  // Get all bathrooms
  const { data: bathrooms, error: bathroomsError } = await effectiveClient
    .from('bathrooms')
    .select('*');
  
  if (bathroomsError || !bathrooms) {
    console.error('Error fetching bathrooms:', bathroomsError);
    return;
  }
  
  console.log(`📊 Recalculating scores for ${bathrooms.length} bathrooms...`);

  // Get all verifications
  const { data: verifications, error: verificationsError } = await effectiveClient
    .from('verifications')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (verificationsError) {
    console.error('Error fetching verifications:', verificationsError);
    return;
  }

  // Get all resident signals (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signals, error: signalsError } = await effectiveClient
    .from('resident_signals')
    .select('*')
    .gte('created_at', sevenDaysAgo);
  
  if (signalsError) {
    console.error('Error fetching signals:', signalsError);
    return;
  }

  // Get all sensor readings
  const { data: sensorReadings, error: sensorError } = await effectiveClient
    .from('sensor_readings')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (sensorError) {
    console.error('Error fetching sensor readings:', sensorError);
    return;
  }
  
  console.log(`📊 Fetched ${sensorReadings?.length || 0} sensor readings from database`);

  // Build maps for efficient lookup
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

  // Build map of all sensor readings per bathroom (array of readings)
  const sensorReadingsMap = new Map<string, SensorReading[]>();
  sensorReadings?.forEach(r => {
    const existing = sensorReadingsMap.get(r.bathroom_id) || [];
    sensorReadingsMap.set(r.bathroom_id, [...existing, dbSensorToSensor(r)]);
  });
  
  console.log(`📊 Mapped sensor readings for ${sensorReadingsMap.size} bathrooms`);

  // Recalculate scores for each bathroom
  for (const dbBathroom of bathrooms) {
    let bathroom = dbBathroomToBathroom(dbBathroom);
    const latestVerification = verificationMap.get(bathroom.id) || null;
    
    // If there's a recent verification, update the bathroom's lastVerifiedAt
    // to match the verification timestamp (ensures time decay uses correct value)
    if (latestVerification && latestVerification.timestamp > (bathroom.lastVerifiedAt || 0)) {
      bathroom = {
        ...bathroom,
        lastVerifiedAt: latestVerification.timestamp,
      };
    }
    
    const recentSignals = (signalsMap.get(bathroom.id) || []).filter(
      s => Date.now() - s.timestamp < 7 * 24 * 60 * 60 * 1000
    );
    // Get all sensor readings for this bathroom (gas, water, humidity)
    const allSensorReadings = sensorReadingsMap.get(bathroom.id) || [];
    
    // Debug: Log sensor readings being passed to scoring
    if (allSensorReadings.length > 0) {
      console.log(`[Recalc] Bathroom ${bathroom.id} sensor readings:`, allSensorReadings.map(r => ({
        type: r.sensorType,
        value: r.value,
        timestamp: new Date(r.timestamp).toISOString(),
      })));
    }

    const result = calculateBathroomScore(
      bathroom,
      latestVerification,
      recentSignals,
      allSensorReadings
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
    
    const { error: updateError, data: updateResult } = await effectiveClient
      .from('bathrooms')
      .update(updateData)
      .eq('id', bathroom.id)
      .select();
    
    if (updateError) {
      console.error(`Error updating bathroom ${bathroom.id}:`, updateError);
      console.error('Update data:', updateData);
    } else {
      console.log(`✅ Updated bathroom ${bathroom.id}: score=${result.healthScore}, status=${result.status}`);
    }
  }
  
  console.log('✅ Score recalculation complete');
}

// Keep the old function signature for backward compatibility

// Bathroom operations
export async function getAllBathrooms(): Promise<Bathroom[]> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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

// Verification operations
export async function addVerification(verification: VolunteerVerification): Promise<void> {
  const client = supabaseAdmin || supabase;
  
  const { error } = await client
    .from('verifications')
    .insert({
      bathroom_id: verification.bathroomId,
      volunteer_id: verification.volunteerName || null,
      water_available: verification.waterAvailable,
      clogged: verification.clogged,
      usable: verification.usable,
      created_at: new Date(verification.timestamp).toISOString(),
    });
  
  if (error) {
    console.error('Error adding verification:', error);
    return;
  }
  
  // Update bathroom's last_verified_at
  const { error: updateError } = await client
    .from('bathrooms')
    .update({
      last_verified_at: new Date(verification.timestamp).toISOString(),
    })
    .eq('id', verification.bathroomId);
  
  if (updateError) {
    console.error('Error updating last_verified_at:', updateError);
    return;
  }
  
  // Small delay to ensure database update propagates
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Recalculate scores after updating last_verified_at
  // This ensures the bathroom object has the updated timestamp
  console.log(`🔄 Recalculating scores after verification for bathroom ${verification.bathroomId}...`);
  try {
    await recalculateAllScores();
    console.log(`✅ Score recalculation completed for bathroom ${verification.bathroomId}`);
  } catch (error) {
    console.error('❌ Error during score recalculation:', error);
    throw error;
  }
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
  const client = supabaseAdmin || supabase;
  
  const dbUpdates: any = {};
  if (updates.status !== undefined) {
    dbUpdates.status = updates.status;
    if (updates.status === 'resolved' && !updates.resolvedAt) {
      dbUpdates.resolved_at = new Date().toISOString();
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
  
  return dbMaintenanceToMaintenance(data);
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
