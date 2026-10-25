import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plane,
  Sparkles,
  MapPin,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  AlertCircle,
  Compass,
  Camera,
  Ticket,
  PlaneTakeoff
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import { fetchSystemDefaultRole, saveUserRole } from '@/api/blindEvalApi'
import {
  MARQUEE_COLUMN_ONE,
  MARQUEE_COLUMN_TWO
} from '@/data/attractionsData'
import './Login.css'

interface WallpaperTheme {
  id: string
  label: string
  labelTh: string
  icon: string
  image: string
  timeRange?: string
}

const WALLPAPER_THEMES: Record<string, WallpaperTheme> = {
  summer: {
    id: 'summer',
    label: 'Summer',
    labelTh: 'ซัมเมอร์สดใส',
    icon: '☀️',
    image: '/attraction/Iconic_01summer.jpg',
    timeRange: '06:00 - 16:00'
  },
  spring: {
    id: 'spring',
    label: 'Spring',
    labelTh: 'วสันต์เบ่งบาน',
    icon: '🌸',
    image: '/attraction/Iconic_02spring.jpg',
    timeRange: 'Spring Morning'
  },
  sunset: {
    id: 'sunset',
    label: 'Golden Sunset',
    labelTh: 'อาทิตย์อัสดง',
    icon: '🌅',
    image: '/attraction/Iconic_05orange.jpg',
    timeRange: '16:00 - 18:30'
  },
  winter: {
    id: 'winter',
    label: 'Winter Snow',
    labelTh: 'เหมันต์ขาวโพลน',
    icon: '❄️',
    image: '/attraction/Iconic_01winter.jpg',
    timeRange: 'Winter Wonderland'
  },
  twilight: {
    id: 'twilight',
    label: 'Twilight & Night',
    labelTh: 'ราตรีทไวไลท์',
    icon: '🌌',
    image: '/attraction/Iconic_04purple.jpg',
    timeRange: '18:30 - 06:00'
  }
}

// Calculate automatic theme based on current hour
function getAutoThemeKey(): string {
  const hour = new Date().getHours()
  const minute = new Date().getMinutes()
  const time = hour + minute / 60

  if (time >= 6 && time < 16) {
    return 'summer'
  }
  if (time >= 16 && time < 18.5) {
    return 'sunset'
  }
  return 'twilight'
}

