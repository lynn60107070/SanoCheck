import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header Navigation Bar */}
      <header className="bg-[#003366] text-white py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">🚽 SanoCheck</h1>
            <nav className="flex gap-6 text-sm">
              <Link href="/admin" className="hover:underline">Admin</Link>
              <Link href="/public" className="hover:underline">Public</Link>
              <Link href="/demo" className="hover:underline">Demo</Link>
              <Link href="/chatbot" className="hover:underline">Chatbot</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold mb-4 text-center text-gray-900">
          Smart Sanitation Verification & Dispatch System
        </h1>
        <p className="text-xl text-center mb-12 text-gray-700">
          Verification & prioritization system for bathroom health monitoring
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link 
            href="/admin"
            className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-600 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">👷 Admin/Volunteer</h2>
            <p className="text-gray-700">Manage bathrooms, verify status, dispatch maintenance</p>
          </Link>
          
          <Link 
            href="/public"
            className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-600 transition-colors"
          >
            <h2 className="text-2xl font-semibold mb-2 text-gray-900">📺 Public Display</h2>
            <p className="text-gray-700">Read-only view for public spaces</p>
          </Link>
        </div>
        
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/demo"
              className="inline-block px-6 py-3 text-blue-600 font-semibold border border-gray-300 rounded hover:border-blue-600 transition-colors"
            >
              🎬 Demo Mode
            </Link>
            <Link 
              href="/chatbot"
              className="inline-block px-6 py-3 text-blue-600 font-semibold border border-gray-300 rounded hover:border-blue-600 transition-colors"
            >
              🤖 Chatbot
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
