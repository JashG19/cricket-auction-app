import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="min-h-screen flex items-center justify-center"><h1 className="text-4xl font-bold">Cricket Auction App</h1></div>} />
      </Routes>
    </Router>
  )
}

export default App
