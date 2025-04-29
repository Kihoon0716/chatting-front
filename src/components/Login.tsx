import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    setLoading(true)
    
    if (!username.trim()) {
      setError('사용자 이름을 입력해주세요')
      setLoading(false)
      return
    }
    
    if (isRegister) {
      // 회원가입 로직
      if (!password) {
        setError('비밀번호를 입력해주세요')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다')
        setLoading(false)
        return
      }
      
      try {
        // 회원가입 API 호출
        const response = await axios.post(`${API_URL}/auth/register`, {
          username,
          password
        })
        
        // 성공적으로 회원가입한 후 로그인 모드로 전환
        setIsRegister(false)
        setPassword('')
        setConfirmPassword('')
        setSuccess('회원가입이 완료되었습니다. 로그인해주세요.')
      } catch (err: any) {
        if (err.response && err.response.data && err.response.data.detail) {
          setError(err.response.data.detail)
        } else {
          setError('회원가입 중 오류가 발생했습니다')
        }
      } finally {
        setLoading(false)
      }
    } else {
      // 로그인 로직
      if (!password) {
        setError('비밀번호를 입력해주세요')
        setLoading(false)
        return
      }
      
      try {
        // 로그인 API 호출
        const formData = new URLSearchParams();
        formData.append('grant_type', '');
        formData.append('username', username);
        formData.append('password', password);
        formData.append('scope', '');
        formData.append('client_id', '');
        formData.append('client_secret', '');
        
        const response = await axios.post(`${API_URL}/auth/token`, formData.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        })
        
        // 로그인 성공
        const data = response.data
        localStorage.setItem('username', username)
        localStorage.setItem('token', data.access_token)
        navigate('/chat')
      } catch (err: any) {
        if (err.response && err.response.data && err.response.data.detail) {
          setError(err.response.data.detail)
        } else {
          setError('로그인 중 오류가 발생했습니다')
        }
      } finally {
        setLoading(false)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>{isRegister ? '회원가입' : '로그인'}</h1>
        
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        
        <input
          type="text"
          placeholder="사용자 이름"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        {isRegister && (
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        )}
        
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? '처리 중...' : isRegister ? '가입하기' : '로그인'}
        </button>
        
        <p className="toggle-mode" onClick={() => {
          setIsRegister(!isRegister)
          setError('')
          setSuccess('')
        }}>
          {isRegister ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
        </p>
      </div>
    </div>
  )
}

export default Login