'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom } from '@/lib/types';

export default function ResidentDashboard() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [selectedBathroom, setSelectedBathroom] = useState<Bathroom | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    loadBathrooms();
    // Load badge count from localStorage
    const saved = localStorage.getItem('sanoCheckBadgeCount');
    if (saved) {
      setBadgeCount(parseInt(saved, 10));
    }
  }, []);

  const loadBathrooms = async () => {
    const res = await fetch('/api/bathrooms');
    const data = await res.json();
    // Filter to only show usable bathrooms
    const usable = data.filter((b: Bathroom) => b.status === 'usable');
    setBathrooms(usable);
  };

  const handleBathroomClick = (bathroom: Bathroom) => {
    setSelectedBathroom(bathroom);
    setShowConfirmation(true);
    setConfirmationSent(false);
  };

  const handleConfirmation = async (usable: boolean) => {
    if (!selectedBathroom) return;

    await fetch('/api/resident-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bathroomId: selectedBathroom.id,
        signal: usable ? 'usable' : 'unusable',
      }),
    });

    setConfirmationSent(true);
    if (usable) {
      const newCount = badgeCount + 1;
      setBadgeCount(newCount);
      localStorage.setItem('sanoCheckBadgeCount', newCount.toString());
    }
    
    // Reload bathrooms to reflect updated scores
    setTimeout(() => {
      loadBathrooms();
    }, 500);
  };

  const getTypeIcon = (type: Bathroom['type']) => {
    switch (type) {
      case 'male':
        return '🚹';
      case 'female':
        return '🚺';
      case 'accessible':
        return '♿';
      default:
        return '🚽';
    }
  };

  const getDistance = (zone: string) => {
    // Mock distance calculation based on zone
    const distances: Record<string, string> = {
      A: '50m',
      B: '120m',
      C: '200m',
    };
    return distances[zone] || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">👤 Resident Dashboard</h1>
          <Link href="/" className="text-blue-600 hover:underline text-sm">Home</Link>
        </div>

        {/* Community Helper Badge */}
        {badgeCount > 0 && (
          <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 mb-6 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="font-semibold text-gray-800">Community Helper</p>
            <p className="text-sm text-gray-600">You've helped {badgeCount} time{badgeCount !== 1 ? 's' : ''}!</p>
            <p className="text-xs text-gray-500 mt-2">Thank you for keeping our community informed!</p>
          </div>
        )}

        {/* Usable Bathrooms List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            ✅ Verified Usable Bathrooms
          </h2>
          {bathrooms.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              <p>No verified usable bathrooms at this time.</p>
              <p className="text-sm mt-2">Please check back later or contact admin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bathrooms.map(bathroom => (
                <div
                  key={bathroom.id}
                  className="bg-white rounded-lg shadow-md p-4 border-2 border-green-200 hover:border-green-400 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{getTypeIcon(bathroom.type)}</span>
                        <span className="font-bold text-lg">{bathroom.id}</span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                          Verified
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Zone {bathroom.zone} • {bathroom.location || 'Location not specified'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Distance: ~{getDistance(bathroom.zone)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <button
                      onClick={() => handleBathroomClick(bathroom)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                    >
                      I used this bathroom
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-1">💡 How this works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Only verified usable bathrooms are shown</li>
            <li>Tap "I used this bathroom" to confirm status</li>
            <li>Your feedback helps keep the system accurate</li>
          </ul>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && selectedBathroom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            {!confirmationSent ? (
              <>
                <h3 className="text-xl font-semibold mb-4 text-center">
                  Were you able to use bathroom {selectedBathroom.id} just now?
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => handleConfirmation(true)}
                    className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg"
                  >
                    ✅ Yes, it was usable
                  </button>
                  <button
                    onClick={() => handleConfirmation(false)}
                    className="w-full px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-lg"
                  >
                    ❌ No, it was not usable
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedBathroom(null);
                  }}
                  className="w-full mt-3 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-4">🙏</div>
                <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
                <p className="text-gray-600 mb-4">
                  Your feedback has been recorded and will help keep our community informed.
                </p>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    setSelectedBathroom(null);
                    setConfirmationSent(false);
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
