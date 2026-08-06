import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

const floatingVariants = {
  animate: {
    y: [0, -20, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
}

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
}

const swayVariants = {
  animate: {
    rotate: [-2, 2, -2],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
}

const flyVariants = {
  animate: {
    x: [0, 200],
    opacity: [0, 1, 0],
    transition: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mouse parallax tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        })
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const parallaxX = (mousePosition.x - 0.5) * 20
  const parallaxY = (mousePosition.y - 0.5) * 20

  // ─── Auth Handlers ───────────────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleEmailAuth = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else navigate('/')
    }
    setLoading(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #e0f7fa 0%, #fff9c4 50%, #ffe0b2 100%)',
      }}
    >
      {/* ── Background: Clouds ── */}
      <motion.div
        className="absolute top-10 left-10 opacity-80"
        animate={{ x: parallaxX * 0.5, y: parallaxY * 0.3 }}
        transition={{ type: 'spring', stiffness: 100, damping: 30 }}
      >
        <motion.svg width="140" height="85" viewBox="0 0 140 85" fill="none" variants={floatingVariants} animate="animate">
          <path d="M25 55C12 55 5 48 5 35C5 20 18 12 32 12C35 5 43 2 52 2C68 2 80 12 83 28C95 28 110 35 110 50C110 65 95 72 78 72H25Z" fill="#E3F2FD" opacity="0.6" />
          <path d="M20 50C8 50 2 43 2 30C2 15 15 7 30 7C33 0 42 -2 52 -2C70 -2 83 10 86 28C100 28 115 35 115 52C115 68 98 75 78 75H20Z" fill="white" opacity="0.95" />
          <path d="M30 35C30 30 35 28 40 28C42 25 48 23 52 23C58 23 63 26 65 32" stroke="#F0F4FF" strokeWidth="2" fill="none" opacity="0.8" />
        </motion.svg>
      </motion.div>

      <motion.div
        className="absolute top-40 right-20 opacity-75"
        animate={{ x: parallaxX * 0.4, y: parallaxY * 0.5 }}
        transition={{ type: 'spring', stiffness: 100, damping: 30, delay: 0.5 }}
      >
        <motion.svg width="160" height="95" viewBox="0 0 160 95" fill="none" variants={floatingVariants} animate="animate">
          <path d="M35 65C20 65 10 58 10 43C10 25 28 15 48 15C52 6 62 2 73 2C92 2 108 14 112 35C130 35 150 44 150 65C150 82 130 90 105 90H35Z" fill="#B3E5FC" opacity="0.5" />
          <path d="M30 62C12 62 0 54 0 38C0 18 20 8 42 8C46 -2 58 -5 72 -5C93 -5 112 8 117 32C138 32 160 42 160 64C160 82 138 92 110 92H30Z" fill="white" opacity="0.92" />
          <ellipse cx="45" cy="45" rx="8" ry="6" fill="#F0F4FF" opacity="0.6" />
          <ellipse cx="85" cy="50" rx="10" ry="7" fill="#F0F4FF" opacity="0.5" />
        </motion.svg>
      </motion.div>

      {/* ── Background: Sun ── */}
      <motion.div
        className="absolute top-20 left-1/3 -translate-x-1/2"
        animate={{ x: parallaxX * 0.3, y: parallaxY * 0.2 }}
        transition={{ type: 'spring', stiffness: 100, damping: 30 }}
      >
        <motion.svg width="150" height="150" viewBox="0 0 150 150" fill="none" variants={pulseVariants} animate="animate">
          <circle cx="75" cy="75" r="68" fill="none" stroke="#FFEB3B" strokeWidth="2" opacity="0.3" />
          <circle cx="75" cy="75" r="62" fill="none" stroke="#FFD93D" strokeWidth="1.5" opacity="0.4" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180
            return (
              <line key={angle}
                x1={75 + 58 * Math.cos(rad)} y1={75 + 58 * Math.sin(rad)}
                x2={75 + 70 * Math.cos(rad)} y2={75 + 70 * Math.sin(rad)}
                stroke="#FFD93D" strokeWidth="4" strokeLinecap="round" opacity="0.8"
              />
            )
          })}
          <defs>
            <radialGradient id="sunGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#FFEB3B" />
              <stop offset="70%" stopColor="#FFD93D" />
              <stop offset="100%" stopColor="#FFA000" />
            </radialGradient>
          </defs>
          <circle cx="75" cy="75" r="48" fill="url(#sunGradient)" />
          <circle cx="60" cy="65" r="7" fill="#333" />
          <circle cx="90" cy="65" r="7" fill="#333" />
          <circle cx="62" cy="63" r="2.5" fill="white" opacity="0.7" />
          <circle cx="92" cy="63" r="2.5" fill="white" opacity="0.7" />
          <path d="M60 85 Q75 95 90 85" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="75" cy="98" rx="5" ry="4" fill="#FF6B9D" opacity="0.8" />
          <circle cx="50" cy="80" r="5" fill="#FFB6C1" opacity="0.6" />
          <circle cx="100" cy="80" r="5" fill="#FFB6C1" opacity="0.6" />
          <ellipse cx="60" cy="55" rx="12" ry="15" fill="white" opacity="0.3" />
        </motion.svg>
      </motion.div>

      {/* ── Background: Palm Trees ── */}
      <motion.div className="absolute bottom-0 left-5" variants={swayVariants} animate="animate">
        <svg width="100" height="220" viewBox="0 0 100 220" fill="none">
          <defs>
            <linearGradient id="trunkLeft" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A0826D" /><stop offset="50%" stopColor="#8B7355" /><stop offset="100%" stopColor="#6B5344" />
            </linearGradient>
          </defs>
          <rect x="35" y="120" width="30" height="100" fill="url(#trunkLeft)" rx="6" />
          <ellipse cx="20" cy="80" rx="28" ry="38" fill="#1B5E20" transform="rotate(-35 20 80)" opacity="0.9" />
          <ellipse cx="20" cy="80" rx="24" ry="34" fill="#2E7D32" transform="rotate(-35 20 80)" />
          <ellipse cx="80" cy="80" rx="28" ry="38" fill="#1B5E20" transform="rotate(35 80 80)" opacity="0.9" />
          <ellipse cx="80" cy="80" rx="24" ry="34" fill="#2E7D32" transform="rotate(35 80 80)" />
          <ellipse cx="50" cy="60" rx="24" ry="32" fill="#43A047" transform="rotate(0 50 60)" />
          <ellipse cx="50" cy="60" rx="20" ry="28" fill="#4CAF50" transform="rotate(0 50 60)" />
          <ellipse cx="15" cy="100" rx="22" ry="30" fill="#7CB342" transform="rotate(-50 15 100)" />
          <ellipse cx="85" cy="100" rx="22" ry="30" fill="#7CB342" transform="rotate(50 85 100)" />
        </svg>
      </motion.div>

      <motion.div className="absolute bottom-0 right-5" variants={swayVariants} animate="animate">
        <svg width="100" height="220" viewBox="0 0 100 220" fill="none">
          <defs>
            <linearGradient id="trunkRight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A0826D" /><stop offset="50%" stopColor="#8B7355" /><stop offset="100%" stopColor="#6B5344" />
            </linearGradient>
          </defs>
          <rect x="35" y="120" width="30" height="100" fill="url(#trunkRight)" rx="6" />
          <ellipse cx="20" cy="80" rx="28" ry="38" fill="#1B5E20" transform="rotate(-35 20 80)" opacity="0.9" />
          <ellipse cx="20" cy="80" rx="24" ry="34" fill="#2E7D32" transform="rotate(-35 20 80)" />
          <ellipse cx="80" cy="80" rx="28" ry="38" fill="#1B5E20" transform="rotate(35 80 80)" opacity="0.9" />
          <ellipse cx="80" cy="80" rx="24" ry="34" fill="#2E7D32" transform="rotate(35 80 80)" />
          <ellipse cx="50" cy="60" rx="24" ry="32" fill="#43A047" />
          <ellipse cx="50" cy="60" rx="20" ry="28" fill="#4CAF50" />
          <ellipse cx="15" cy="100" rx="22" ry="30" fill="#7CB342" transform="rotate(-50 15 100)" />
          <ellipse cx="85" cy="100" rx="22" ry="30" fill="#7CB342" transform="rotate(50 85 100)" />
        </svg>
      </motion.div>

      {/* ── Background: Seagulls ── */}
      <motion.div className="absolute top-32 left-1/4" variants={flyVariants} animate="animate">
        <svg width="55" height="35" viewBox="0 0 55 35" fill="none">
          <ellipse cx="27" cy="18" rx="8" ry="10" fill="#F5F5F5" />
          <circle cx="27" cy="10" r="6" fill="#F5F5F5" />
          <path d="M32 10 L38 9.5 L37.5 10.5 Z" fill="#FFB84D" />
          <circle cx="30" cy="9" r="1.5" fill="#333" />
          <path d="M22 15 Q10 8 5 18" stroke="#ADADAD" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M32 15 Q44 8 50 18" stroke="#ADADAD" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* ── Background: Fish & Starfish ── */}
      <motion.svg className="absolute bottom-12 left-1/4" width="50" height="50" viewBox="0 0 50 50" fill="none"
        animate={{ y: [0, -5, 0], x: [0, 10, 0] }} transition={{ duration: 4, repeat: Infinity }}>
        <defs>
          <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB74D" /><stop offset="50%" stopColor="#FF9800" /><stop offset="100%" stopColor="#F57C00" />
          </linearGradient>
        </defs>
        <path d="M25 8 L29 17 L38 17 L32 22 L35 31 L25 26 L15 31 L18 22 L12 17 L21 17 Z" fill="url(#starGradient)" />
        <circle cx="25" cy="19" r="2" fill="#FFF9C4" opacity="0.7" />
      </motion.svg>

      <motion.svg className="absolute bottom-8 right-1/3" width="60" height="40" viewBox="0 0 60 40" fill="none"
        animate={{ y: [0, 8, 0], x: [-10, 10, -10] }} transition={{ duration: 5, repeat: Infinity }}>
        <defs>
          <linearGradient id="fishGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF7BAC" /><stop offset="50%" stopColor="#FF6B9D" /><stop offset="100%" stopColor="#F44E6F" />
          </linearGradient>
        </defs>
        <ellipse cx="28" cy="20" rx="16" ry="11" fill="url(#fishGradient)" />
        <ellipse cx="28" cy="23" rx="14" ry="6" fill="#FFB3C6" opacity="0.6" />
        <path d="M44 20 L58 14 L54 20 L58 26 Z" fill="#FF6B9D" />
        <circle cx="14" cy="18" r="6" fill="url(#fishGradient)" />
        <circle cx="11" cy="16" r="2.5" fill="#333" />
        <circle cx="11.5" cy="15" r="1" fill="white" opacity="0.8" />
      </motion.svg>

      {/* Ocean gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#B3E5FC]/40 to-transparent" />

      {/* ── Login Card ── */}
      <motion.div
        className="relative z-10 min-h-screen flex items-center justify-center px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="w-full max-w-md" variants={cardVariants}>
          <div
            className="relative rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="p-8 sm:p-10">
              {/* Logo */}
              <motion.div className="text-center mb-8"
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                <div className="text-4xl mb-3">✈️</div>
                <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00ACC1] via-[#FF9800] to-[#FF6B9D]">
                  Pixinerary
                </h1>
                <p className="text-sm text-gray-600 mt-2 font-medium">Your AI travel companion</p>
              </motion.div>

              {/* Error / Message Banner */}
              {error && (
                <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm text-center">
                  {message}
                </div>
              )}

              {/* Google Button */}
              <motion.button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white mb-5 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #00ACC1 0%, #FF9800 100%)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {loading ? 'Loading...' : 'Continue with Google'}
              </motion.button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-300" />
                <span className="text-sm font-medium text-gray-600">or</span>
                <div className="flex-1 h-px bg-gray-300" />
              </div>

              {/* Sign In / Sign Up Tabs */}
              <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                {['Sign In', 'Sign Up'].map((label, i) => (
                  <motion.button
                    key={label}
                    onClick={() => { setIsSignUp(i === 1); setError(null); setMessage(null) }}
                    className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all duration-300 ${
                      isSignUp === (i === 1)
                        ? 'bg-white shadow-md ' + (i === 0 ? 'text-[#00ACC1]' : 'text-[#FF9800]')
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {label}
                  </motion.button>
                ))}
              </div>

              {/* Email & Password */}
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00ACC1] focus:outline-none transition-all duration-300 bg-white/50 placeholder-gray-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#00ACC1] focus:outline-none transition-all duration-300 bg-white/50 placeholder-gray-500"
                />
              </div>

              {/* Submit */}
              <motion.button
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold text-white mt-6 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #FF6B9D 0%, #FF9800 100%)' }}
                whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(255,107,157,0.4)' }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
              </motion.button>

              {/* Footer */}
              <p className="text-center text-sm text-gray-600 mt-6">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
                  className="font-bold text-[#00ACC1] hover:text-[#FF9800] transition-colors"
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