export default function Login() {
  const navigate = useNavigate()
  const { user, loading: authLoading, loginAsGuest } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // ── Gimmick States ──
  const [isFlashing, setIsFlashing] = useState(false)
  const [isTakingOff, setIsTakingOff] = useState(false)

  // ── Dynamic Wallpaper State (Option 1.1 + 1.2 + 1.3) ──
  const [themeMode, setThemeMode] = useState<'auto' | string>('auto')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Determine active wallpaper
  const activeThemeKey = useMemo(() => {
    return themeMode === 'auto' ? getAutoThemeKey() : themeMode
  }, [themeMode])

  const activeTheme = WALLPAPER_THEMES[activeThemeKey] || WALLPAPER_THEMES.summer

  // Mouse Parallax movement handler
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = e
    const { innerWidth, innerHeight } = window
    const x = (clientX / innerWidth - 0.5) * 2 // -1 to 1
    const y = (clientY / innerHeight - 0.5) * 2 // -1 to 1
    setMousePos({ x, y })
  }, [])

  const isSignUp = mode === 'signup'

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

  const triggerCameraFlash = () => {
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 600)
  }

  const handleGuestLogin = () => {
    setIsTakingOff(true)
    setTimeout(() => {
      loginAsGuest()
      navigate('/', { replace: true })
    }, 850)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const sysRole = await fetchSystemDefaultRole()
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: sysRole,
              full_name: email.split('@')[0],
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        })
        if (error) throw error

        await saveUserRole({
          email,
          role: sysRole,
          name: email.split('@')[0],
        }).catch(() => {})

        if (data?.session) {
          setIsTakingOff(true)
          setTimeout(() => navigate('/'), 850)
        } else {
          setMessage('ระบบได้ส่งลิงก์ยืนยันไปยังอีเมลของคุณแล้ว (โปรดตรวจสอบในกล่องจดหมาย หรือโฟลเดอร์ Spam / ขยะ)')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setIsTakingOff(true)
        setTimeout(() => navigate('/'), 850)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`
      })
      if (error) throw error
      setMessage('Password reset instructions have been sent to your email.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pixinerary-shell" onMouseMove={handleMouseMove}>
      {/* ── Dynamic Panoramic Wallpaper Layer (Ken Burns + Mouse Parallax + Semi-Transparent) ── */}
      <div className="panoramic-wallpaper-container" aria-hidden="true">
        <div className="panoramic-wallpaper-kenburns">
          <div
            className="panoramic-wallpaper-image"
            style={{
              backgroundImage: `url(${activeTheme.image})`,
              transform: `translate3d(${mousePos.x * -35}px, ${mousePos.y * -24}px, 0)`,
            }}
          />
        </div>
        <div className="panoramic-wallpaper-overlay" />
      </div>

      {/* Pixo Camera Flash Overlay */}
      {isFlashing && <div className="camera-flash-screen" aria-hidden="true" />}

      {/* Ambient glow backgrounds */}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="ambient ambient-three" />

      {/* ── Center Soft Blend Feather (Extra Ambient Glow & Seamless Diffusion) ── */}
      <div className="center-blend-feather" aria-hidden="true" />

      {/* ── Left Showcase Panel ── */}
      <section className="showcase-panel">
        {/* Softly feathered backdrop layer */}
        <div className="showcase-backdrop" aria-hidden="true" />

        <div className="showcase-header">
          <header className="brand brand-light">
            <span className="brand-icon">
              <Plane size={18} />
            </span>
            pixinerary
          </header>

          {/* ── Wallpaper Theme & Time-of-Day Switcher (Flat & Minimal) ── */}
          <div className="wallpaper-theme-bar" role="group" aria-label="Wallpaper theme selection">
            <span className="theme-status-tag">
              {themeMode === 'auto' ? `Auto · ${activeTheme.label}` : activeTheme.label}
            </span>

            <div className="theme-pills-wrap">
              <button
                type="button"
                className={`theme-pill ${themeMode === 'auto' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('auto')}
                title={`Auto time-of-day sync (${activeTheme.label})`}
              >
                Auto
              </button>
              <button
                type="button"
                className={`theme-pill ${themeMode === 'summer' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('summer')}
                title="Summer theme"
              >
                Summer
              </button>
              <button
                type="button"
                className={`theme-pill ${themeMode === 'spring' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('spring')}
                title="Spring theme"
              >
                Spring
              </button>
              <button
                type="button"
                className={`theme-pill ${themeMode === 'sunset' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('sunset')}
                title="Sunset theme"
              >
                Sunset
              </button>
              <button
                type="button"
                className={`theme-pill ${themeMode === 'winter' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('winter')}
                title="Winter theme"
              >
                Winter
              </button>
              <button
                type="button"
                className={`theme-pill ${themeMode === 'twilight' ? 'is-active' : ''}`}
                onClick={() => setThemeMode('twilight')}
                title="Night theme"
              >
                Night
              </button>
            </div>
          </div>
        </div>

        <div className="showcase-copy">
          <p className="eyebrow">
            <Sparkles size={14} /> Travel, thoughtfully planned by vision
          </p>
          <h1>
            Turn your photo memories
            <br />
            <em>into instant journeys.</em>
          </h1>
          <p className="intro">
            Upload any destination photo and let our Vision AI identify landmarks, cluster attractions, and engineer the perfect route.
          </p>
        </div>

        {/* ── Dual-Marquee River Showcase ── */}
        <div
          className="marquee-showcase-container"
          aria-label="Scenic travel destinations"
        >
          {/* Column 1: Flows Upwards */}
          <div className="marquee-column marquee-col-up">
            <div className="marquee-track track-up">
              {[...MARQUEE_COLUMN_ONE, ...MARQUEE_COLUMN_ONE].map((item, idx) => (
                <article
                  key={`col1-${item.id}-${idx}`}
                  className="marquee-card"
                  title={`${item.name} (${item.location}, ${item.country})`}
                >
                  <div className="marquee-img-wrap">
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <div className="marquee-overlay" />
                    <div className="marquee-details">
                      <h4>{item.name}</h4>
                      <p>
                        <MapPin size={11} /> {item.location}, {item.country}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Column 2: Flows Downwards */}
          <div className="marquee-column marquee-col-down">
            <div className="marquee-track track-down">
              {[...MARQUEE_COLUMN_TWO, ...MARQUEE_COLUMN_TWO].map((item, idx) => (
                <article
                  key={`col2-${item.id}-${idx}`}
                  className="marquee-card"
                  title={`${item.name} (${item.location}, ${item.country})`}
                >
                  <div className="marquee-img-wrap">
                    <img src={item.image} alt={item.name} loading="lazy" />
                    <div className="marquee-overlay" />
                    <div className="marquee-details">
                      <h4>{item.name}</h4>
                      <p>
                        <MapPin size={11} /> {item.location}, {item.country}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Showcase Footer */}
        <div className="showcase-footer">
          <div className="travel-pill-row">
            <span className="mini-pill">🏖️ Island & Coast</span>
            <span className="mini-pill">⛩️ Heritage & Culture</span>
            <span className="mini-pill">🏔️ Alpine Nature</span>
            <span className="mini-pill">✨ Curated for Travelers</span>
          </div>
        </div>
      </section>

      {/* ── Right Auth Panel: Digital Boarding Pass ── */}
      <section className="auth-panel">
        <div className="boarding-pass-wrapper">
          {/* ── Pixo Mascot Cameo on Top ── */}
          <div
            className="pixo-cameo-container"
            onClick={triggerCameraFlash}
            title="Click Pixo to trigger camera flash!"
          >
            <div className="pixo-avatar-wrap">
              <img
                src="/pixo_carton/pixo_camera.jpg"
                alt="Pixo Companion Mascot"
                className="pixo-avatar"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = '/pixo_carton/pixo_profile.png'
                }}
              />
              <span className="camera-shutter-badge">
                <Camera size={13} />
              </span>
            </div>
            <div className="pixo-speech-bubble">
              <span>Psst! Pixo's ready with your passport 📸</span>
              <span className="speech-arrow" />
            </div>
          </div>

          {/* ── Boarding Pass Card ── */}
          <div className={`auth-card boarding-pass-card ${isTakingOff ? 'taking-off' : ''}`}>
            {/* Ticket Side Notches */}
            <div className="ticket-notch ticket-notch-left" aria-hidden="true" />
            <div className="ticket-notch ticket-notch-right" aria-hidden="true" />

            {/* Flight Header Strip */}
            <div className="flight-strip">
              <div className="flight-chip">
                <Ticket size={13} />
                <span>BOARDING PASS</span>
              </div>
              <span className="flight-number">FLT PIX-2026</span>
              <span className="flight-gate">GATE 01A</span>
              <span className="flight-class">FIRST CLASS</span>
            </div>

            <header className="auth-header">
              <div className="brand brand-dark">
                <span className="brand-icon">
                  <Plane size={16} />
                </span>
                pixinerary
              </div>
              <p className="auth-kicker">Your AI travel companion</p>
              <h2>{isSignUp ? 'Start your journey' : 'Welcome aboard'}</h2>
              <p>{isSignUp ? 'Create your passport to unlock automated itineraries.' : 'Sign in to access your planned routes & saved trips.'}</p>
            </header>

            {/* Sign In / Sign Up Mode Switch Tabs */}
            <div className="mode-switch" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                onClick={() => {
                  setMode('signin')
                  setError(null)
                  setMessage(null)
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignUp}
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setMessage(null)
                }}
              >
                Create account
              </button>
            </div>

            {/* Quick Access Buttons: Google & Fast Track Guest */}
            <div className="auth-quick-actions">
              <button
                className="google-button"
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading || isTakingOff}
              >
                <span aria-hidden="true" className="google-mark">
                  G
                </span>
                <span>Continue with Google</span>
              </button>

              <button
                className="guest-button"
                type="button"
                onClick={handleGuestLogin}
                disabled={loading || isTakingOff}
                title="Fast-track explore without logging in"
              >
                <Compass size={17} className="guest-icon" />
                <span>Fast Track Guest Pass</span>
                <span className="guest-pill">Instant Access</span>
              </button>
            </div>

            {/* Perforated Ticket Divider */}
            <div className="perforated-divider">
              <span className="perforated-line" />
              <span className="perforated-label">or enter credentials</span>
              <span className="perforated-line" />
            </div>

            {/* Error Message */}
            {error && (
              <div className="form-message form-message-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
                <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="form-message" role="status">
                <CheckCircle2 size={16} />
                <span>{message}</span>
                <button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleEmailAuth}>
              <label htmlFor="email">Email address</label>
              <div className="input-wrap">
                <Mail size={17} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="traveler@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="password-label">
                <label htmlFor="password">Password</label>
                {!isSignUp && (
                  <button type="button" onClick={handleForgotPassword} className="forgot-btn">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="input-wrap">
                <LockKeyhole size={17} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {!isSignUp ? (
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Keep me signed in on this device</span>
                </label>
              ) : (
                <p className="terms">
                  By creating an account, you agree to our{' '}
                  <button type="button" onClick={() => setMessage('Terms of Service: Travel responsibly and have fun!')}>
                    Terms
                  </button>{' '}
                  and{' '}
                  <button type="button" onClick={() => setMessage('Privacy Policy: Your data is safe with us.')}>
                    Privacy Policy
                  </button>
                  .
                </p>
              )}

              {/* Takeoff Submit Button */}
              <button
                className={`submit-button ${isTakingOff ? 'flight-takeoff' : ''}`}
                type="submit"
                disabled={loading || isTakingOff}
              >
                {isTakingOff ? (
                  <span className="takeoff-label">
                    <PlaneTakeoff size={18} className="plane-takeoff-anim" /> Boarding & Departing…
                  </span>
                ) : loading ? (
                  'Issuing Ticket…'
                ) : isSignUp ? (
                  <>
                    Issue Passport & Start <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    Board Flight & Sign In <Plane size={16} className="plane-idle-icon" />
                  </>
                )}
              </button>
            </form>

            {/* Passport Stamp Seal Footer */}
            <div className="boarding-footer">
              <span className="barcode-mock" aria-hidden="true">
                ||| | |||| | ||| |||| | || | |||| ||
              </span>
              <span className="secure-badge">
                <LockKeyhole size={11} /> 256-bit Encrypted
              </span>
            </div>
          </div>
        </div>

        <p className="mobile-note">Made with Vision AI for the moments between here and there.</p>
      </section>
    </main>
  )
}
