'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bathroom, BathroomWithUsage, MaintenanceRequest, LiveSensorLogPoint, ZoneCoverageItem, CoverageStatus } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [rankings, setRankings] = useState<BathroomWithUsage[]>([]);
  const [zoneCoverage, setZoneCoverage] = useState<ZoneCoverageItem[]>([]);
  const [filterHighUsageLowHealth, setFilterHighUsageLowHealth] = useState(false);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedBathroom, setSelectedBathroom] = useState<Bathroom | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'verification' | 'maintenance' | 'sensors' | 'liveSensors'>('verification');
  /** Maintenance: show selected issue type in dropdown until request is created */
  const [selectedIssueTypeByBathroom, setSelectedIssueTypeByBathroom] = useState<Record<string, MaintenanceRequest['issueType']>>({});

  // Sensor data view state
  const [selectedSensorBathroom, setSelectedSensorBathroom] = useState<string>('');
  const [sensorDate, setSensorDate] = useState<string>(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  const [sensorData, setSensorData] = useState<any>(null);
  const [loadingSensorData, setLoadingSensorData] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [sensorFilters, setSensorFilters] = useState({
    gas: true,
    water: true,
    humidity: true,
  });

  // Live sensor data view state (same features as Sensor Data tab)
  const [selectedDemoSensorBathroom, setSelectedDemoSensorBathroom] = useState<string>('');
  const [demoSensorDate, setDemoSensorDate] = useState<string>(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  const [demoSensorData, setDemoSensorData] = useState<any>(null);
  const [loadingDemoSensorData, setLoadingDemoSensorData] = useState(false);
  const [selectedDemoTime, setSelectedDemoTime] = useState<number | null>(null);
  const [demoSensorFilters, setDemoSensorFilters] = useState({
    gas: true,
    water: true,
    humidity: true,
  });

  // Live stream from ESP32: 5s poll, 5-min graph
  const [liveStreamUrl, setLiveStreamUrl] = useState('http://192.168.4.1/live');
  const [liveStreamRunning, setLiveStreamRunning] = useState(false);
  const [liveStreamGraphData, setLiveStreamGraphData] = useState<LiveSensorLogPoint[]>([]);
  const [liveStreamError, setLiveStreamError] = useState<string | null>(null);
  const liveStreamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** After marking a bathroom usable or unusable, preserve that state when refetches return (and across refresh via sessionStorage). */
  const lastVerifiedRef = useRef<{ id: string; score: number; status: Bathroom['status'] } | null>(null);

  const SESSION_KEY_LAST_VERIFIED = 'sanocheck_last_verified';
  const LAST_VERIFIED_TTL_MS = 10 * 60 * 1000; // 10 min so refresh shows correct state even if DB read is stale

  useEffect(() => {
    loadData();
  }, [selectedZone]);

  // Load sensor data when bathroom, date, or tab changes
  useEffect(() => {
    if (selectedSensorBathroom && activeTab === 'sensors') {
      loadSensorData(selectedSensorBathroom, sensorDate);
    }
  }, [selectedSensorBathroom, activeTab, sensorDate]);


  const loadSensorData = async (bathroomId: string, dateStr?: string) => {
    setLoadingSensorData(true);
    setSelectedTime(null); // Reset selected time when loading new data
    try {
      const url = dateStr
        ? `/api/sensor-data/${bathroomId}?date=${encodeURIComponent(dateStr)}&t=${Date.now()}`
        : `/api/sensor-data/${bathroomId}?t=${Date.now()}`;
      const response = await fetch(url, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch sensor data');
      }
      const data = await response.json();
      
      // Log for debugging
      if (data.graphData && data.graphData.length > 0) {
        console.log(`✅ Loaded ${data.graphData.length} sensor data points for ${bathroomId}`);
        if (data.debug) {
          console.log(`📊 Data Source Info for ${bathroomId}:`, {
            totalReadingsFromDB: data.debug.totalReadingsFromDB,
            readingsInLast24h: data.debug.readingsInLast24h,
            gasReadings: data.debug.gasReadingsCount,
            waterReadings: data.debug.waterReadingsCount,
            humidityReadings: data.debug.humidityReadingsCount,
            graphDataPoints: data.debug.graphDataPoints,
            dataSource: data.debug.dataSource,
            query: data.debug.query
          });
        }
      } else {
        console.log(`⚠️ No sensor data found for ${bathroomId}`);
        if (data.debug) {
          console.log(`📊 Debug Info:`, data.debug);
        }
      }
      
      setSensorData(data);
    } catch (error) {
      console.error('Error loading sensor data:', error);
      setSensorData(null);
    } finally {
      setLoadingSensorData(false);
    }
  };

  const generateSensorData = async (bathroomId: string) => {
    if (!bathroomId) {
      setVerificationMessage('❌ Please select a bathroom first');
      return;
    }

    // Refresh sensor data from database (data should be pre-loaded via SQL)
    setVerificationMessage('⏳ Loading sensor data from database...');
    
    try {
      // Clear old data first
      setSensorData(null);
      setSelectedTime(null);
      
      // Fetch fresh data from database
      await loadSensorData(bathroomId, sensorDate);
      
      // Wait a moment for state to update, then check
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // The loadSensorData function will update sensorData state
      // We'll show a success message after a brief delay
      setVerificationMessage('✅ Sensor data refreshed');
      setTimeout(() => {
        setVerificationMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error loading sensor data:', error);
      setVerificationMessage('❌ Error loading sensor data. Make sure SQL data has been generated.');
      setTimeout(() => {
        setVerificationMessage('');
      }, 3000);
    }
  };

  const loadDemoSensorData = async (bathroomId: string, dateStr?: string) => {
    setLoadingDemoSensorData(true);
    setSelectedDemoTime(null);
    try {
      const url = dateStr
        ? `/api/sensor-data/${bathroomId}?date=${encodeURIComponent(dateStr)}&t=${Date.now()}`
        : `/api/sensor-data/${bathroomId}?t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch sensor data');
      const data = await response.json();
      setDemoSensorData(data);
    } catch (error) {
      console.error('Error loading live sensor data:', error);
      setDemoSensorData(null);
    } finally {
      setLoadingDemoSensorData(false);
    }
  };

  const generateDemoSensorData = async (bathroomId: string) => {
    if (!bathroomId) return;
    setVerificationMessage('⏳ Loading live sensor data...');
    try {
      setDemoSensorData(null);
      setSelectedDemoTime(null);
      await loadDemoSensorData(bathroomId, demoSensorDate);
      setVerificationMessage('✅ Live sensor data refreshed');
      setTimeout(() => setVerificationMessage(''), 2000);
    } catch (error) {
      console.error('Error loading live sensor data:', error);
      setVerificationMessage('❌ Error loading live sensor data.');
      setTimeout(() => setVerificationMessage(''), 3000);
    }
  };

  // Live stream tick: fetch ESP32 (direct or proxy), add to client-side 5-min buffer, optionally POST to Supabase (ignored if offline)
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const runLiveStreamTick = async () => {
    const url = liveStreamUrl.trim();
    if (!url) return;
    setLiveStreamError(null);
    try {
      let res: Response;
      try {
        res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      } catch {
        const pollUrl = `/api/live-sensor/poll?url=${encodeURIComponent(url)}`;
        res = await fetch(pollUrl, { cache: 'no-store' });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Device returned ${res.status}`);
      }
      const payload = await res.json();
      const { timestamp, humidity, water, gas, status } = payload;
      if (typeof timestamp !== 'number' || typeof humidity !== 'number' || typeof water !== 'number' || typeof gas !== 'number' || typeof status !== 'string') {
        throw new Error('Invalid live response');
      }
      const now = Date.now();
      const newPoint: LiveSensorLogPoint = {
        time: new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: now,
        humidity,
        water,
        gas,
        status,
      };
      setLiveStreamGraphData((prev) => {
        const next = [...prev, newPoint];
        const cutoff = now - FIVE_MIN_MS;
        return next.filter((p) => p.timestamp >= cutoff);
      });
      // Optional: push to Supabase when online (ignore errors so demo works offline)
      fetch('/api/live-sensor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, humidity, water, gas, status }),
      }).catch(() => {});
    } catch (e) {
      setLiveStreamError(e instanceof Error ? e.message : 'Failed to fetch device');
    }
  };

  const startLiveStream = () => {
    if (liveStreamIntervalRef.current) return;
    setLiveStreamError(null);
    runLiveStreamTick();
    liveStreamIntervalRef.current = setInterval(runLiveStreamTick, 5000);
    setLiveStreamRunning(true);
  };

  const stopLiveStream = () => {
    if (liveStreamIntervalRef.current) {
      clearInterval(liveStreamIntervalRef.current);
      liveStreamIntervalRef.current = null;
    }
    setLiveStreamRunning(false);
  };

  useEffect(() => {
    if (!liveStreamRunning || activeTab !== 'liveSensors') return;
    return () => {
      if (liveStreamIntervalRef.current) {
        clearInterval(liveStreamIntervalRef.current);
        liveStreamIntervalRef.current = null;
      }
    };
  }, [liveStreamRunning, activeTab]);

  const loadData = async (forceRecalculate: boolean = false) => {
    try {
      const params = new URLSearchParams({ t: Date.now().toString() });
      if (forceRecalculate) {
        params.append('recalculate', 'true');
      }

      // Score and status come ONLY from GET /api/bathrooms (database). No other source.
      const bathroomsRes = await fetch(`/api/bathrooms?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        credentials: 'same-origin',
      });
      const bathroomsData = await bathroomsRes.json();
      if (!bathroomsRes.ok) {
        throw new Error(Array.isArray(bathroomsData) ? undefined : bathroomsData?.error || 'Failed to load bathrooms');
      }
      // Must be array from API; use it as single source of truth for score/status
      let list = Array.isArray(bathroomsData) ? bathroomsData : [];
      if (!Array.isArray(bathroomsData) && bathroomsData && typeof bathroomsData === 'object') {
        console.warn('[admin] GET /api/bathrooms did not return array:', bathroomsData);
      }
      // Don't let refetch (or refresh) overwrite a bathroom we just set to verified_usable or verified_unusable
      const pending = lastVerifiedRef.current;
      if (pending) {
        const idx = list.findIndex((b: Bathroom) => b.id === pending.id);
        if (idx >= 0 && (list[idx].score !== pending.score || list[idx].status !== pending.status)) {
          list = list.slice();
          list[idx] = { ...list[idx], score: pending.score, status: pending.status };
        }
        lastVerifiedRef.current = null;
      }
      // Survive full page refresh: merge from sessionStorage if we just verified and DB hasn't caught up.
      // Only clear sessionStorage when API data already matches (DB caught up) or TTL expired.
      if (typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem(SESSION_KEY_LAST_VERIFIED);
          if (raw) {
            const stored = JSON.parse(raw) as { id: string; score: number; status: Bathroom['status']; at: number };
            if (Date.now() - stored.at < LAST_VERIFIED_TTL_MS) {
              const idx = list.findIndex((b: Bathroom) => b.id === stored.id);
              if (idx >= 0) {
                const matches = list[idx].score === stored.score && list[idx].status === stored.status;
                if (!matches) {
                  list = list.slice();
                  list[idx] = { ...list[idx], score: stored.score, status: stored.status };
                }
                // Only remove when API returned correct data (DB caught up) so refresh shows it without override
                if (matches) sessionStorage.removeItem(SESSION_KEY_LAST_VERIFIED);
              }
            } else {
              sessionStorage.removeItem(SESSION_KEY_LAST_VERIFIED);
            }
          }
        } catch (_) {}
      }
      setBathrooms(list);
      
      const uniqueZones: string[] = Array.from(new Set(bathroomsData.map((b: Bathroom) => b.zone)));
      setZones(uniqueZones);

      const rankingsParams = new URLSearchParams({ t: Date.now().toString() });
      if (selectedZone !== 'all') {
        rankingsParams.append('zone', selectedZone);
      }
      const rankingsRes = await fetch(`/api/rankings?${rankingsParams.toString()}`, {
        cache: 'no-store',
      });
      const rankingsData = await rankingsRes.json();
      setRankings(rankingsData.bathrooms || []);

      const zoneCoverageRes = await fetch(`/api/zone-coverage?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (zoneCoverageRes.ok) {
        const zoneCoverageData = await zoneCoverageRes.json();
        setZoneCoverage(Array.isArray(zoneCoverageData) ? zoneCoverageData : []);
      }

      const maintenanceRes = await fetch(`/api/maintenance?t=${Date.now()}`, {
        cache: 'no-store',
      });
      const maintenanceData = await maintenanceRes.json();
      setMaintenanceRequests(maintenanceData);
    } catch (error) {
      console.error('Error loading data:', error);
      setVerificationMessage('❌ Error refreshing data. Please try again.');
      setTimeout(() => setVerificationMessage(''), 3000);
    }
  };

  const handleVerify = async (usable: boolean) => {
    if (!selectedBathroom) return;

    const wasFlaggedForCheck = selectedBathroom.status === 'flagged';
    const previousStatus = selectedBathroom.status;
    const previousScore = selectedBathroom.score;

    setIsRefreshing(true);
    setVerificationMessage(usable ? '⏳ Marking as usable...' : '⏳ Marking as not usable...');

    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom.id,
          waterAvailable: usable,
          clogged: !usable,
          usable,
          volunteerName: 'Current User',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Verification failed (${response.status})`);
      }

      const markedUnusable = !usable;
      const bathroomId = selectedBathroom.id;
      // Use server-confirmed bathroom state so refresh can show correct data even if DB read is stale
      const confirmed = data.bathroom as { id: string; score: number; status: Bathroom['status'] } | undefined;
      const newScore = confirmed?.score ?? (markedUnusable ? 0 : 3);
      const newStatus = (confirmed?.status ?? (markedUnusable ? 'verified_unusable' : 'verified_usable')) as Bathroom['status'];
      setShowVerificationForm(false);
      setSelectedBathroom(null);

      // Optimistic update: remove from queue immediately (works for both usable and unusable)
      lastVerifiedRef.current = { id: bathroomId, score: newScore, status: newStatus };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(SESSION_KEY_LAST_VERIFIED, JSON.stringify({ id: bathroomId, score: newScore, status: newStatus, at: Date.now() }));
        } catch (_) {}
      }
      setBathrooms((prev) =>
        prev.map((b) =>
          b.id === bathroomId ? { ...b, status: newStatus, score: newScore } : b
        )
      );
      if (markedUnusable) {
        setVerificationMessage('✅ Marked unusable. Opening Maintenance tab...');
        setActiveTab('maintenance');
      } else {
        setVerificationMessage('✅ Marked usable. Bathroom removed from queue.');
      }

      if (markedUnusable) {
        await new Promise(resolve => setTimeout(resolve, 800));
        await loadData(true);
        setVerificationMessage(`✅ ${bathroomId} is now in Unusable Bathrooms. Create a maintenance request below.`);
      } else {
        setVerificationMessage(`✅ ${bathroomId} marked usable (score 3). Removed from verification queue.`);
        // Refetch so UI stays in sync; lastVerifiedUsableRef prevents re-adding to queue if refetch returns stale data
        await new Promise(resolve => setTimeout(resolve, 300));
        await loadData(false);
      }

      // Clear message after 3 seconds
      setTimeout(() => {
        setVerificationMessage('');
        setIsRefreshing(false);
      }, 3000);
    } catch (error) {
      console.error('Error verifying bathroom:', error);
      const msg = error instanceof Error ? error.message : 'Verification failed';
      setVerificationMessage(`❌ ${msg}`);
      setIsRefreshing(false);
      setTimeout(() => setVerificationMessage(''), 5000);
    }
  };

  const handleCreateMaintenance = async (bathroomId: string, issueType: MaintenanceRequest['issueType']) => {
    setSelectedIssueTypeByBathroom((prev) => ({ ...prev, [bathroomId]: issueType }));
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bathroomId, issueType }),
    });
    if (!res.ok) {
      setSelectedIssueTypeByBathroom((prev) => {
        const next = { ...prev };
        delete next[bathroomId];
        return next;
      });
      const err = await res.json().catch(() => ({}));
      setVerificationMessage(`❌ ${err?.error || 'Failed to create request'}`);
      setTimeout(() => setVerificationMessage(''), 3000);
      return;
    }
    setVerificationMessage(`✅ Maintenance request created for ${bathroomId}`);
    setTimeout(() => setVerificationMessage(''), 2000);
    await loadData();
    setSelectedIssueTypeByBathroom((prev) => {
      const next = { ...prev };
      delete next[bathroomId];
      return next;
    });
  };

  const handleUpdateMaintenance = async (id: string, status: MaintenanceRequest['status']) => {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setVerificationMessage(`❌ ${err?.error || 'Failed to update'}`);
      setTimeout(() => setVerificationMessage(''), 3000);
      return;
    }
    if (status === 'resolved') {
      setVerificationMessage('✅ Request resolved. Bathroom marked usable (score 3).');
      setTimeout(() => setVerificationMessage(''), 3000);
    }
    loadData();
  };

  const getStatusBadge = (status: Bathroom['status']) => {
    const styles: Record<string, string> = {
      verified_usable: 'bg-green-100 text-green-800',
      flagged: 'bg-orange-100 text-orange-800',
      verified_unusable: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      verified_usable: '✅ Verified usable',
      flagged: '🚩 Flagged',
      verified_unusable: '❌ Verified unusable',
    };
    const s = status && (status in styles) ? status : 'flagged';
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[s]}`}>
        {labels[s] ?? '🚩 Flagged'}
      </span>
    );
  };

  /** Display score clamped to 0-3 scale (always show as X/3) */
  const displayScore = (score: number) => Math.min(3, Math.max(0, Math.round(Number(score))));

  const getScoreColor = (score: number) => {
    // 0-3 scale: 3 = green, 2 = yellow, 1 = orange, 0 = red
    if (score >= 3) return 'text-green-600';
    if (score >= 2) return 'text-yellow-600';
    if (score >= 1) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCoverageBadge = (status: CoverageStatus) => {
    const map = { adequate: '🟢', strained: '🟡', critical: '🔴' };
    const labels = { adequate: 'Adequate', strained: 'Strained', critical: 'Critical Gap' };
    const colors = {
      adequate: 'bg-green-100 text-green-800 border-green-300',
      strained: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      critical: 'bg-red-100 text-red-800 border-red-300',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold border ${colors[status]}`}>
        {map[status]} {labels[status]}
      </span>
    );
  };

  const getUsageBadge = (b: BathroomWithUsage) => {
    const u = b.usageScore ?? 0;
    const labels: Record<number, string> = { 3: '🔥 High Use', 2: '👣 Moderate', 1: '💤 Low', 0: '❓ Unknown' };
    const colors: Record<number, string> = { 3: 'bg-orange-100 text-orange-800', 2: 'bg-blue-100 text-blue-800', 1: 'bg-gray-100 text-gray-700', 0: 'bg-gray-50 text-gray-500' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[u] ?? colors[0]}`}>
        {labels[u] ?? labels[0]}
      </span>
    );
  };

  // Prioritization queue: need verification = not verified_unusable, not 3/3, and (flagged or score < 3)
  const needsVerification = (b: Bathroom | BathroomWithUsage) =>
    b.status !== 'verified_unusable' &&
    b.score !== 3 &&
    (b.status === 'flagged' || b.score < 3);
  const rankingsById = new Map<string, BathroomWithUsage>(rankings.map((b) => [b.id, b]));
  const byZone = selectedZone === 'all' ? bathrooms : bathrooms.filter((b) => b.zone === selectedZone);
  const queueCandidates = byZone.filter(needsVerification).map((b) => {
    const withUsage = rankingsById.get(b.id);
    const usageScore = typeof (withUsage as BathroomWithUsage)?.usageScore === 'number' ? (withUsage as BathroomWithUsage).usageScore : 0;
    const priority = (3 - (typeof b.score === 'number' ? b.score : 0)) * (usageScore || 1);
    return { ...b, ...(withUsage ? { usageScore, usageLabel: (withUsage as BathroomWithUsage).usageLabel } : {}), priority };
  });
  const sortedQueue = [...queueCandidates].sort((a, b) => b.priority - a.priority);
  const filteredQueue = filterHighUsageLowHealth
    ? sortedQueue.filter((b) => b.score <= 1 && ((b as BathroomWithUsage).usageScore ?? 0) >= 2)
    : sortedQueue;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation Bar */}
      <header className="bg-[#003366] text-white py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">👷 Admin/Volunteer Dashboard</h1>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/public" className="hover:underline">Public</Link>
              <Link href="/residents" className="hover:underline">Residents</Link>
              <Link href="/demo" className="hover:underline">Demo</Link>
              <Link href="/chatbot" className="hover:underline">Chatbot</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Verification Status Message */}
        {verificationMessage && (
          <div className={`mb-4 p-4 rounded-lg ${
            verificationMessage.startsWith('✅') 
              ? 'bg-green-100 text-green-800 border border-green-300' 
              : verificationMessage.startsWith('⏳')
              ? 'bg-blue-100 text-blue-800 border border-blue-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}>
            <p className="font-semibold">{verificationMessage}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {isRefreshing && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 font-semibold">🔄 Refreshing data and recalculating scores...</p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'verification'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              ✅ Verification Queue
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'maintenance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              🔧 Maintenance Dispatch
            </button>
            <button
              onClick={() => setActiveTab('sensors')}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'sensors'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              📊 Sensor Data
            </button>
            <button
              onClick={() => setActiveTab('liveSensors')}
              className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'liveSensors'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              📡 Live Sensor Data
            </button>
          </div>
        </div>

        {/* Verification View */}
        {activeTab === 'verification' && (
          <>
            {/* Zone Coverage Panel (top-level) */}
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">🗺️ Zone Coverage</h2>
              <p className="text-gray-700 mb-4 text-sm">
                Sanitation gaps by zone. Coverage is derived from verified usable toilets and average health score — no surveillance.
              </p>
              {zoneCoverage.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {zoneCoverage.map((z) => (
                      <div
                        key={z.zone}
                        className={`p-4 rounded-lg border-2 ${
                          z.coverageStatus === 'critical'
                            ? 'border-red-200 bg-red-50'
                            : z.coverageStatus === 'strained'
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-900">Zone {z.zone}</span>
                          {getCoverageBadge(z.coverageStatus)}
                        </div>
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">{z.usableBathrooms}/{z.totalBathrooms}</span> usable toilets
                          {' · '}avg score <span className="font-medium">{z.avgHealthScore.toFixed(1)}</span>
                        </div>
                        {z.alerts.length > 0 && (
                          <ul className="mt-2 text-xs text-amber-800 list-disc list-inside">
                            {z.alerts.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                  {zoneCoverage.some((z) => z.alerts.length > 0) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="font-semibold text-amber-900">⚠️ Alerts</p>
                      <ul className="text-sm text-amber-800 list-disc list-inside mt-1">
                        {zoneCoverage
                          .filter((z) => z.alerts.length > 0)
                          .flatMap((z) => z.alerts.map((a) => `Zone ${z.zone}: ${a}`))
                          .map((msg, i) => (
                            <li key={i}>{msg}</li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">Loading zone coverage…</p>
              )}
            </div>

            {/* Zone Filter + High Usage + Low Health filter */}
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="mr-2 font-semibold">Filter by Zone:</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="px-3 py-1 border rounded"
                >
                  <option value="all">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>Zone {zone}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterHighUsageLowHealth}
                  onChange={(e) => setFilterHighUsageLowHealth(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">High Usage + Low Health</span>
              </label>
            </div>

            {/* To-Do List - Bathrooms Needing Verification (sorted by priority, with Usage Badge) */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">📋 Verification Queue</h2>
              <p className="text-gray-700 mb-4">
                Sorted by priority (health gap × usage pressure). Usage is inferred from traffic, sensor volatility, and maintenance — not direct tracking.
              </p>
              {filteredQueue.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">
                    {filterHighUsageLowHealth ? 'No high-usage, low-health bathrooms in queue.' : '🎉 All bathrooms are verified!'}
                  </p>
                  <p>{filterHighUsageLowHealth ? 'Try clearing the filter.' : 'No bathrooms currently need verification.'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredQueue.slice(0, 20).map((bathroom, index) => (
                    <div
                      key={bathroom.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg text-gray-600">#{index + 1}</span>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg">{bathroom.id}</span>
                            {getStatusBadge(bathroom.status)}
                            {getUsageBadge(bathroom as BathroomWithUsage)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>Zone {bathroom.zone}</span>
                            <span>•</span>
                            <span className="capitalize">{bathroom.type}</span>
                            {bathroom.location && (
                              <>
                                <span>•</span>
                                <span>{bathroom.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className={`font-bold text-lg ${getScoreColor(displayScore(bathroom.score))}`}>
                          Score: {displayScore(bathroom.score)}/3
                        </span>
                        {bathroom.lastVerifiedAt && (
                          <span className="text-xs text-gray-500">
                            Last verified: {new Date(bathroom.lastVerifiedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBathroom(bathroom);
                          setShowVerificationForm(true);
                          setVerificationMessage('');
                        }}
                        className="px-6 py-2 text-blue-600 border border-gray-300 rounded hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                        disabled={isRefreshing}
                      >
                        Verify
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Bathrooms Registry (for reference) */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">🚽 All Bathrooms</h2>
              <p className="text-gray-700 mb-4 text-sm">Complete registry of all bathrooms for reference</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-2">ID</th>
                      <th className="text-left p-2">Zone</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Score</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Sensor</th>
                      <th className="text-left p-2">Last Verified</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bathrooms.map(bathroom => (
                      <tr key={bathroom.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-2 font-semibold">{bathroom.id}</td>
                        <td className="p-2">Zone {bathroom.zone}</td>
                        <td className="p-2 capitalize">{bathroom.type}</td>
                        <td className={`p-2 font-bold ${getScoreColor(displayScore(bathroom.score))}`}>
                          {displayScore(bathroom.score)}/3
                        </td>
                        <td className="p-2">{getStatusBadge(bathroom.status)}</td>
                        <td className="p-2">{bathroom.hasSensor ? '✅' : '❌'}</td>
                        <td className="p-2 text-sm">
                          {bathroom.lastVerifiedAt
                            ? new Date(bathroom.lastVerifiedAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => {
                              setSelectedBathroom(bathroom);
                              setShowVerificationForm(true);
                              setVerificationMessage('');
                            }}
                            className="px-3 py-1 text-blue-600 border border-gray-300 rounded text-sm hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isRefreshing}
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Maintenance View */}
        {activeTab === 'sensors' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">📊 Sensor Data Dashboard</h2>
              <p className="text-gray-700 mb-4">
                View sensor readings for a specific day or the past 24 hours for predictive maintenance
              </p>
              
              {/* Bathroom + Date Selector */}
              <div className="mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-semibold mb-2 text-gray-900">Select Bathroom:</label>
                    <select
                      value={selectedSensorBathroom}
                      onChange={(e) => setSelectedSensorBathroom(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    >
                      <option value="">-- Select a bathroom --</option>
                      {bathrooms
                        .filter(b => b.hasSensor)
                        .map(bathroom => (
                          <option key={bathroom.id} value={bathroom.id}>
                            {bathroom.id} - Zone {bathroom.zone} ({bathroom.location || 'No location'})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-900">Date:</label>
                    <input
                      type="date"
                      value={sensorDate}
                      onChange={(e) => setSensorDate(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      setSensorDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:border-gray-500 font-medium whitespace-nowrap"
                  >
                    Today
                  </button>
                  {selectedSensorBathroom && (
                    <button
                      onClick={() => generateSensorData(selectedSensorBathroom)}
                      className="px-4 py-2 text-blue-600 border border-gray-300 rounded hover:border-blue-600 font-semibold whitespace-nowrap"
                    >
                      📊 Load Data
                    </button>
                  )}
                </div>
              </div>

              {loadingSensorData && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading sensor data...</p>
                </div>
              )}

              {!loadingSensorData && sensorData && (
                <>
                  {/* Sensor Filter Checkboxes */}
                  <div className="mb-4 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sensorFilters.gas}
                        onChange={(e) => setSensorFilters({ ...sensorFilters, gas: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Gas (H₂S/NH₃)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sensorFilters.water}
                        onChange={(e) => setSensorFilters({ ...sensorFilters, water: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Water Flow</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sensorFilters.humidity}
                        onChange={(e) => setSensorFilters({ ...sensorFilters, humidity: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Humidity</span>
                    </label>
                  </div>

                  {/* Graph */}
                  {sensorData.graphData && sensorData.graphData.length > 0 ? (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold">
                          Sensor Readings{sensorDate ? ` — ${sensorDate}` : ' (Past 24 Hours)'} — {sensorData.graphData.length} data points
                        </h3>
                        {sensorData.debug && (
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Source: {sensorData.debug.dataSource} | 
                            DB Readings: {sensorData.debug.readingsInLast24h} | 
                            Gas: {sensorData.debug.gasReadingsCount} | 
                            Water: {sensorData.debug.waterReadingsCount} | 
                            Humidity: {sensorData.debug.humidityReadingsCount}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4" style={{ height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            key={`${selectedSensorBathroom}-${sensorData.graphData?.length || 0}-${Date.now()}`}
                            data={sensorData.graphData}
                            onClick={(e: any) => {
                              // Recharts onClick provides activePayload in the event
                              if (e && e.activePayload && e.activePayload.length > 0) {
                                const payload = e.activePayload[0].payload;
                                if (payload && payload.timestamp) {
                                  setSelectedTime(payload.timestamp);
                                }
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              interval="preserveStartEnd"
                            />
                            <YAxis 
                              label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                              domain={[0, 100]}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc', cursor: 'pointer' }}
                              formatter={(value: any, name: string, props: any) => {
                                const payload = props.payload;
                                if (name === 'Gas') return [`${payload?.gas?.toFixed(1) || 'N/A'}%`, 'Gas'];
                                if (name === 'Water') return [`${payload?.water?.toFixed(1) || 'N/A'}%`, 'Water'];
                                if (name === 'Humidity') return [`${payload?.humidity?.toFixed(1) || 'N/A'}%`, 'Humidity'];
                                return [value, name];
                              }}
                              labelFormatter={(label) => {
                                return `Time: ${label}`;
                              }}
                            />
                            <Legend />
                            {sensorFilters.gas && (
                              <Line 
                                type="monotone" 
                                dataKey="gas" 
                                stroke="#ef4444" 
                                strokeWidth={2}
                                name="Gas"
                                dot={{ r: 4, fill: '#ef4444' }}
                                activeDot={{ r: 7, fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2 }}
                              />
                            )}
                            {sensorFilters.water && (
                              <Line 
                                type="monotone" 
                                dataKey="water" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                name="Water"
                                dot={{ r: 4, fill: '#3b82f6' }}
                                activeDot={{ r: 7, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2 }}
                              />
                            )}
                            {sensorFilters.humidity && (
                              <Line 
                                type="monotone" 
                                dataKey="humidity" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                name="Humidity"
                                dot={{ r: 4, fill: '#10b981' }}
                                activeDot={{ r: 7, fill: '#10b981', stroke: '#059669', strokeWidth: 2 }}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        💡 Click on a point in the graph to view readings at that specific time
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                      <p>No sensor data available{sensorDate ? ` for ${sensorDate}` : ' for the past 24 hours'}</p>
                    </div>
                  )}

                  {/* Sensor Reading Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Gas Sensor Card */}
                    <div className="bg-white border-2 border-red-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-red-700">Gas Sensor (H₂S/NH₃)</h4>
                        <span className="text-2xl">💨</span>
                      </div>
                      {selectedTime ? (
                        <>
                          {(() => {
                            // Find closest reading to selected time (within 1 hour)
                            const oneHour = 60 * 60 * 1000;
                            const closest = sensorData.readings.gas
                              .map((r: any) => ({ ...r, diff: Math.abs(r.timestamp - selectedTime) }))
                              .filter((r: any) => r.diff < oneHour)
                              .sort((a: any, b: any) => a.diff - b.diff)[0];
                            
                            return closest ? (
                              <>
                                <p className="text-3xl font-bold text-red-600 mb-1">
                                  {closest.value.toFixed(1)} <span className="text-lg">%</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(closest.timestamp).toLocaleString()}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                                <p className="text-xs text-gray-500">No reading near selected time</p>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          {sensorData.averages.gas !== null ? (
                            <>
                              <p className="text-3xl font-bold text-red-600 mb-1">
                                {sensorData.averages.gas.toFixed(1)} <span className="text-lg">%</span>
                              </p>
                              <p className="text-xs text-gray-500">24h Average</p>
                            </>
                          ) : (
                            <>
                              <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                              <p className="text-xs text-gray-500">No data available</p>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Water Sensor Card */}
                    <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-blue-700">Water Flow</h4>
                        <span className="text-2xl">💧</span>
                      </div>
                      {selectedTime ? (
                        <>
                          {(() => {
                            // Find closest reading to selected time (within 1 hour)
                            const oneHour = 60 * 60 * 1000;
                            const closest = sensorData.readings.water
                              .map((r: any) => ({ ...r, diff: Math.abs(r.timestamp - selectedTime) }))
                              .filter((r: any) => r.diff < oneHour)
                              .sort((a: any, b: any) => a.diff - b.diff)[0];
                            
                            return closest ? (
                              <>
                                <p className="text-3xl font-bold text-blue-600 mb-1">
                                  {closest.value.toFixed(1)} <span className="text-lg">%</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(closest.timestamp).toLocaleString()}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                                <p className="text-xs text-gray-500">No reading near selected time</p>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          {sensorData.averages.water !== null ? (
                            <>
                              <p className="text-3xl font-bold text-blue-600 mb-1">
                                {sensorData.averages.water.toFixed(1)} <span className="text-lg">%</span>
                              </p>
                              <p className="text-xs text-gray-500">24h Average</p>
                            </>
                          ) : (
                            <>
                              <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                              <p className="text-xs text-gray-500">No data available</p>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* Humidity Sensor Card */}
                    <div className="bg-white border-2 border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-green-700">Humidity</h4>
                        <span className="text-2xl">🌫️</span>
                      </div>
                      {selectedTime ? (
                        <>
                          {(() => {
                            // Find closest reading to selected time (within 1 hour)
                            const oneHour = 60 * 60 * 1000;
                            const closest = sensorData.readings.humidity
                              .map((r: any) => ({ ...r, diff: Math.abs(r.timestamp - selectedTime) }))
                              .filter((r: any) => r.diff < oneHour)
                              .sort((a: any, b: any) => a.diff - b.diff)[0];
                            
                            return closest ? (
                              <>
                                <p className="text-3xl font-bold text-green-600 mb-1">
                                  {closest.value.toFixed(1)} <span className="text-lg">%</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(closest.timestamp).toLocaleString()}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                                <p className="text-xs text-gray-500">No reading near selected time</p>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          {sensorData.averages.humidity !== null ? (
                            <>
                              <p className="text-3xl font-bold text-green-600 mb-1">
                                {sensorData.averages.humidity.toFixed(1)} <span className="text-lg">%</span>
                              </p>
                              <p className="text-xs text-gray-500">24h Average</p>
                            </>
                          ) : (
                            <>
                              <p className="text-3xl font-bold text-gray-400 mb-1">N/A</p>
                              <p className="text-xs text-gray-500">No data available</p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reset Selection Button */}
                  {selectedTime && (
                    <div className="mt-4">
                      <button
                        onClick={() => setSelectedTime(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Reset to 24h Average
                      </button>
                    </div>
                  )}
                </>
              )}

              {!loadingSensorData && !sensorData && selectedSensorBathroom && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
                  <p className="font-semibold mb-2">No sensor data available for this bathroom{sensorDate ? ` on ${sensorDate}` : ' in the past 24 hours'}.</p>
                  <p className="text-sm">To generate sensor data, run the SQL function in Supabase:</p>
                  <code className="block mt-2 p-2 bg-yellow-100 rounded text-xs">
                    SELECT generate_sensor_data_for_bathroom('{selectedSensorBathroom}');
                  </code>
                </div>
              )}

              {!selectedSensorBathroom && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
                  <p>Select a bathroom with sensors attached to view sensor data.</p>
                  <p className="text-sm mt-2">Sensor data is pre-loaded via SQL. Use the "Load Data" button to refresh the display.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Sensor Data View - same features as Sensor Data tab + ESP32 live stream */}
        {activeTab === 'liveSensors' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">📡 Live Sensor Data Dashboard</h2>
              <p className="text-gray-700 mb-4">
                Demo: stream from one sensor (ESP32). Graph shows the last 5 minutes only, updated every 5 seconds.
              </p>

              {/* Live device stream: URL + Start/Stop + 5-min graph */}
              <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Live device stream</h3>
                <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device URL (e.g. ESP32 /live)</label>
                    <input
                      type="url"
                      value={liveStreamUrl}
                      onChange={(e) => setLiveStreamUrl(e.target.value)}
                      disabled={liveStreamRunning}
                      placeholder="http://192.168.4.1/live"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  {!liveStreamRunning ? (
                    <button
                      type="button"
                      onClick={startLiveStream}
                      className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
                    >
                      Start (every 5s)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopLiveStream}
                      className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                    >
                      Stop
                    </button>
                  )}
                </div>
                {liveStreamError && (
                  <p className="text-sm text-red-600 mb-3">⚠️ {liveStreamError}</p>
                )}
                {liveStreamGraphData.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Last 5 minutes — updates every 5 seconds</p>
                    <div className="rounded-lg border border-gray-200 bg-white p-2" style={{ height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={liveStreamGraphData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} label={{ value: '%', angle: 0, position: 'insideTopRight' }} />
                          <Tooltip formatter={(value: number) => [value?.toFixed(1) + '%', '']} labelFormatter={(label) => `Time: ${label}`} />
                          <Legend />
                          <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} name="Humidity" dot={false} />
                          <Line type="monotone" dataKey="water" stroke="#3b82f6" strokeWidth={2} name="Water" dot={false} />
                          <Line type="monotone" dataKey="gas" stroke="#ef4444" strokeWidth={2} name="Gas" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            {/* Unusable bathrooms from DB — select issue type to create active request */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">🚨 Unusable Bathrooms</h2>
              <p className="text-gray-600 text-sm mb-4">
                From database. Select an issue type to create an active maintenance request.
              </p>
              {bathrooms.filter(b => b.status === 'verified_unusable').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">✅ No unusable bathrooms</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {bathrooms
                    .filter(b => b.status === 'verified_unusable')
                    .map(bathroom => {
                      const activeRequest = maintenanceRequests.find(
                        req => req.bathroomId === bathroom.id && req.status !== 'resolved'
                      );
                      return (
                        <li
                          key={bathroom.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                        >
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-semibold">{bathroom.id}</span>
                            <span className="text-gray-600">Zone {bathroom.zone}</span>
                            <span className="capitalize text-gray-600">{bathroom.type}</span>
                            {bathroom.location && (
                              <span className="text-gray-500">{bathroom.location}</span>
                            )}
                          </div>
                          {activeRequest ? (
                            <span className="text-sm font-medium text-amber-800 bg-amber-100 px-2 py-1 rounded">
                              Active request — {activeRequest.issueType.replace('_', ' ')}
                            </span>
                          ) : (
                            <select
                              className="px-3 py-1.5 border border-gray-300 rounded bg-white text-sm"
                              value={selectedIssueTypeByBathroom[bathroom.id] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value as MaintenanceRequest['issueType'] | '';
                                if (v) handleCreateMaintenance(bathroom.id, v);
                              }}
                            >
                              <option value="">Select issue type...</option>
                              <option value="plumbing">🔧 Plumbing</option>
                              <option value="water_supply">💧 Water Supply</option>
                              <option value="structural">🏗️ Structural</option>
                              <option value="hygiene_cleaning">🧹 Hygiene / Cleaning</option>
                            </select>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            {/* Active maintenance requests — set status to Resolved to mark bathroom usable (score 3) */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">📋 Active Maintenance Requests</h2>
              <p className="text-gray-600 text-sm mb-4">
                When status is set to Resolved, the bathroom is set to score 3 and verified usable.
              </p>
              {maintenanceRequests.filter(req => req.status !== 'resolved').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No active requests</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {maintenanceRequests
                    .filter(req => req.status !== 'resolved')
                    .map(request => (
                      <li
                        key={request.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                      >
                        <div className="text-sm">
                          <span className="font-semibold">{request.bathroomId}</span>
                          <span className="text-gray-600 ml-2">
                            — {request.issueType.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500 ml-2">
                            ({new Date(request.createdAt).toLocaleString()})
                          </span>
                        </div>
                        <select
                          value={request.status}
                          onChange={(e) =>
                            handleUpdateMaintenance(
                              request.id,
                              e.target.value as MaintenanceRequest['status']
                            )
                          }
                          className="px-3 py-1.5 border border-gray-300 rounded bg-white text-sm"
                        >
                          <option value="not_assigned">⏳ Not Assigned</option>
                          <option value="in_progress">🔨 In Progress</option>
                          <option value="resolved">✅ Resolved</option>
                        </select>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Verification Modal – two options only: Usable or Not usable */}
      {showVerificationForm && selectedBathroom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-2">
              Verify Bathroom {selectedBathroom.id}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              Mark this bathroom as usable or not usable. Flagged bathrooms will be updated accordingly.
            </p>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => handleVerify(true)}
                className="flex-1 py-4 px-4 rounded-lg border-2 border-green-300 bg-green-50 text-green-800 font-semibold hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isRefreshing}
              >
                ✅ Usable
              </button>
              <button
                onClick={() => handleVerify(false)}
                className="flex-1 py-4 px-4 rounded-lg border-2 border-red-300 bg-red-50 text-red-800 font-semibold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isRefreshing}
              >
                ❌ Not usable
              </button>
            </div>
            <button
              onClick={() => {
                setShowVerificationForm(false);
                setSelectedBathroom(null);
                setVerificationMessage('');
              }}
              className="w-full py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              disabled={isRefreshing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-8 pt-6 border-t text-center">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-sm">
          <Link href="/public" className="text-purple-600 hover:underline">📺 Public</Link>
          <span className="text-gray-400">•</span>
          <Link href="/residents" className="text-purple-600 hover:underline">📱 Residents</Link>
          <span className="text-gray-400">•</span>
          <Link href="/demo" className="text-yellow-600 hover:underline">🎬 Demo Mode</Link>
          <span className="text-gray-400">•</span>
          <Link href="/chatbot" className="text-indigo-600 hover:underline">🤖 Chatbot</Link>
          <span className="text-gray-400">•</span>
          <Link href="/" className="text-gray-600 hover:underline">🏠 Home</Link>
        </div>
      </div>
    </div>
  );
}
