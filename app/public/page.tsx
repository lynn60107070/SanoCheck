'use client';

import { useEffect, useState } from 'react';
import { Bathroom } from '@/lib/types';

export default function PublicDashboard() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    loadBathrooms();
    // Update once per day (or on manual refresh)
    const interval = setInterval(() => {
      loadBathrooms();
    }, 24 * 60 * 60 * 1000); // 24 hours

    return () => clearInterval(interval);
  }, []);

  const loadBathrooms = async () => {
    const res = await fetch('/api/bathrooms');
    const data = await res.json();
    // Filter to only show usable bathrooms
    const usable = data.filter((b: Bathroom) => b.status === 'usable');
    setBathrooms(usable);
    setLastUpdated(new Date());
    
    const uniqueZones = [...new Set(usable.map((b: Bathroom) => b.zone))];
    setZones(uniqueZones);
  };

  const getTypeLabel = (type: Bathroom['type']) => {
    switch (type) {
      case 'male':
        return 'Men\'s';
      case 'female':
        return 'Women\'s';
      case 'accessible':
        return 'Accessible';
      default:
        return type;
    }
  };

  const getBathroomsByZone = (zone: string) => {
    return bathrooms.filter(b => b.zone === zone);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🚽 SanoCheck
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Verified Usable Bathrooms
          </p>
          <div className="bg-white rounded-lg shadow-md p-4 inline-block">
            <p className="text-sm text-gray-600">
              Last updated: <span className="font-semibold">{lastUpdated.toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* Zone-based List */}
        {zones.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <p className="text-xl text-gray-600 mb-2">No verified usable bathrooms at this time</p>
            <p className="text-gray-500">Please check back later</p>
          </div>
        ) : (
          <div className="space-y-6">
            {zones.map(zone => {
              const zoneBathrooms = getBathroomsByZone(zone);
              if (zoneBathrooms.length === 0) return null;

              return (
                <div key={zone} className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
                    Zone {zone}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {zoneBathrooms.map(bathroom => (
                      <div
                        key={bathroom.id}
                        className="border-2 border-green-200 rounded-lg p-4 bg-green-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-lg">{bathroom.id}</span>
                          <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">
                            ✅ VERIFIED
                          </span>
                        </div>
                        <p className="text-gray-700 font-semibold mb-1">
                          {getTypeLabel(bathroom.type)}
                        </p>
                        {bathroom.location && (
                          <p className="text-sm text-gray-600">{bathroom.location}</p>
                        )}
                        {bathroom.hasSensor && (
                          <p className="text-xs text-gray-500 mt-2">🔌 Sensor equipped</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>This display updates once per day</p>
          <p className="mt-1">For real-time information, visit the Resident Dashboard</p>
        </div>
      </div>
    </div>
  );
}
