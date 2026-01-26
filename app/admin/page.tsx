'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom, MaintenanceRequest } from '@/lib/types';

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

  useEffect(() => {
    loadData();
  }, [selectedZone]);

  const loadData = async () => {
    const bathroomsRes = await fetch('/api/bathrooms');
    const bathroomsData = await bathroomsRes.json();
    setBathrooms(bathroomsData);
    
    const uniqueZones = [...new Set(bathroomsData.map((b: Bathroom) => b.zone))];
    setZones(uniqueZones);

    const rankingsRes = await fetch(`/api/rankings${selectedZone !== 'all' ? `?zone=${selectedZone}` : ''}`);
    const rankingsData = await rankingsRes.json();
    setRankings(rankingsData.bathrooms);

    const maintenanceRes = await fetch('/api/maintenance');
    const maintenanceData = await maintenanceRes.json();
    setMaintenanceRequests(maintenanceData);
  };

  const handleVerify = async () => {
    if (!selectedBathroom) return;

    await fetch('/api/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom.id,
        ...verificationForm,
        volunteerName: 'Current User',
      }),
    });

    setShowVerificationForm(false);
    setSelectedBathroom(null);
    loadData();
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
    loadData();
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">👷 Admin/Volunteer Dashboard</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

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

        {/* To-Do List */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">📋 Today's To-Do List</h2>
          <div className="space-y-2">
            {rankings.slice(0, 10).map((bathroom, index) => (
              <div
                key={bathroom.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
              >
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg text-gray-600">#{index + 1}</span>
                  <span className="font-semibold">{bathroom.id}</span>
                  <span className="text-sm text-gray-600">Zone {bathroom.zone}</span>
                  <span className={`font-bold ${getScoreColor(bathroom.score)}`}>
                    Score: {bathroom.score}
                  </span>
                  {getStatusBadge(bathroom.status)}
                </div>
                <button
                  onClick={() => {
                    setSelectedBathroom(bathroom);
                    setShowVerificationForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Verify
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Bathroom Registry */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">🚽 Bathroom Registry</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
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
                  <tr key={bathroom.id} className="border-b hover:bg-gray-50">
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
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
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

        {/* Maintenance Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">🔧 Maintenance Dispatch Panel</h2>
          
          {/* Create maintenance for unusable bathrooms */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Create Maintenance Request</h3>
            <div className="space-y-2">
              {bathrooms
                .filter(b => b.status === 'unusable')
                .map(bathroom => (
                  <div key={bathroom.id} className="flex items-center gap-4 p-2 bg-red-50 rounded">
                    <span className="font-semibold">{bathroom.id}</span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleCreateMaintenance(bathroom.id, e.target.value as MaintenanceRequest['issueType']);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-1 border rounded"
                      defaultValue=""
                    >
                      <option value="">Select issue type...</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="water_supply">Water Supply</option>
                      <option value="structural">Structural</option>
                      <option value="hygiene_cleaning">Hygiene / Cleaning</option>
                    </select>
                  </div>
                ))}
            </div>
          </div>

          {/* Existing maintenance requests */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Active Maintenance Requests</h3>
            {maintenanceRequests.length === 0 ? (
              <p className="text-gray-500">No active maintenance requests</p>
            ) : (
              <div className="space-y-2">
                {maintenanceRequests.map(request => {
                  const bathroom = bathrooms.find(b => b.id === request.bathroomId);
                  return (
                    <div key={request.id} className="p-4 bg-gray-50 rounded border">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Bathroom: {request.bathroomId}</p>
                          <p className="text-sm text-gray-600">
                            Issue: {request.issueType.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            Created: {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={request.status}
                            onChange={(e) => handleUpdateMaintenance(request.id, e.target.value as MaintenanceRequest['status'])}
                            className="px-3 py-1 border rounded"
                          >
                            <option value="not_assigned">Not Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Submit Verification
              </button>
              <button
                onClick={() => {
                  setShowVerificationForm(false);
                  setSelectedBathroom(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
