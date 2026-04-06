'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError('Incorrect email or password.')
            setLoading(false)
            return
        }

        router.push('/')
        router.refresh()
    }

    return (
        <div style={{
            minHeight: '100vh', background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{ width: '100%', maxWidth: '380px' }}>

                {/* Brand */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <img
                        src="/westglen-poster.png"
                        alt="Westglen Kennels"
                        style={{ width: '220px', height: 'auto', margin: '0 auto' }}
                    />
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '12px' }}>
                        Sign in to continue
                    </p>
                </div>

                {/* Form */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '28px' }}>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--muted)', marginBottom: '6px' }}>
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoFocus
                                style={{
                                    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    padding: '10px 12px', fontSize: '14px', color: 'var(--text)',
                                    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--muted)', marginBottom: '6px' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{
                                    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    padding: '10px 12px', fontSize: '14px', color: 'var(--text)',
                                    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                            />
                        </div>

                        {error && (
                            <p style={{ fontSize: '13px', color: '#9b2a2a', background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                background: 'var(--accent)', color: '#fff', border: 'none',
                                borderRadius: 'var(--radius-sm)', padding: '11px',
                                fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                                opacity: loading ? 0.6 : 1, marginTop: '4px',
                            }}
                            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}