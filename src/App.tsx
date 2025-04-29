import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ChatRoomComponent from './components/ChatRoom'
import Login from './components/Login'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<ChatRoomComponent />} />
      </Routes>
    </Router>
  )
}

export default App
