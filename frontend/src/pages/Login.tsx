import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plane,
  Sparkles,
  MapPin,
  Waves,
  Check,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import './Login.css'

interface ExperienceItem {
  src: string
  label: string
  className: string
}

const experiences: ExperienceItem[] = [
  {
    src: '/login/pixinerary-beach.png',
    label: 'Coastal escapes',
    className: 'experience-one'
  },
  {
    src: '/login/pixinerary-resort.png',
    label: 'Hidden resorts',
    className: 'experience-two'
  },
  {
    src: '/login/pixinerary-wildlife.png',
    label: 'Wild at heart',
    className: 'experience-three'
  },
  {
    src: '/login/pixinerary-architecture.png',
    label: 'Stories in stone',
    className: 'experience-four'
  },
  {
    src: '/login/pixinerary-dining.png',
    label: 'Taste the journey',
    className: 'experience-five'
  },
  {
    src: '/login/pixinerary-snorkeling.png',
    label: 'Into the blue',
    className: 'experience-six'
  }
]

export default function Login() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const isSignUp = mode === 'signup'

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/', { replace: true })
    }
  }, [user, authLoading, navigate])

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
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account and get started!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
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
    <main className="pixinerary-shell">
      {/* Ambient glow backgrounds */}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* ── Left Showcase Panel ── */}
      <section className="showcase-panel">
        <header className="brand brand-light">
          <span className="brand-icon">
            <Plane size={18} />
          </span>
          pixinerary
        </header>

        <div className="showcase-copy">
          <p className="eyebrow">
            <Sparkles size={14} /> Travel, thoughtfully planned
          </p>
          <h1>
            Go somewhere
            <br />
            <em>good for you.</em>
          </h1>
          <p className="intro">
            Your AI companion for finding the places, people, and moments that make a trip unforgettable.
          </p>
        </div>

        {/* Floating experience cards & pills */}
        <div className="experience-cloud" aria-label="Travel experiences">
          <div className="cloud-orbit orbit-one" />
          <div className="cloud-orbit orbit-two" />

          {experiences.map((item) => (
            <figure key={item.label} className={`experience-card ${item.className}`}>
              <img
                src={item.src}
                alt={item.label}
                loading="eager"
                onError={(e) => {
                  // Fallback to high-quality unsplash images if needed
                  const fallbacks: Record<string, string> = {
                    'Coastal escapes': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
                    'Hidden resorts': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&auto=format&fit=crop&q=80',
                    'Wild at heart': 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500&auto=format&fit=crop&q=80',
                    'Stories in stone': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop&q=80',
                    'Taste the journey': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
                    'Into the blue': 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop&q=80'
                  }
                  if (fallbacks[item.label]) {
                    ;(e.target as HTMLImageElement).src = fallbacks[item.label]
                  }
                }}
              />
              <figcaption>{item.label}</figcaption>
            </figure>
          ))}

          <div className="travel-pill pill-one">
            <MapPin size={13} /> Beach
          </div>
          <div className="travel-pill pill-two">
            <Sparkles size={13} /> Spa / Wellness
          </div>
          <div className="travel-pill pill-three">
            <Waves size={13} /> Water Sports
          </div>
        </div>

        <div className="showcase-footer">
          <span>
            <Check size={14} /> Curated for curious travelers
          </span>
          <span>
            01 <i /> 03
          </span>
        </div>
      </section>

      {/* ── Right Auth Panel ── */}
      <section className="auth-panel">
        <div className="auth-card">
          <header className="auth-header">
            <div className="brand brand-dark">
              <span className="brand-icon">
                <Plane size={16} />
              </span>
              pixinerary
            </div>
            <p className="auth-kicker">Your AI travel companion</p>
            <h2>{isSignUp ? 'Start your journey' : 'Welcome back'}</h2>
            <p>{isSignUp ? 'Create your account and discover more.' : 'Sign in to pick up where you left off.'}</p>
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

          {/* Google Sign In Button */}
          <button
            className="google-button"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <span aria-hidden="true" className="google-mark">
              G
            </span>
            Continue with Google
          </button>

          <div className="divider">
            <span>or continue with email</span>
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
              <Check size={16} />
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
              <Mail size={17} />
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="password-label">
              <label htmlFor="password">Password</label>
              {!isSignUp && (
                <button type="button" onClick={handleForgotPassword}>
                  Forgot password?
                </button>
              )}
            </div>
            <div className="input-wrap">
              <LockKeyhole size={17} />
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
                <span>Keep me signed in</span>
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

            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? (
                'Preparing your journey…'
              ) : isSignUp ? (
                <>
                  Create my account <ArrowRight size={17} />
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="secure-note">
            <LockKeyhole size={12} /> Your data stays private and secure
          </p>
        </div>

        <p className="mobile-note">Made for the moments between here and there.</p>
      </section>
    </main>
  )
}
