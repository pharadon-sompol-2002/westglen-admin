'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'

type UpcomingBooking = {
    id: string
    start_date: string
    end_date: string
    status: string
    customer: { full_name: string } | null
    booking_pets: { pet: { pet_name: string } | null }[]
}

type OverstayBooking = {
    id: string
    end_date: string
    customer: { full_name: string } | null
    booking_pets: { pet: { pet_name: string } | null }[]
}

function getToday() {
    return new Date().toISOString().split('T')[0]
}

function getTomorrowPlus(days: number) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short',
    })
}

function formatPets(bookingPets: { pet: { pet_name: string } | null }[]) {
    return bookingPets.map((bp) => bp.pet?.pet_name).filter(Boolean).join(', ') || '—'
}

function TodayBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; bg: string; color: string }> = {
        confirmed: { label: 'Confirmed', bg: '#e6f0fb', color: '#1a5296' },
        pending_confirmation: { label: 'Pending', bg: '#fef8e6', color: '#8a6200' },
        checked_in: { label: 'Checked in', bg: '#eaf5e6', color: '#2d6a22' },
    }
    const s = map[status] ?? { label: status, bg: '#f0eeea', color: '#5a5a56' }
    return (
        <span style={{
            background: s.bg, color: s.color,
            padding: '3px 10px', borderRadius: '999px',
            fontSize: '11px', fontWeight: '500',
        }}>
      {s.label}
    </span>
    )
}

