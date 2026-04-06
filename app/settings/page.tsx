'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase/client'

const inputStyle = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '10px 12px', fontSize: '14px', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '500' as const,
    color: 'var(--muted)', marginBottom: '6px',
}

export default function SettingsPage() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSuccess(false)

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.')
            return
        }

        setLoading(true)

        // Re-authenticate with current password first
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) { setError('Could not get current user.'); setLoading(false); return }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        })

        if (signInError) {
            setError('Current password is incorrect.')
            setLoading(false)
            return
        }

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

        if (updateError) {
            setError('Failed to update password. Please try again.')
            setLoading(false)
            return
        }

        setSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setLoading(false)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '480px' }}>

            <div>
                <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>Settings</h1>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>Manage your account</p>
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px' }}>
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '20px' }}>
                    Change password
                </p>

                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>Current password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={inputStyle}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>New password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={inputStyle}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Confirm new password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={inputStyle}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    {error && (
                        <p style={{ fontSize: '13px', color: '#9b2a2a', background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                            {error}
                        </p>
                    )}

                    {success && (
                        <p style={{ fontSize: '13px', color: '#2d6a22', background: '#eaf5e6', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                            Password updated successfully!
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            background: 'var(--accent)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-sm)', padding: '10px 20px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                            opacity: loading ? 0.6 : 1, alignSelf: 'flex-start',
                        }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                    >
                        {loading ? 'Updating...' : 'Update password'}
                    </button>
                </form>
            </div>
        </div>
    )
}