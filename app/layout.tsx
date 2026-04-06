'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase/client'
import './globals.css'

const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/customers', label: 'Customers' },
    { href: '/bookings', label: 'Bookings' },
    { href: '/rooms', label: 'Rooms' },
    { href: '/requests', label: 'Requests' },
]

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const isLoginPage = pathname === '/login'

    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        if (isLoginPage) return

        // Initial fetch
        fetchPendingCount()

        // Realtime listener
        const channel = supabase
            .channel('booking_requests_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'booking_requests' },
                () => { fetchPendingCount() }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [isLoginPage])

    async function fetchPendingCount() {
        const { count } = await supabase
            .from('booking_requests')
            .select('id', { count: 'exact' })
            .eq('status', 'pending')
        setPendingCount(count ?? 0)
    }

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <html lang="en">
        <head>
            <title>Westglen Admin</title>
        </head>
        <body style={{ background: 'var(--bg)', margin: 0 }}>
        <div style={{ minHeight: '100vh' }}>

            {!isLoginPage && (
                <nav style={{
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    height: '52px',
                    padding: '0 32px',
                    gap: '4px',
                }}>
                    {/* Brand */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '20px' }}>
                        <img
                            src="/paw-logo.jpeg"
                            alt="Westglen"
                            style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  Westglen Admin
                </span>
                    </div>

                    {/* Nav links */}
                    {navItems.map((item) => {
                        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                                    fontSize: '13px', fontWeight: isActive ? '500' : '400',
                                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                                    background: isActive ? 'var(--accent-light)' : 'transparent',
                                    textDecoration: 'none', whiteSpace: 'nowrap',
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)' } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' } }}
                            >
                                {item.label}
                            </Link>
                        )
                    })}

                    {/* Right side */}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>

                        {/* Notification Bell */}
                        <Link
                            href="/requests"
                            style={{
                                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '34px', height: '34px', borderRadius: 'var(--radius-sm)',
                                color: pendingCount > 0 ? 'var(--accent)' : 'var(--muted)',
                                background: pendingCount > 0 ? 'var(--accent-light)' : 'transparent',
                                textDecoration: 'none', transition: 'background 0.15s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = pendingCount > 0 ? 'var(--accent-light)' : 'transparent' }}
                            title={pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''}` : 'No pending requests'}
                        >
                            {/* Bell icon */}
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>

                            {/* Badge */}
                            {pendingCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '3px', right: '3px',
                                    background: 'var(--accent)', color: '#fff',
                                    borderRadius: '999px', fontSize: '10px', fontWeight: '600',
                                    minWidth: '16px', height: '16px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '0 4px', lineHeight: 1,
                                }}>
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                            )}
                        </Link>

                        <Link
                            href="/settings"
                            style={{
                                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                                fontSize: '13px', color: pathname === '/settings' ? 'var(--accent)' : 'var(--muted)',
                                background: pathname === '/settings' ? 'var(--accent-light)' : 'transparent',
                                textDecoration: 'none', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={(e) => { if (pathname !== '/settings') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' } }}
                        >
                            Settings
                        </Link>

                        <button
                            onClick={handleSignOut}
                            style={{
                                background: 'transparent', color: 'var(--muted)',
                                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                padding: '5px 12px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fdecea'; e.currentTarget.style.color = '#9b2a2a'; e.currentTarget.style.borderColor = '#fecaca' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                        >
                            Sign out
                        </button>
                    </div>
                </nav>
            )}

            <main style={{
                maxWidth: isLoginPage ? '100%' : '1100px',
                margin: '0 auto',
                padding: isLoginPage ? '0' : '32px',
            }}>
                {children}
            </main>
        </div>
        </body>
        </html>
    )
}