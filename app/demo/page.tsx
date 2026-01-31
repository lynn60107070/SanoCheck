'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom } from '@/lib/types';

export default function DemoMode() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [selectedBathroom, setSelectedBathroom] = useState<string>('');
  const [gasLevel, setGasLevel] = useState<number>(30);
  const [waterFlow, setWaterFlow] = useState<number>(2.0); // L/min
  const [humidity, setHumidity] = useState<number>(45); // %
  const [simulationResult, setSimulationResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    loadBathrooms();
  }, []);

  const loadBathrooms = async (forceRecalculate: boolean = false) => {
    try {
      setIsLoading(true);
      // Add cache-busting parameter and optionally force recalculation
      const params = new URLSearchParams({
        t: Date.now().toString(),
      });
      if (forceRecalculate) {
        params.append('recalculate', 'true');
      }
      
      const res = await fetch(`/api/bathrooms?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setBathrooms(data);
      setLastUpdate(new Date());
      
      // Only set default on initial load (when selectedBathroom is empty)
      if (data.length > 0 && !selectedBathroom) {
        setSelectedBathroom(data[0].id);
      } else if (selectedBathroom && data.length > 0) {
        // Validate that the selected bathroom still exists in the data
        const bathroomExists = data.some((b: Bathroom) => b.id === selectedBathroom);
        if (!bathroomExists) {
          // If selected bathroom no longer exists, select the first one
          setSelectedBathroom(data[0].id);
        }
        // Otherwise, keep the current selection
      }
    } catch (error) {
      console.error('Error loading bathrooms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const simulateGasReading = async () => {
    if (!selectedBathroom) return;
    
    setSimulationResult(`⏳ Processing gas reading of ${gasLevel} ppm for ${selectedBathroom}...`);
    
    try {
      const response = await fetch('/api/sensor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom,
          sensorType: 'gas',
          gasType: 'H2S',
          value: gasLevel,
          unit: 'ppm',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit sensor reading');
      }
      
      setSimulationResult(`✅ Simulated gas reading: ${gasLevel} ppm (H2S) for ${selectedBathroom}. Refreshing scores...`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadBathrooms(true); // Force recalculation
      
      setSimulationResult(`✅ Updated! Check the scores below.`);
      setTimeout(() => {
        setSimulationResult('');
      }, 2000);
    } catch (error) {
      setSimulationResult(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process sensor reading'}`);
      setTimeout(() => setSimulationResult(''), 3000);
    }
  };

  const simulateWaterReading = async () => {
    if (!selectedBathroom) return;
    
    setSimulationResult(`⏳ Processing water flow reading of ${waterFlow} L/min for ${selectedBathroom}...`);
    
    try {
      const response = await fetch('/api/sensor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom,
          sensorType: 'water',
          value: waterFlow,
          unit: 'L/min',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit sensor reading');
      }
      
      setSimulationResult(`✅ Simulated water flow: ${waterFlow} L/min for ${selectedBathroom}. Refreshing scores...`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadBathrooms(true); // Force recalculation
      
      setSimulationResult(`✅ Updated! Check the scores below.`);
      setTimeout(() => {
        setSimulationResult('');
      }, 2000);
    } catch (error) {
      setSimulationResult(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process sensor reading'}`);
      setTimeout(() => setSimulationResult(''), 3000);
    }
  };

  const simulateHumidityReading = async () => {
    if (!selectedBathroom) return;
    
    setSimulationResult(`⏳ Processing humidity reading of ${humidity}% for ${selectedBathroom}...`);
    
    try {
      const response = await fetch('/api/sensor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom,
          sensorType: 'humidity',
          value: humidity,
          unit: '%',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit sensor reading');
      }
      
      setSimulationResult(`✅ Simulated humidity: ${humidity}% for ${selectedBathroom}. Refreshing scores...`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadBathrooms(true); // Force recalculation
      
      setSimulationResult(`✅ Updated! Check the scores below.`);
      setTimeout(() => {
        setSimulationResult('');
      }, 2000);
    } catch (error) {
      setSimulationResult(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process sensor reading'}`);
      setTimeout(() => setSimulationResult(''), 3000);
    }
  };

  const simulateTimeDecay = async () => {
    if (!selectedBathroom) return;
    
    setSimulationResult(`⏳ Processing time decay (5 days)...`);
    
    try {
      const response = await fetch('/api/demo/time-decay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 5,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to simulate time decay');
      }
      
      setSimulationResult(`✅ Simulated time decay: Advanced all bathrooms by 5 days. Refreshing scores...`);
      
      // Longer delay for time decay as it affects all bathrooms
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadBathrooms(true); // Force recalculation
      
      setSimulationResult(`✅ Updated! Check the scores below.`);
      setTimeout(() => {
        setSimulationResult('');
      }, 2000);
    } catch (error) {
      setSimulationResult(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process time decay'}`);
      setTimeout(() => setSimulationResult(''), 3000);
    }
  };

  const simulateVolunteerVerification = async (usable: boolean, waterAvailable: boolean, clogged: boolean) => {
    if (!selectedBathroom) return;
    
    const status = usable ? 'usable' : 'unusable';
    setSimulationResult(`⏳ Processing volunteer verification: Marking as ${status}...`);
    
    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bathroomId: selectedBathroom,
          waterAvailable,
          clogged,
          usable,
          volunteerName: 'Demo Volunteer',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit verification');
      }
      
      setSimulationResult(`✅ Simulated volunteer verification: Marked as ${status} for ${selectedBathroom}. Refreshing scores...`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await loadBathrooms(true); // Force recalculation
      
      setSimulationResult(`✅ Updated! Check the scores below.`);
      setTimeout(() => {
        setSimulationResult('');
      }, 2000);
    } catch (error) {
      setSimulationResult(`❌ Error: ${error instanceof Error ? error.message : 'Failed to process verification'}`);
      setTimeout(() => setSimulationResult(''), 3000);
    }
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

  const displayScore = (score: number) => Math.min(3, Math.max(0, Math.round(Number(score))));

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
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">🎬 Demo Mode</h1>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/admin" className="hover:underline">Admin</Link>
              <Link href="/public" className="hover:underline">Public</Link>
              <Link href="/residents" className="hover:underline">Residents</Link>
              <Link href="/chatbot" className="hover:underline">Chatbot</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-900 mb-2">🎯 Demo Mode Instructions</p>
              <p className="text-sm text-gray-700">
                Use the controls below to simulate events and watch the system respond. 
                Scores will recalculate automatically, to-do lists will reorder, and statuses will update.
              </p>
            </div>
            <div className="text-right">
              {isMounted && lastUpdate && (
                <p className="text-xs text-gray-500">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {simulationResult && (
          <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
            <p className="text-gray-900 font-semibold">{simulationResult}</p>
          </div>
        )}

        {/* Simulation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Bathroom Selection */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Select Bathroom</h2>
            <select
              value={selectedBathroom}
              onChange={(e) => setSelectedBathroom(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              {bathrooms.map(bathroom => (
                <option key={bathroom.id} value={bathroom.id}>
                  {bathroom.id} - Zone {bathroom.zone} (Score: {displayScore(bathroom.score)}/3)
                </option>
              ))}
            </select>
          </div>

          {/* Gas Level Input */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Gas Sensor (H2S/NH3)</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={gasLevel}
                onChange={(e) => setGasLevel(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-semibold w-16 text-center">{gasLevel} ppm</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Threshold: 50 ppm (above = penalty)
            </p>
          </div>

          {/* Water Flow Input */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Water Flow Sensor</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={waterFlow}
                onChange={(e) => setWaterFlow(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="font-semibold w-20 text-center">{waterFlow.toFixed(1)} L/min</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Threshold: &lt;0.5 L/min = no water
            </p>
          </div>

          {/* Humidity Input */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Humidity Sensor</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={humidity}
                onChange={(e) => setHumidity(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-semibold w-16 text-center">{humidity}%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Optimal: 30-60% (outside = penalty)
            </p>
          </div>
        </div>

        {/* Simulation Buttons */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Simulation Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={simulateGasReading}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              🌡️ Gas: {gasLevel} ppm
            </button>
            <button
              onClick={simulateWaterReading}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              💧 Water: {waterFlow.toFixed(1)} L/min
            </button>
            <button
              onClick={simulateHumidityReading}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              💨 Humidity: {humidity}%
            </button>
            <button
              onClick={simulateTimeDecay}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              ⏰ Simulate Time Decay (+5 days)
            </button>
            <button
              onClick={() => simulateVolunteerVerification(true, true, false)}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              ✅ Volunteer: Usable
            </button>
            <button
              onClick={() => simulateVolunteerVerification(false, false, true)}
              className="px-4 py-3 text-gray-900 border border-gray-300 rounded-lg hover:border-blue-600 font-semibold"
            >
              ❌ Volunteer: Unusable (No Water + Clogged)
            </button>
          </div>
        </div>

        {/* Current State Display */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Current Bathroom States</h2>
            <button
              onClick={() => loadBathrooms()}
              disabled={isLoading}
              className="px-3 py-1 text-blue-600 border border-gray-300 rounded text-sm hover:border-blue-600 disabled:opacity-50"
            >
              {isLoading ? '🔄 Refreshing...' : '🔄 Refresh Now'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Zone</th>
                  <th className="text-left p-2">Score</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {bathrooms.map(bathroom => (
                  <tr
                    key={bathroom.id}
                    className={`border-b border-gray-200 ${bathroom.id === selectedBathroom ? 'bg-gray-50' : ''}`}
                  >
                    <td className="p-2 font-semibold">{bathroom.id}</td>
                    <td className="p-2">Zone {bathroom.zone}</td>
                    <td className={`p-2 font-bold ${getScoreColor(displayScore(bathroom.score))}`}>
                      {displayScore(bathroom.score)}/3
                    </td>
                    <td className="p-2">{getStatusBadge(bathroom.status)}</td>
                    <td className="p-2 text-sm">
                      {bathroom.lastVerifiedAt
                        ? new Date(bathroom.lastVerifiedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-sm">
            <Link href="/admin" className="text-blue-600 hover:underline">👷 Admin</Link>
            <span className="text-gray-400">•</span>
            <Link href="/public" className="text-blue-600 hover:underline">📺 Public</Link>
            <span className="text-gray-400">•</span>
            <Link href="/residents" className="text-blue-600 hover:underline">📱 Residents</Link>
            <span className="text-gray-400">•</span>
            <Link href="/chatbot" className="text-blue-600 hover:underline">🤖 Chatbot</Link>
            <span className="text-gray-400">•</span>
            <Link href="/" className="text-gray-700 hover:underline">🏠 Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
