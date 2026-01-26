'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom } from '@/lib/types';

export default function DemoMode() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [selectedBathroom, setSelectedBathroom] = useState<string>('');
  const [gasLevel, setGasLevel] = useState<number>(30);
  const [simulationResult, setSimulationResult] = useState<string>('');

  useEffect(() => {
    loadBathrooms();
  }, []);

  const loadBathrooms = async () => {
    const res = await fetch('/api/bathrooms');
    const data = await res.json();
    setBathrooms(data);
    if (data.length > 0 && !selectedBathroom) {
      setSelectedBathroom(data[0].id);
    }
  };

  const simulateResidentUnusable = async () => {
    if (!selectedBathroom) return;
    
    await fetch('/api/resident-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom,
        signal: 'unusable',
      }),
    });
    
    setSimulationResult(`✅ Simulated resident "unusable" signal for ${selectedBathroom}`);
    setTimeout(() => {
      loadBathrooms();
      setSimulationResult('');
    }, 1000);
  };

  const simulateResidentUsable = async () => {
    if (!selectedBathroom) return;
    
    await fetch('/api/resident-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom,
        signal: 'usable',
      }),
    });
    
    setSimulationResult(`✅ Simulated resident "usable" signal for ${selectedBathroom}`);
    setTimeout(() => {
      loadBathrooms();
      setSimulationResult('');
    }, 1000);
  };

  const simulateGasSpike = async () => {
    if (!selectedBathroom) return;
    
    await fetch('/api/sensor-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom,
        gasLevel: gasLevel,
      }),
    });
    
    setSimulationResult(`✅ Simulated gas reading of ${gasLevel} for ${selectedBathroom}`);
    setTimeout(() => {
      loadBathrooms();
      setSimulationResult('');
    }, 1000);
  };

  const simulateTimeDecay = async () => {
    // This would normally be done server-side, but for demo we'll simulate by
    // creating an old verification
    if (!selectedBathroom) return;
    
    const daysAgo = 5;
    const oldTimestamp = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    
    await fetch('/api/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom,
        waterAvailable: true,
        clogged: false,
        usable: true,
        timestamp: oldTimestamp,
        volunteerName: 'Demo Mode',
      }),
    });
    
    setSimulationResult(`✅ Simulated time decay: Set verification to ${daysAgo} days ago for ${selectedBathroom}`);
    setTimeout(() => {
      loadBathrooms();
      setSimulationResult('');
    }, 1000);
  };

  const simulateVolunteerVerification = async (usable: boolean, waterAvailable: boolean, clogged: boolean) => {
    if (!selectedBathroom) return;
    
    await fetch('/api/verification', {
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
    
    const status = usable ? 'usable' : 'unusable';
    setSimulationResult(`✅ Simulated volunteer verification: Marked as ${status} for ${selectedBathroom}`);
    setTimeout(() => {
      loadBathrooms();
      setSimulationResult('');
    }, 1000);
  };

  const getStatusBadge = (status: Bathroom['status']) => {
    const styles = {
      usable: 'bg-green-100 text-green-800',
      needs_check: 'bg-yellow-100 text-yellow-800',
      flagged: 'bg-orange-100 text-orange-800',
      unusable: 'bg-red-100 text-red-800',
    };
    const labels = {
      usable: '✅ Verified usable',
      needs_check: '⚠️ Needs recheck',
      flagged: '🚩 Flagged',
      unusable: '❌ Verified unusable',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">🎬 Demo Mode</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 mb-6">
          <p className="font-semibold text-gray-800 mb-2">🎯 Demo Mode Instructions</p>
          <p className="text-sm text-gray-700">
            Use the controls below to simulate events and watch the system respond. 
            Scores will recalculate automatically, to-do lists will reorder, and statuses will update.
          </p>
        </div>

        {simulationResult && (
          <div className="bg-green-100 border border-green-400 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">{simulationResult}</p>
          </div>
        )}

        {/* Simulation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Bathroom Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Select Bathroom</h2>
            <select
              value={selectedBathroom}
              onChange={(e) => setSelectedBathroom(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              {bathrooms.map(bathroom => (
                <option key={bathroom.id} value={bathroom.id}>
                  {bathroom.id} - Zone {bathroom.zone} (Score: {bathroom.score})
                </option>
              ))}
            </select>
          </div>

          {/* Gas Level Input */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Gas Level (for sensor simulation)</h2>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={gasLevel}
                onChange={(e) => setGasLevel(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="font-semibold w-16 text-center">{gasLevel}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Threshold: 50 (values above trigger penalty)
            </p>
          </div>
        </div>

        {/* Simulation Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Simulation Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={simulateResidentUnusable}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              🚨 Resident Reports Unusable
            </button>
            <button
              onClick={simulateResidentUsable}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              ✅ Resident Confirms Usable
            </button>
            <button
              onClick={simulateGasSpike}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
            >
              🌡️ Simulate Gas Reading ({gasLevel})
            </button>
            <button
              onClick={simulateTimeDecay}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
            >
              ⏰ Simulate Time Decay (+5 days)
            </button>
            <button
              onClick={() => simulateVolunteerVerification(true, true, false)}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              ✅ Volunteer: Usable
            </button>
            <button
              onClick={() => simulateVolunteerVerification(false, false, true)}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              ❌ Volunteer: Unusable (No Water + Clogged)
            </button>
          </div>
        </div>

        {/* Current State Display */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Current Bathroom States</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
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
                    className={`border-b ${bathroom.id === selectedBathroom ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="p-2 font-semibold">{bathroom.id}</td>
                    <td className="p-2">Zone {bathroom.zone}</td>
                    <td className={`p-2 font-bold ${getScoreColor(bathroom.score)}`}>
                      {bathroom.score}
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

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-semibold"
          >
            View Admin Dashboard
          </Link>
          <Link
            href="/resident"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center font-semibold"
          >
            View Resident Dashboard
          </Link>
          <Link
            href="/public"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center font-semibold"
          >
            View Public Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
