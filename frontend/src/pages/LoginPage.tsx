import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Info, Lock, LogIn, ShieldCheck, User } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/layout'
import { Button, Card, CardContent, ErrorState, Input } from '../components/ui'
import { useAuth } from '../context/useAuth'

export function LoginPage() {
  const { status, login, sessionMessage, clearSessionMessage } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearSessionMessage()
    setSubmitError(null)

    const cleanId = identifier.trim()
    if (!cleanId) {
      setValidationError('Enter your registered email address or username.')
      return
    }
    if (!password) {
      setValidationError('Enter your account password.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    try {
      await login({ identifier: cleanId, password })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-ivory px-4 py-10 text-charcoal sm:px-6">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-sm border border-border-neutral bg-surface md:grid-cols-5">
        {/* Left Editorial Deep Blue Panel */}
        <div className="flex flex-col justify-between bg-editorial-blue p-6 text-surface md:col-span-2 md:p-8">
          <div className="space-y-6">
            <BrandLogo />
            <div className="space-y-2 border-t border-surface/15 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-coral">
                Role-Protected Workspace
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-surface">
                Sign in to AI Bridge X
              </h1>
              <p className="text-xs leading-relaxed text-sand/85">
                Access bridge delay forecasting, live weather risk analytics, computer vision
                inspections, and server-verified PDF/CSV reporting.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-2 rounded-sm border border-surface/15 bg-surface/5 p-3.5 text-xs text-sand/90">
            <div className="flex items-center gap-2 font-semibold text-surface">
              <ShieldCheck className="h-4 w-4 text-coral" aria-hidden="true" />
              <span>Security Enforcement</span>
            </div>
            <p className="leading-relaxed text-[11px] text-sand/80">
              Sessions use signed expiring JWT access tokens, Argon2id password verification, and
              backend role-based access control.
            </p>
          </div>
        </div>

        {/* Right Form Surface */}
        <div className="p-6 sm:p-8 md:col-span-3">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-editorial-blue">Account Sign In</h2>
            <p className="mt-1 text-xs text-charcoal/75">
              Enter your email or username and password to continue.
            </p>
          </div>

          {sessionMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-sm border border-border-neutral bg-sand/70 px-3.5 py-2.5 text-xs text-editorial-blue"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
              <span>{sessionMessage}</span>
            </div>
          )}

          {(validationError || submitError) && (
            <div className="mb-4">
              <ErrorState
                compact
                title="Sign In Issue"
                message={validationError || submitError || 'Please verify your credentials.'}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email or Username"
              name="identifier"
              autoComplete="username"
              required
              leftAddon={<User className="h-4 w-4" />}
              placeholder="e.g. engineer@bridgex.local or j.doe"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="text-xs font-semibold uppercase tracking-wide text-editorial-blue"
              >
                Password <span className="text-coral">*</span>
              </label>
              <div className="relative flex items-center">
                <span
                  className="pointer-events-none absolute left-3 flex items-center text-editorial-blue/70"
                  aria-hidden="true"
                >
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-sm border border-border-neutral bg-surface pl-9 pr-10 text-sm text-charcoal placeholder:text-charcoal/50 transition-colors focus-visible:outline-2 focus-visible:outline-editorial-blue hover:border-editorial-blue/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-xs text-charcoal/70 hover:bg-sand/70 hover:text-editorial-blue"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              leftIcon={<LogIn className="h-4 w-4" />}
              className="w-full"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In to Workspace'}
            </Button>
          </form>

          <Card variant="sand" className="mt-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-0 text-xs">
              <span className="text-charcoal/80">New team member without an account?</span>
              <Link
                to="/register"
                className="font-semibold text-editorial-blue underline decoration-coral decoration-2 underline-offset-4 hover:text-editorial-blue-hover"
              >
                Create Viewer Account
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