export default function DashboardPage() {
    const today = getToday()
    const in7Days = getTomorrowPlus(7)

    const [loading, setLoading] = useState(true)
    const [overstays, setOverstays] = useState<OverstayBooking[]>([])
    const [checkinsToday, setCheckinsToday] = useState<UpcomingBooking[]>([])
    const [checkoutsToday, setCheckoutsToday] = useState<UpcomingBooking[]>([])
    const [upcoming, setUpcoming] = useState<UpcomingBooking[]>([])
    const [pendingRequests, setPendingRequests] = useState(0)
    const [checkedIn, setCheckedIn] = useState(0)
    const [availableRooms, setAvailableRooms] = useState(0)
    const [totalRooms, setTotalRooms] = useState(0)

    useEffect(() => { fetchAll() }, [])

    async function fetchAll() {
        setLoading(true)
        await Promise.all([
            fetchStats(),
            fetchOverstays(),
            fetchCheckinsToday(),
            fetchCheckoutsToday(),
            fetchUpcoming(),
            fetchPendingRequests(),
        ])
        setLoading(false)
    }

    async function fetchStats() {
        const [roomsRes, occupiedRes, checkedInRes] = await Promise.all([
            supabase.from('rooms').select('id', { count: 'exact' }).eq('is_active', true),
            supabase.from('booking_pets').select('room_id', { count: 'exact' }).not('room_id', 'is', null),
            supabase.from('bookings').select('id', { count: 'exact' }).eq('status', 'checked_in'),
        ])
        const total = roomsRes.count ?? 0
        const occupied = occupiedRes.count ?? 0
        setTotalRooms(total)
        setAvailableRooms(total - occupied)
        setCheckedIn(checkedInRes.count ?? 0)
    }

    async function fetchOverstays() {
        const { data } = await supabase
            .from('bookings')
            .select(`id, end_date, customer:customers(full_name), booking_pets(pet:pets(pet_name))`)
            .eq('status', 'checked_in')
            .lt('end_date', today)
        setOverstays(( data as unknown as OverstayBooking[]) || [])
    }

    async function fetchCheckinsToday() {
        const { data } = await supabase
            .from('bookings')
            .select(`id, start_date, end_date, status, customer:customers(full_name), booking_pets(pet:pets(pet_name))`)
            .eq('start_date', today)
            .in('status', ['confirmed', 'pending_confirmation'])
            .order('created_at', { ascending: true })
        setCheckinsToday(( data as unknown as UpcomingBooking[]) || [])
    }

    async function fetchCheckoutsToday() {
        const { data } = await supabase
            .from('bookings')
            .select(`id, start_date, end_date, status, customer:customers(full_name), booking_pets(pet:pets(pet_name))`)
            .eq('end_date', today)
            .eq('status', 'checked_in')
            .order('created_at', { ascending: true })
        setCheckoutsToday(( data as unknown as UpcomingBooking[]) || [])
    }

    async function fetchUpcoming() {
        const tomorrow = getTomorrowPlus(1)
        const { data } = await supabase
            .from('bookings')
            .select(`id, start_date, end_date, status, customer:customers(full_name), booking_pets(pet:pets(pet_name))`)
            .gte('start_date', tomorrow)
            .lte('start_date', in7Days)
            .in('status', ['confirmed', 'pending_confirmation'])
            .order('start_date', { ascending: true })
            .limit(8)
        setUpcoming(( data as unknown as UpcomingBooking[]) || [])
    }

    async function fetchPendingRequests() {
        const { count } = await supabase
            .from('booking_requests')
            .select('id', { count: 'exact' })
            .eq('status', 'pending')
        setPendingRequests(count ?? 0)
    }

    if (loading) return <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading...</p>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Overstay Alert */}
            {overstays.length > 0 && (
                <div style={{ background: '#fdecea', borderRadius: 'var(--radius)', padding: '14px 20px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#9b2a2a', marginBottom: '10px' }}>
                        {overstays.length} booking{overstays.length > 1 ? 's' : ''} past checkout date
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {overstays.map((b) => (
                            <Link key={b.id} href={`/bookings/${b.id}`} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: '#fff', borderRadius: '10px', padding: '10px 16px',
                                textDecoration: 'none',
                            }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                  {b.customer?.full_name || '—'}
                </span>
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {formatPets(b.booking_pets)} · due {formatDate(b.end_date)}
                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Pending Requests Alert */}
            {pendingRequests > 0 && (
                <Link href="/requests" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--accent-light)', borderRadius: 'var(--radius)',
                    padding: '12px 20px', textDecoration: 'none',
                }}>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--accent)' }}>
            {pendingRequests} new booking request{pendingRequests > 1 ? 's' : ''} waiting for review
          </span>
                    <span style={{ fontSize: '13px', color: 'var(--accent)' }}>Review →</span>
                </Link>
            )}

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                    { label: 'Checked in', value: checkedIn, accent: true, href: '/bookings' },
                    { label: 'Rooms available', value: `${availableRooms} / ${totalRooms}`, accent: false, href: '/rooms' },
                    { label: 'Check-ins today', value: checkinsToday.length, accent: false, href: undefined },
                    { label: 'Check-outs today', value: checkoutsToday.length, accent: false, href: undefined },
                ].map((s) => {
                    const inner = (
                        <div style={{
                            background: s.accent ? 'var(--accent-light)' : 'var(--surface)',
                            borderRadius: 'var(--radius)',
                            padding: '16px 20px',
                            cursor: s.href ? 'pointer' : 'default',
                        }}>
                            <p style={{ fontSize: '12px', color: s.accent ? 'var(--accent)' : 'var(--muted)', marginBottom: '6px' }}>
                                {s.label}
                            </p>
                            <p style={{ fontSize: '24px', fontWeight: '600', color: s.accent ? 'var(--accent)' : 'var(--text)' }}>
                                {s.value}
                            </p>
                        </div>
                    )
                    return s.href
                        ? <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>{inner}</Link>
                        : <div key={s.label}>{inner}</div>
                })}
            </div>

            {/* Check-ins & Check-outs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* Check-ins today */}
                <div>
                    <p className="section-title">Check-ins today</p>
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        {checkinsToday.length === 0 ? (
                            <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>No check-ins today</p>
                        ) : checkinsToday.map((b, i) => (
                            <Link key={b.id} href={`/bookings/${b.id}`} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 20px', textDecoration: 'none',
                                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div>
                                    <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                                        {b.customer?.full_name || '—'}
                                    </p>
                                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                        {formatPets(b.booking_pets)}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    <TodayBadge status={b.status} />
                                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>until {formatDate(b.end_date)}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Check-outs today */}
                <div>
                    <p className="section-title">Check-outs today</p>
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        {checkoutsToday.length === 0 ? (
                            <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>No check-outs today</p>
                        ) : checkoutsToday.map((b, i) => (
                            <Link key={b.id} href={`/bookings/${b.id}`} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '12px 20px', textDecoration: 'none',
                                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div>
                                    <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                                        {b.customer?.full_name || '—'}
                                    </p>
                                    <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                        {formatPets(b.booking_pets)}
                                    </p>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>since {formatDate(b.start_date)}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Upcoming 7 days */}
            <div>
                <p className="section-title">Upcoming — next 7 days</p>
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                    {upcoming.length === 0 ? (
                        <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>
                            No upcoming bookings in the next 7 days
                        </p>
                    ) : (
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Pets</th>
                                <th>Check-in</th>
                                <th>Check-out</th>
                            </tr>
                            </thead>
                            <tbody>
                            {upcoming.map((b) => (
                                <tr key={b.id}>
                                    <td className="primary">
                                        <Link href={`/bookings/${b.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}
                                              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                        >
                                            {b.customer?.full_name || '—'}
                                        </Link>
                                    </td>
                                    <td>{formatPets(b.booking_pets)}</td>
                                    <td>{formatDate(b.start_date)}</td>
                                    <td>{formatDate(b.end_date)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    )
}