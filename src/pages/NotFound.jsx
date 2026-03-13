import { useNavigate } from 'react-router-dom'

export const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-secondary mb-4">404</h1>
        <h2 className="text-4xl font-bold text-white mb-4">Page Not Found</h2>
        <p className="text-gray-300 text-lg mb-8">
          Sorry, the page you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-secondary hover:bg-yellow-400 text-primary font-bold py-3 px-8 rounded-lg transition"
        >
          Go Back Home
        </button>
      </div>
    </div>
  )
}

export default NotFound
