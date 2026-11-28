import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Info, Lock, Mail, User, UserPlus } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/layout'
import { Button, Card, CardContent, ErrorState, Input } from '../components/ui'
import { useAuth } from '../context/useAuth'

export function RegisterPage() {
  const { status, register } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const cleanName = fullName.trim()
    const cleanUsername = username.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (cleanName.length < 2) {
      setValidationError('Full name must be at least 2 characters.')
      return
    }
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(cleanUsername)) {
      setValidationError('Username must be 3-40 characters (letters, numbers, ., _, -).')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setValidationError('Enter a valid email address.')
      return
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setValidationError('Password must be at least 8 characters and include letters and numbers.')
      return
    }
    if (password !== confirmPassword) {
      setValidationError('Password and confirmation do not match.')
      return
    }

    setValidationError(null)
    setIsSubmitting(true)
    try {
      await register({
        full_name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Account registration failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-ivory px-4 py-10 text-charcoal sm:px-6">
      <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-sm border border-border-neutral bg-surface md:grid-cols-5">
        <div className="flex flex-col justify-between bg-editorial-blue p-6 text-surface md:col-span-2 md:p-8">
          <div className="space-y-6">
            <BrandLogo />
            <div className="space-y-2 border-t border-surface/15 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-coral">
                Onboarding
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-surface">
                Create AI Bridge X Account
              </h1>
              <p className="text-xs leading-relaxed text-sand/85">
                Self-registered accounts are created with the read-only Viewer role so dashboards
                and exported reports stay accessible while write operations remain protected.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-sm border border-surface/15 bg-surface/5 p-3.5 text-[11px] leading-relaxed text-sand/85">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-surface">
              <Info className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
              <span>Role Assignment Policy</span>
            </div>
            Project Manager or Administrator roles can only be granted by an existing Administrator
            inside User Management.
          </div>
        </div>

        <div className="p-6 sm:p-8 md:col-span-3">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-editorial-blue">Register Viewer Profile</h2>
            <p className="mt-1 text-xs text-charcoal/75">
              Passwords are stored exclusively as salted Argon2id cryptographic hashes.
            </p>
          </div>

          {(validationError || submitError) && (
            <div className="mb-4">
              <ErrorState
                compact
                title="Registration Validation"
                message={validationError || submitError || 'Check registration fields.'}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <Input
              label="Full Name"
              name="fullName"
              autoComplete="name"
              required
              leftAddon={<User className="h-4 w-4" />}
              placeholder="e.g. Ananya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Username"
                name="username"
                autoComplete="username"
                required
                leftAddon={<User className="h-4 w-4" />}
                placeholder="a.sharma"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                required
                leftAddon={<Mail className="h-4 w-4" />}
                placeholder="ananya@company.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="reg-password"
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
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="8+ chars (letters + digits)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-sm border border-border-neutral bg-surface pl-9 pr-10 text-sm text-charcoal placeholder:text-charcoal/50 focus-visible:outline-2 focus-visible:outline-editorial-blue"
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

              <Input
                label="Confirm Password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                leftAddon={<Lock className="h-4 w-4" />}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              leftIcon={<UserPlus className="h-4 w-4" />}
              className="w-full"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <Card variant="sand" className="mt-5">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-0 text-xs">
              <span className="text-charcoal/80">Already registered?</span>
              <Link
                to="/login"
                className="font-semibold text-editorial-blue underline decoration-coral decoration-2 underline-offset-4 hover:text-editorial-blue-hover"
              >
                Sign In Instead
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
