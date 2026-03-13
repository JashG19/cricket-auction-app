import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export const Home = () => {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()

  const handleAdminClick = () => {
    if (isAdmin) {
      navigate('/admin/setup')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg">
      {/* Navigation */}
      <nav className="bg-darkBg bg-opacity-80 backdrop-blur-sm p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-secondary">Cricket Auction</h1>
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-white">{user.email}</span>
              {isAdmin && <span className="bg-secondary text-primary px-3 py-1 rounded text-sm font-bold">Admin</span>}
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold text-white mb-6">Cricket Auction Management</h2>
        <p className="text-xl text-gray-200 mb-12 max-w-2xl mx-auto">
          Manage live cricket auctions with ease. Real-time bidding, team management, and comprehensive analytics.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleAdminClick}
            className="bg-secondary hover:bg-yellow-400 text-primary font-bold py-3 px-8 rounded-lg transition transform hover:scale-105"
          >
            {isAdmin ? 'Go to Admin Panel' : 'Login as Admin'}
          </button>

          <button
            onClick={() => navigate('/auction/demo')}
            className="border-2 border-secondary text-secondary hover:bg-secondary hover:text-primary font-bold py-3 px-8 rounded-lg transition"
          >
            View Live Auction
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white bg-opacity-10 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-white text-center mb-12">Key Features</h3>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10">
              <h4 className="text-2xl font-bold text-secondary mb-3">Live Bidding</h4>
              <p className="text-gray-200">
                Real-time auction with increment-based bidding system controlled by admins
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10">
              <h4 className="text-2xl font-bold text-secondary mb-3">Team Management</h4>
              <p className="text-gray-200">
                Manage teams, budgets, and squad formation in real-time
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10">
              <h4 className="text-2xl font-bold text-secondary mb-3">Player Grouping</h4>
              <p className="text-gray-200">
                Organize players by custom groups with specific bid increments
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-darkBg text-white py-6 text-center">
        <p>&copy; 2026 Cricket Auction App. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default Home
