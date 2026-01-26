import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-green-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
          🚽 SanoCheck
        </h1>
        <p className="text-xl text-center mb-12 text-gray-600">
          Smart Sanitation Verification & Dispatch System
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link 
            href="/admin"
            className="p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-blue-200"
          >
            <h2 className="text-2xl font-semibold mb-2">👷 Admin/Volunteer</h2>
            <p className="text-gray-600">Manage bathrooms, verify status, dispatch maintenance</p>
          </Link>
          
          <Link 
            href="/resident"
            className="p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-green-200"
          >
            <h2 className="text-2xl font-semibold mb-2">👤 Resident</h2>
            <p className="text-gray-600">Find usable bathrooms and report status</p>
          </Link>
          
          <Link 
            href="/public"
            className="p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border-2 border-purple-200"
          >
            <h2 className="text-2xl font-semibold mb-2">📺 Public Display</h2>
            <p className="text-gray-600">Read-only view for public spaces</p>
          </Link>
        </div>
        
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link 
            href="/demo"
            className="inline-block px-6 py-3 bg-yellow-400 text-gray-800 font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
          >
            🎬 Demo Mode
          </Link>
          <Link 
            href="/chatbot"
            className="inline-block px-6 py-3 bg-indigo-400 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
          >
            🤖 Chatbot
          </Link>
        </div>
      </div>
    </main>
  )
}
