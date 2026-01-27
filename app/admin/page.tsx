'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom, MaintenanceRequest } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [rankings, setRankings] = useState<Bathroom[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedBathroom, setSelectedBathroom] = useState<Bathroom | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    waterAvailable: true,
    clogged: false,
    usable: true,
  });
  const [zones, setZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'verification' | 'maintenance' | 'sensors'>('verification');
  
  // Sensor data view state
  const [selectedSensorBathroom, setSelectedSensorBathroom] = useState<string>('');
  const [sensorData, setSensorData] = useState<any>(null);
  const [loadingSensorData, setLoadingSensorData] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [sensorFilters, setSensorFilters] = useState({
    gas: true,
    water: true,
    humidity: true,
  });

  useEffect(() => {
    loadData();
  }, [selectedZone]);

  // Load sensor data when bathroom is selected or tab changes
  useEffect(() => {
    if (selectedSensorBathroom && activeTab === 'sensors') {
      loadSensorData(selectedSensorBathroom);
    }
  }, [selectedSensorBathroom, activeTab]);

  const loadSensorData = async (bathroomId: string) => {
    setLoadingSensorData(true);
    setSelectedTime(null); // Reset selected time when loading new data
    try {
      const response = await fetch(`/api/sensor-data/${bathroomId}?t=${Date.now()}`, {
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
      await loadSensorData(bathroomId);
      
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

  const loadData = async (forceRecalculate: boolean = false) => {
    try {
      const params = new URLSearchParams({ t: Date.now().toString() });
      if (forceRecalculate) {
        params.append('recalculate', 'true');
      }
      
      const bathroomsRes = await fetch(`/api/bathrooms?${params.toString()}`, {
        cache: 'no-store',
      });
      const bathroomsData = await bathroomsRes.json();
      setBathrooms(bathroomsData);
      
      const uniqueZones = [...new Set(bathroomsData.map((b: Bathroom) => b.zone))];
      setZones(uniqueZones);

      const rankingsParams = new URLSearchParams({ t: Date.now().toString() });
      if (selectedZone !== 'all') {
        rankingsParams.append('zone', selectedZone);
      }
      const rankingsRes = await fetch(`/api/rankings?${rankingsParams.toString()}`, {
        cache: 'no-store',
      });
      const rankingsData = await rankingsRes.json();
      setRankings(rankingsData.bathrooms);

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

  const handleVerify = async () => {
    if (!selectedBathroom) return;

    // Track if bathroom was flagged or needs recheck before verification
    const wasFlaggedForCheck = selectedBathroom.status === 'flagged' || 
                                selectedBathroom.status === 'flagged';
    const previousStatus = selectedBathroom.status;
    const previousScore = selectedBathroom.score;

    setIsRefreshing(true);
    setVerificationMessage('⏳ Submitting verification...');

    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom.id,
          ...verificationForm,
          volunteerName: 'Current User',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit verification');
      }

      setShowVerificationForm(false);
      setSelectedBathroom(null);

      // Show appropriate message based on previous status
      if (wasFlaggedForCheck) {
        setVerificationMessage('✅ Verification submitted! Recalculating scores and refreshing...');
      } else {
        setVerificationMessage('✅ Verification submitted! Updating...');
      }

      // Wait for backend recalculation to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force recalculation and refresh
      await loadData(true);
      
      // Show success message
      if (wasFlaggedForCheck) {
        setVerificationMessage(`✅ Successfully verified ${selectedBathroom.id}! Status updated from ${previousStatus} (score: ${previousScore}).`);
      } else {
        setVerificationMessage(`✅ Successfully verified ${selectedBathroom.id}!`);
      }

      // Clear message after 3 seconds
      setTimeout(() => {
        setVerificationMessage('');
        setIsRefreshing(false);
      }, 3000);
    } catch (error) {
      console.error('Error verifying bathroom:', error);
      setVerificationMessage('❌ Error submitting verification. Please try again.');
      setIsRefreshing(false);
      setTimeout(() => setVerificationMessage(''), 3000);
    }
  };

  const handleCreateMaintenance = async (bathroomId: string, issueType: MaintenanceRequest['issueType']) => {
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId,
        issueType,
      }),
    });
    await new Promise(resolve => setTimeout(resolve, 1500));
    loadData(true); // Force recalculation
  };

  const handleUpdateMaintenance = async (id: string, status: MaintenanceRequest['status']) => {
    await fetch(`/api/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  const getStatusBadge = (status: Bathroom['status']) => {
    const styles = {
      verified_usable: 'bg-green-100 text-green-800',
      needs_recheck: 'bg-yellow-100 text-yellow-800',
      flagged: 'bg-orange-100 text-orange-800',
      verified_unusable: 'bg-red-100 text-red-800',
    };
    const labels = {
      verified_usable: '✅ Verified usable',
      flagged: '🚩 Flagged',
      verified_unusable: '❌ Verified unusable',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    // 0-3 scale: 3 = green, 2 = yellow, 1 = orange, 0 = red
    if (score >= 3) return 'text-green-600';
    if (score >= 2) return 'text-yellow-600';
    if (score >= 1) return 'text-orange-600';
    return 'text-red-600';
  };

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
          </div>
        </div>

        {/* Verification View */}
        {activeTab === 'verification' && (
          <>
            {/* Zone Filter */}
            <div className="mb-4">
              <label className="mr-2 font-semibold">Filter by Zone:</label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="px-3 py-1 border rounded"
              >
                <option value="all">All Zones</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>Zone {zone}</option>
                ))}
              </select>
            </div>

            {/* To-Do List - Bathrooms Needing Verification */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">📋 Verification Queue</h2>
              <p className="text-gray-700 mb-4">
                Bathrooms that need volunteer verification (flagged or low scores, excluding perfect 3/3 scores)
              </p>
              {rankings.filter(b => 
                b.status !== 'verified_unusable' &&
                b.score !== 3 &&
                (b.status === 'flagged' || b.score < 3)
              ).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">🎉 All bathrooms are verified!</p>
                  <p>No bathrooms currently need verification.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rankings
                    .filter(b => 
                      b.status !== 'verified_unusable' &&
                      b.score !== 3 &&
                      (b.status === 'flagged' || b.score < 3)
                    )
                    .slice(0, 20)
                    .map((bathroom, index) => (
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
                          <span className={`font-bold text-lg ${getScoreColor(bathroom.score)}`}>
                            Score: {bathroom.score}/3
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
                        <td className={`p-2 font-bold ${getScoreColor(bathroom.score)}`}>
                          {bathroom.score}
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
                View sensor readings over the past 24 hours for predictive maintenance
              </p>
              
              {/* Bathroom Selector */}
              <div className="mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1">
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
                          Sensor Readings (Past 24 Hours) - {sensorData.graphData.length} data points
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
                      <p>No sensor data available for the past 24 hours</p>
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
                  <p className="font-semibold mb-2">No sensor data available for this bathroom in the past 24 hours.</p>
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

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            {/* Unusable Bathrooms - Create Maintenance Requests */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">🚨 Unusable Bathrooms</h2>
              <p className="text-gray-700 mb-4">
                Bathrooms marked as unusable that need maintenance dispatch
              </p>
              {bathrooms.filter(b => b.status === 'verified_unusable').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">✅ No unusable bathrooms</p>
                  <p>All bathrooms are currently usable or under review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bathrooms
                    .filter(b => b.status === 'verified_unusable')
                    .map(bathroom => {
                      const hasMaintenanceRequest = maintenanceRequests.some(
                        req => req.bathroomId === bathroom.id && req.status !== 'resolved'
                      );
                      return (
                        <div
                          key={bathroom.id}
                          className="p-4 bg-red-50 border-2 border-red-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-lg">{bathroom.id}</span>
                                {getStatusBadge(bathroom.status)}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <span>Zone {bathroom.zone}</span>
                                <span>•</span>
                                <span className="capitalize">{bathroom.type}</span>
                                <span>•</span>
                                <span className={`font-bold ${getScoreColor(bathroom.score)}`}>
                                  Score: {bathroom.score}/3
                                </span>
                              </div>
                              {bathroom.location && (
                                <p className="text-sm text-gray-600 mt-1">{bathroom.location}</p>
                              )}
                            </div>
                          </div>
                          {hasMaintenanceRequest ? (
                            <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-sm">
                              <p className="text-yellow-800">
                                ⚠️ Maintenance request already exists for this bathroom
                              </p>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-sm font-semibold mb-2 text-gray-700">
                                Create Maintenance Request:
                              </label>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleCreateMaintenance(
                                      bathroom.id,
                                      e.target.value as MaintenanceRequest['issueType']
                                    );
                                    e.target.value = '';
                                  }
                                }}
                                className="px-4 py-2 border rounded w-full max-w-xs bg-white"
                                defaultValue=""
                              >
                                <option value="">Select issue type...</option>
                                <option value="plumbing">🔧 Plumbing</option>
                                <option value="water_supply">💧 Water Supply</option>
                                <option value="structural">🏗️ Structural</option>
                                <option value="hygiene_cleaning">🧹 Hygiene / Cleaning</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Active Maintenance Requests */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">📋 Active Maintenance Requests</h2>
              {maintenanceRequests.filter(req => req.status !== 'resolved').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">✅ No active maintenance requests</p>
                  <p>All maintenance tasks have been completed or resolved.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenanceRequests
                    .filter(req => req.status !== 'resolved')
                    .map(request => {
                      const bathroom = bathrooms.find(b => b.id === request.bathroomId);
                      return (
                        <div
                          key={request.id}
                          className="p-4 bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-lg">
                                  Bathroom: {request.bathroomId}
                                </span>
                                {bathroom && getStatusBadge(bathroom.status)}
                              </div>
                              <div className="space-y-1 text-sm text-gray-600">
                                <p>
                                  <span className="font-semibold">Issue Type:</span>{' '}
                                  {request.issueType.replace('_', ' ')}
                                </p>
                                <p>
                                  <span className="font-semibold">Created:</span>{' '}
                                  {new Date(request.createdAt).toLocaleString()}
                                </p>
                                {bathroom && (
                                  <p>
                                    <span className="font-semibold">Location:</span>{' '}
                                    {bathroom.location || `Zone ${bathroom.zone}`}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <label className="block text-xs font-semibold mb-1 text-gray-700">
                                Status:
                              </label>
                              <select
                                value={request.status}
                                onChange={(e) =>
                                  handleUpdateMaintenance(
                                    request.id,
                                    e.target.value as MaintenanceRequest['status']
                                  )
                                }
                                className="px-3 py-2 border rounded bg-white min-w-[140px]"
                              >
                                <option value="not_assigned">⏳ Not Assigned</option>
                                <option value="in_progress">🔨 In Progress</option>
                                <option value="resolved">✅ Resolved</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Resolved Maintenance Requests (Collapsed) */}
            {maintenanceRequests.filter(req => req.status === 'resolved').length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <details className="cursor-pointer">
                  <summary className="text-xl font-semibold mb-4 list-none">
                    ✅ Resolved Maintenance Requests (
                    {maintenanceRequests.filter(req => req.status === 'resolved').length})
                  </summary>
                  <div className="space-y-2 mt-4">
                    {maintenanceRequests
                      .filter(req => req.status === 'resolved')
                      .map(request => {
                        const bathroom = bathrooms.find(b => b.id === request.bathroomId);
                        return (
                          <div
                            key={request.id}
                            className="p-3 bg-green-50 border border-green-200 rounded text-sm"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-semibold">{request.bathroomId}</span>
                                <span className="text-gray-600 ml-2">
                                  - {request.issueType.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-gray-500 text-xs">
                                Resolved: {request.resolvedAt
                                  ? new Date(request.resolvedAt).toLocaleDateString()
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {showVerificationForm && selectedBathroom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">
              Verify Bathroom {selectedBathroom.id}
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verificationForm.waterAvailable}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, waterAvailable: e.target.checked })
                  }
                />
                Water Available
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verificationForm.clogged}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, clogged: e.target.checked })
                  }
                />
                Clogged
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={verificationForm.usable}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, usable: e.target.checked })
                  }
                />
                Usable
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleVerify}
                className="flex-1 px-4 py-2 text-blue-600 border border-gray-300 rounded hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Submitting...' : 'Submit Verification'}
              </button>
              <button
                onClick={() => {
                  setShowVerificationForm(false);
                  setSelectedBathroom(null);
                  setVerificationMessage('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 disabled:opacity-50"
                disabled={isRefreshing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-8 pt-6 border-t text-center">
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/public" className="text-purple-600 hover:underline">📺 Public Display</Link>
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
