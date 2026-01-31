'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Chatbot() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'bot'; content: string }>>([
    { role: 'bot', content: 'Hello! I can help you find usable bathrooms or check volunteer tasks. Ask me: "Where is the nearest usable toilet?" or "What should I check today?"' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    // Simple rule-based responses (read-only, no reports accepted)
    let botResponse = '';

    const lowerInput = userMessage.toLowerCase();

    if (lowerInput.includes('nearest') || lowerInput.includes('nearest toilet') || lowerInput.includes('nearest bathroom') || lowerInput.includes('where')) {
      try {
        const res = await fetch('/api/bathrooms');
        const bathrooms = await res.json();
        const usable = bathrooms.filter((b: any) => b.status === 'verified_usable');
        
        if (usable.length === 0) {
          botResponse = 'Sorry, there are no verified usable bathrooms at this time. Please check back later or contact an administrator.';
        } else {
          const nearest = usable[0]; // Simplified - would use actual location in production
          const score = Math.min(3, Math.max(0, Math.round(Number(nearest.score))));
          botResponse = `The nearest verified usable bathroom is ${nearest.id} in Zone ${nearest.zone}. ${nearest.location || ''} It has a health score of ${score}/3.`;
        }
      } catch (error) {
        botResponse = 'I encountered an error. Please try again later.';
      }
    } else if (lowerInput.includes('check today') || lowerInput.includes('what should') || lowerInput.includes('tasks') || lowerInput.includes('todo')) {
      try {
        const res = await fetch('/api/rankings');
        const data = await res.json();
        const top3 = data.bathrooms.slice(0, 3);
        
        if (top3.length === 0) {
          botResponse = 'There are no bathrooms that need checking at this time.';
        } else {
          botResponse = `Today, you should check: ${top3.map((b: any) => `${b.id} (Score: ${Math.min(3, Math.max(0, Math.round(Number(b.score))))}/3)`).join(', ')}. These bathrooms have the lowest health scores and need verification.`;
        }
      } catch (error) {
        botResponse = 'I encountered an error. Please try again later.';
      }
    } else if (lowerInput.includes('report') || lowerInput.includes('broken') || lowerInput.includes('issue')) {
      botResponse = 'I cannot accept reports. Please contact an administrator for maintenance issues or bathroom status updates.';
    } else {
      botResponse = 'I can help you find usable bathrooms or check volunteer tasks. Try asking: "Where is the nearest usable toilet?" or "What should I check today?"';
    }

    setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation Bar */}
      <header className="bg-[#003366] text-white py-4">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">🤖 Chatbot</h1>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:underline">Home</Link>
              <Link href="/admin" className="hover:underline">Admin</Link>
              <Link href="/public" className="hover:underline">Public</Link>
              <Link href="/residents" className="hover:underline">Residents</Link>
              <Link href="/demo" className="hover:underline">Demo</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <div className="space-y-4 h-96 overflow-y-auto mb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about bathrooms or tasks..."
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              onClick={handleSend}
              className="px-6 py-2 text-blue-600 border border-gray-300 rounded-lg hover:border-blue-600"
            >
              Send
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-700 mb-6">
          <p className="font-semibold mb-2">💡 Note:</p>
          <p>This chatbot is read-only and cannot accept reports. It can help you find usable bathrooms and check volunteer tasks.</p>
        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-gray-200 text-center">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-sm">
            <Link href="/admin" className="text-blue-600 hover:underline">👷 Admin</Link>
            <span className="text-gray-400">•</span>
            <Link href="/public" className="text-blue-600 hover:underline">📺 Public</Link>
            <span className="text-gray-400">•</span>
            <Link href="/residents" className="text-blue-600 hover:underline">📱 Residents</Link>
            <span className="text-gray-400">•</span>
            <Link href="/demo" className="text-blue-600 hover:underline">🎬 Demo</Link>
            <span className="text-gray-400">•</span>
            <Link href="/" className="text-gray-700 hover:underline">🏠 Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
