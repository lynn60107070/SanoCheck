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
        const usable = bathrooms.filter((b: any) => b.status === 'usable');
        
        if (usable.length === 0) {
          botResponse = 'Sorry, there are no verified usable bathrooms at this time. Please check back later or contact an administrator.';
        } else {
          const nearest = usable[0]; // Simplified - would use actual location in production
          botResponse = `The nearest verified usable bathroom is ${nearest.id} in Zone ${nearest.zone}. ${nearest.location || ''} It has a health score of ${nearest.score}/100.`;
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
          botResponse = `Today, you should check: ${top3.map((b: any) => `${b.id} (Score: ${b.score})`).join(', ')}. These bathrooms have the lowest health scores and need verification.`;
        }
      } catch (error) {
        botResponse = 'I encountered an error. Please try again later.';
      }
    } else if (lowerInput.includes('report') || lowerInput.includes('broken') || lowerInput.includes('issue')) {
      botResponse = 'I cannot accept reports. Please use the Resident Dashboard to report bathroom status, or contact an administrator for maintenance issues.';
    } else {
      botResponse = 'I can help you find usable bathrooms or check volunteer tasks. Try asking: "Where is the nearest usable toilet?" or "What should I check today?"';
    }

    setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">🤖 Chatbot</h1>
          <Link href="/" className="text-blue-600 hover:underline">← Back to Home</Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
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
                      : 'bg-gray-200 text-gray-800'
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
          <p className="font-semibold mb-2">💡 Note:</p>
          <p>This chatbot is read-only and cannot accept reports. It can help you find usable bathrooms and check volunteer tasks.</p>
        </div>
      </div>
    </div>
  );
}
