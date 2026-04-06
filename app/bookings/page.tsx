'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type BookingRow = {
    id: string
    status: string
    start_date: string
    end_date: string
    customer: { id: string; full_name: string } | null
    booking_pets: { pet: { pet_name: string } | null }[]
}

function getToday() {
    return new Date().toISOString().split('T')[0]
}

function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatPets(bookingPets: { pet: { pet_name: string } | null }[]) {
    return bookingPets.map((bp) => bp.pet?.pet_name).filter(Boolean).join(', ') || '—'
}

function StatusBadge({ status, endDate }: { status: string; endDate: string }) {
    const isOverstay = status === 'checked_in' && endDate < getToday()

    const map: Record<string, { label: string; bg: string; color: string }> = {
        pending_confirmation: { label: 'Pending', bg: '#fef8e6', color: '#8a6200' },
        confirmed: { label: 'Confirmed', bg: '#e6f0fb', color: '#1a5296' },
        checked_in: { label: 'Checked in', bg: '#eaf5e6', color: '#2d6a22' },
        checked_out: { label: 'Completed', bg: '#f0eeea', color: '#5a5a56' },
        cancelled: { label: 'Cancelled', bg: '#f0eeea', color: '#8a8a86' },
    }

    const s = isOverstay
        ? { label: 'Overstay', bg: '#fdecea', color: '#9b2a2a' }
        : map[status] ?? { label: status, bg: '#f0eeea', color: '#5a5a56' }

    return (
        <span style={{
            background: s.bg, color: s.color,
            padding: '3px 10px', borderRadius: '999px',
            fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap',
        }}>
      {s.label}
    </span>
    )
}

const filters = [
    { value: 'all', label: 'All' },
    { value: 'pending_confirmation', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'checked_in', label: 'Checked in' },
    { value: 'checked_out', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
]

export default function BookingsPage() {
    const [bookings, setBookings] = useState<BookingRow[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')

    useEffect(() => { fetchBookings() }, [])

    async function fetchBookings() {
        setLoading(true)
        const { data } = await supabase
            .from('bookings')
            .select(`
        id, status, start_date, end_date,
        customer:customers(id, full_name),
        booking_pets(pet:pets(pet_name))
      `)
            .order('start_date', { ascending: false })
        setBookings((data as BookingRow[]) || [])
        setLoading(false)
    }

    const filtered = bookings.filter((b) =>
        statusFilter === 'all' ? true : b.status === statusFilter
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>Bookings</h1>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                        {bookings.length} total
                    </p>
                </div>
                <Link href="/customers" style={{
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                    fontSize: '13px', fontWeight: '500', textDecoration: 'none',
                }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                >
                    + New booking
                </Link>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {filters.map((f) => {
                    const isActive = statusFilter === f.value
                    return (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            style={{
                                padding: '5px 14px',
                                borderRadius: '999px',
                                fontSize: '12px',
                                fontWeight: '500',
                                border: isActive ? 'none' : '1px solid var(--border)',
                                background: isActive ? 'var(--accent)' : 'var(--surface)',
                                color: isActive ? '#fff' : 'var(--muted)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {f.label}
                        </button>
                    )
                })}
            </div>

            {/* Table */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {loading ? (
                    <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>Loading...</p>
                ) : filtered.length === 0 ? (
                    <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>No bookings found.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Pets</th>
                            <th>Status</th>
                            <th>Check-in</th>
                            <th>Check-out</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((b) => (
                            <tr key={b.id}>
                                <td className="primary">
                                    <Link href={`/bookings/${b.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}
                                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                        {b.customer?.full_name || '—'}
                                    </Link>
                                </td>
                                <td>{formatPets(b.booking_pets)}</td>
                                <td><StatusBadge status={b.status} endDate={b.end_date} /></td>
                                <td>{formatDate(b.start_date)}</td>
                                <td>{formatDate(b.end_date)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}