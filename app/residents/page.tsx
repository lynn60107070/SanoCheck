'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bathroom } from '@/lib/types';
import BathroomMapView from '@/components/BathroomMapView';

const FAVORITES_KEY = 'sanoCheck_residents_favorites';

export default function ResidentsDashboard() {
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [allBathrooms, setAllBathrooms] = useState<Bathroom[]>([]);
  /** All bathrooms from API (for map: green/yellow/red by status) */
  const [allBathroomsForMap, setAllBathroomsForMap] = useState<Bathroom[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [zones, setZones] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [feedbackBathroom, setFeedbackBathroom] = useState<Bathroom | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    loadBathrooms();
    loadFavorites();
    const interval = setInterval(() => {
      loadBathrooms();
    }, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterBathrooms();
  }, [searchQuery, showFavoritesOnly, allBathrooms, favorites]);

  const loadFavorites = () => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const saveFavorites = (newFavorites: Set<string>) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(newFavorites)));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  };

  const toggleFavorite = (bathroomId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(bathroomId)) {
      newFavorites.delete(bathroomId);
    } else {
      newFavorites.add(bathroomId);
    }
    saveFavorites(newFavorites);
  };

  const filterBathrooms = () => {
    let filtered = [...allBathrooms];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(b =>
        b.id.toLowerCase().includes(query) ||
        b.zone.toLowerCase().includes(query) ||
        b.type.toLowerCase().includes(query) ||
        (b.location && b.location.toLowerCase().includes(query))
      );
    }
    if (showFavoritesOnly) {
      filtered = filtered.filter(b => favorites.has(b.id));
    }
    setBathrooms(filtered);
    const uniqueZones: string[] = Array.from(new Set(filtered.map((b: Bathroom) => b.zone)));
    setZones(uniqueZones);
  };

  const loadBathrooms = async () => {
    const res = await fetch(`/api/bathrooms?t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setAllBathroomsForMap(data);
    const usable = data.filter((b: Bathroom) => b.status === 'verified_usable');
    setAllBathrooms(usable);
    setLastUpdated(new Date());
  };

  const getTypeLabel = (type: Bathroom['type']) => {
    switch (type) {
      case 'male':
        return "Men's";
      case 'female':
        return "Women's";
      case 'accessible':
        return 'Accessible';
      default:
        return type;
    }
  };

  const getBathroomsByZone = (zone: string) => {
    return bathrooms.filter(b => b.zone === zone);
  };

  const openFeedback = (bathroom: Bathroom) => {
    setFeedbackBathroom(bathroom);
    setFeedbackMessage(null);
  };

  const closeFeedback = () => {
    setFeedbackBathroom(null);
    setFeedbackMessage(null);
  };

  const submitFeedback = async (feedback: 'good' | 'bad') => {
    if (!feedbackBathroom) return;
    setFeedbackSubmitting(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch('/api/resident-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bathroomId: feedbackBathroom.id, feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackMessage(data.error || 'Something went wrong');
        return;
      }
      setFeedbackMessage(data.message || (feedback === 'good' ? 'Thanks!' : "Thanks. We've flagged this bathroom for volunteer check."));
      if (feedback === 'bad') {
        await loadBathrooms();
      }
      setTimeout(() => closeFeedback(), 2000);
    } catch (e) {
      setFeedbackMessage('Failed to submit. Try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Feedback modal: Was the toilet good or bad? */}
      {feedbackBathroom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Was the toilet good or bad?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {feedbackBathroom.id} — {getTypeLabel(feedbackBathroom.type)}
            </p>
            {feedbackMessage ? (
              <p className="text-gray-700 font-medium">{feedbackMessage}</p>
            ) : (
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => submitFeedback('good')}
                  disabled={feedbackSubmitting}
                  className="flex-1 py-3 px-4 rounded-lg border-2 border-green-300 bg-green-50 text-green-700 font-semibold hover:bg-green-100 disabled:opacity-50"
                  aria-label="Good"
                >
                  👍 Good
                </button>
                <button
                  onClick={() => submitFeedback('bad')}
                  disabled={feedbackSubmitting}
                  className="flex-1 py-3 px-4 rounded-lg border-2 border-red-300 bg-red-50 text-red-700 font-semibold hover:bg-red-100 disabled:opacity-50"
                  aria-label="Bad"
                >
                  👎 Bad
                </button>
              </div>
            )}
            {!feedbackMessage && (
              <button
                onClick={closeFeedback}
                className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <header className="bg-[#003366] text-white py-4">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">🚽 SanoCheck — Residents</h1>
            <nav className="flex gap-4 sm:gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/public" className="hover:underline">Public</Link>
              <Link href="/residents" className="hover:underline font-medium">Residents</Link>
              <Link href="/admin" className="hover:underline">Admin</Link>
              <Link href="/demo" className="hover:underline">Demo</Link>
              <Link href="/chatbot" className="hover:underline">Chatbot</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Usable Bathrooms
          </h1>
          <p className="text-gray-600 mb-2">For residents with phone — same as public display</p>
          {isMounted && lastUpdated && (
            <div className="bg-white rounded-lg shadow-md p-4 inline-block">
              <p className="text-sm text-gray-600">
                Last updated: <span className="font-semibold">{lastUpdated.toLocaleString()}</span>
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Important Notice</p>
              <p className="text-sm text-gray-700">
                This data reflects the state of bathrooms from the past 24 hours.
                Conditions may have changed since the last verification.
                Report any issues to administrators.
              </p>
            </div>
          </div>
        </div>

        {/* Map view: toilets by zone, color by status (Supabase) */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">🗺️ Map — Toilets by zone</h2>
          <p className="text-sm text-gray-600 mb-3">
            Toilets by zone. Colors reflect actual status from the database (green = usable, yellow = flagged, red = not usable).
          </p>
          <BathroomMapView bathrooms={allBathroomsForMap} showLabels />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search-residents" className="block text-sm font-medium text-gray-900 mb-2">
                🔍 Search Bathrooms
              </label>
              <input
                id="search-residents"
                type="text"
                placeholder="Search by ID, zone, type, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-4 py-2 rounded font-semibold transition-colors border ${
                  showFavoritesOnly
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600'
                }`}
              >
                {showFavoritesOnly ? '⭐ Show All' : '⭐ Show Favorites Only'}
              </button>
            </div>
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-700 mt-2">
              Found {bathrooms.length} bathroom{bathrooms.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {zones.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">
              {showFavoritesOnly ? '⭐' : searchQuery ? '🔍' : '🚧'}
            </div>
            <p className="text-xl text-gray-900 mb-2">
              {showFavoritesOnly
                ? 'No favorite bathrooms saved yet'
                : searchQuery
                  ? `No bathrooms found matching "${searchQuery}"`
                  : 'No verified usable bathrooms at this time'}
            </p>
            <p className="text-gray-700">
              {showFavoritesOnly
                ? 'Click the star icon on any bathroom to add it to your favorites'
                : searchQuery
                  ? 'Try a different search term'
                  : 'Please check back later'}
            </p>
            {showFavoritesOnly && (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="mt-4 px-4 py-2 text-blue-600 border border-gray-300 rounded hover:border-blue-600"
              >
                Show All Bathrooms
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 text-blue-600 border border-gray-300 rounded hover:border-blue-600"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {zones.map(zone => {
              const zoneBathrooms = getBathroomsByZone(zone);
              if (zoneBathrooms.length === 0) return null;
              return (
                <div key={zone} className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                    Zone {zone}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {zoneBathrooms.map(bathroom => (
                      <div
                        key={bathroom.id}
                        className="border border-gray-200 rounded-lg p-4 bg-white relative"
                      >
                        <button
                          onClick={() => toggleFavorite(bathroom.id)}
                          className="absolute top-2 right-2 text-2xl hover:scale-110 transition-transform"
                          aria-label={favorites.has(bathroom.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {favorites.has(bathroom.id) ? '⭐' : '☆'}
                        </button>
                        <div className="flex items-center justify-between mb-2 pr-8">
                          <span className="font-bold text-lg text-gray-900">{bathroom.id}</span>
                          <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold">
                            ✅ VERIFIED
                          </span>
                        </div>
                        <p className="text-gray-900 font-semibold mb-1">
                          {getTypeLabel(bathroom.type)}
                        </p>
                        {bathroom.location && (
                          <p className="text-sm text-gray-700">{bathroom.location}</p>
                        )}
                        {bathroom.hasSensor && (
                          <p className="text-xs text-gray-500 mt-2">🔌 Sensor equipped</p>
                        )}
                        <button
                          onClick={() => openFeedback(bathroom)}
                          className="mt-3 w-full py-2 px-3 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
                        >
                          I used this bathroom
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center space-y-4">
          <div className="text-sm text-gray-700">
            <p>This view updates once per day</p>
            <p className="mt-1">
              Contact for maintenance:{' '}
              <a href="tel:+967770755368" className="text-blue-600 hover:underline font-semibold">
                +967 770 755 368
              </a>
            </p>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-sm mb-2">
              <Link href="/public" className="text-blue-600 hover:underline">📺 Public Display</Link>
              <span className="text-gray-400">•</span>
              <Link href="/residents" className="text-blue-600 hover:underline font-medium">📱 Residents</Link>
              <span className="text-gray-400">•</span>
              <Link href="/admin" className="text-blue-600 hover:underline">👷 Admin</Link>
              <span className="text-gray-400">•</span>
              <Link href="/demo" className="text-blue-600 hover:underline">🎬 Demo</Link>
              <span className="text-gray-400">•</span>
              <Link href="/chatbot" className="text-blue-600 hover:underline">🤖 Chatbot</Link>
              <span className="text-gray-400">•</span>
              <Link href="/" className="text-gray-700 hover:underline">🏠 Home</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
