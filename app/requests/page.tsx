'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type BookingRequest = {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    emergency_contact: string | null
    pet_name: string
    pet_info: string | null
    start_date: string
    end_date: string
    vacc_file_name: string | null
    vacc_file_url: string | null
    status: string
    admin_notes: string | null
    created_at: string
}

function formatDate(d: string) {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    })
}

function nightsBetween(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.round(diff / (1000 * 60 * 60 * 24))
}

const labelStyle = {
    fontSize: '11px' as const,
    color: 'var(--muted)',
    marginBottom: '3px',
}

export default function RequestsPage() {
    const [requests, setRequests] = useState<BookingRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('pending')
    const [converting, setConverting] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)

    useEffect(() => { fetchRequests() }, [])

    async function fetchRequests() {
        setLoading(true)
        const { data } = await supabase
            .from('booking_requests')
            .select('*')
            .order('created_at', { ascending: false })
        setRequests(data || [])
        setLoading(false)
    }

    async function handleConvert(req: BookingRequest) {
        if (!confirm(`Save ${req.full_name} as a new customer and create their booking?`)) return
        setConverting(req.id)

        const { data: customer, error: custError } = await supabase
            .from('customers')
            .insert([{
                full_name: req.full_name,
                email: req.email || null,
                phone: req.phone || null,
                notes: req.emergency_contact ? `Emergency contact: ${req.emergency_contact}` : null,
            }])
            .select('id')
            .single()

        if (custError || !customer) { alert('Failed to create customer.'); setConverting(null); return }

        const { data: pet, error: petError } = await supabase
            .from('pets')
            .insert([{ customer_id: customer.id, pet_name: req.pet_name, medical_notes: req.pet_info || null }])
            .select('id')
            .single()

        if (petError || !pet) { alert('Failed to create pet.'); setConverting(null); return }

        if (req.vacc_file_name && req.vacc_file_url) {
            await supabase.from('vaccination_records').insert([{
                pet_id: pet.id, file_name: req.vacc_file_name, file_url: req.vacc_file_url,
            }])
        }

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert([{ customer_id: customer.id, start_date: req.start_date, end_date: req.end_date, status: 'pending_confirmation' }])
            .select('id')
            .single()

        if (bookingError || !booking) { alert('Failed to create booking.'); setConverting(null); return }

        await supabase.from('booking_pets').insert([{ booking_id: booking.id, pet_id: pet.id }])
        await supabase.from('booking_requests').update({ status: 'approved' }).eq('id', req.id)

        fetchRequests()
        setConverting(null)
    }

    async function handleReject(req: BookingRequest) {
        if (!confirm(`Reject this request from ${req.full_name}?`)) return
        setRejecting(req.id)
        await supabase.from('booking_requests').update({ status: 'rejected' }).eq('id', req.id)
        fetchRequests()
        setRejecting(null)
    }

    const filters = [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
    ]

    const filtered = requests.filter((r) => r.status === statusFilter)
    const pendingCount = requests.filter((r) => r.status === 'pending').length

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>Requests</h1>
                    {pendingCount > 0 && (
                        <span style={{
                            background: 'var(--accent-light)', color: 'var(--accent)',
                            padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                        }}>
              {pendingCount} pending
            </span>
                    )}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                    Booking requests from new customers
                </p>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '6px' }}>
                {filters.map((f) => {
                    const isActive = statusFilter === f.value
                    return (
                        <button key={f.value} onClick={() => setStatusFilter(f.value)} style={{
                            padding: '5px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
                            border: isActive ? 'none' : '1px solid var(--border)',
                            background: isActive ? 'var(--accent)' : 'var(--surface)',
                            color: isActive ? '#fff' : 'var(--muted)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                            {f.label}
                        </button>
                    )
                })}
            </div>

            {/* List */}
            {loading ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p>
            ) : filtered.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No {statusFilter} requests.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map((req) => {
                        const isExpanded = expanded === req.id
                        const nights = nightsBetween(req.start_date, req.end_date)

                        return (
                            <div key={req.id} style={{
                                background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden',
                                border: req.status === 'pending' ? '1.5px solid var(--accent-border)' : 'none',
                            }}>

                                {/* Summary row */}
                                <button onClick={() => setExpanded(isExpanded ? null : req.id)} style={{
                                    display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                                }}>
                                    <div>
                                        <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{req.full_name}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                                            {req.pet_name} · {formatDate(req.start_date)} → {formatDate(req.end_date)} · {nights} night{nights !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                </button>

                                {/* Expanded */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                        {/* Contact info */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                            {[
                                                { label: 'Email', value: req.email },
                                                { label: 'Phone', value: req.phone },
                                                { label: 'Emergency contact', value: req.emergency_contact },
                                            ].map(({ label, value }) => (
                                                <div key={label}>
                                                    <p style={labelStyle}>{label}</p>
                                                    <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>{value || '—'}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Pet info */}
                                        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px' }}>
                                            <p style={{ ...labelStyle, marginBottom: '6px' }}>Pet info</p>
                                            <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>{req.pet_name}</p>
                                            {req.pet_info && <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>{req.pet_info}</p>}
                                        </div>

                                        {/* Stay */}
                                        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px' }}>
                                            <p style={{ ...labelStyle, marginBottom: '6px' }}>Requested stay</p>
                                            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                                                {formatDate(req.start_date)} → {formatDate(req.end_date)}
                                            </p>
                                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                                                {nights} night{nights !== 1 ? 's' : ''}
                                            </p>
                                        </div>

                                        {/* Vaccination */}
                                        {req.vacc_file_url && (
                                            <div>
                                                <p style={{ ...labelStyle, marginBottom: '6px' }}>Vaccination record</p>
                                                <a href={req.vacc_file_url} target="_blank" rel="noopener noreferrer"
                                                   style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}
                                                   onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                   onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                                    {req.vacc_file_name || 'View file'} →
                                                </a>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                                <button onClick={() => handleConvert(req)} disabled={converting === req.id} style={{
                                                    background: 'var(--accent)', color: '#fff', border: 'none',
                                                    borderRadius: 'var(--radius-sm)', padding: '10px 20px',
                                                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                                                    opacity: converting === req.id ? 0.5 : 1,
                                                }}>
                                                    {converting === req.id ? 'Saving...' : 'Save as customer'}
                                                </button>
                                                <button onClick={() => handleReject(req)} disabled={rejecting === req.id} style={{
                                                    background: 'transparent', color: '#b91c1c', border: '1px solid #fecaca',
                                                    borderRadius: 'var(--radius-sm)', padding: '10px 16px',
                                                    fontSize: '13px', cursor: 'pointer', opacity: rejecting === req.id ? 0.5 : 1,
                                                }}>
                                                    {rejecting === req.id ? '...' : 'Reject'}
                                                </button>
                                            </div>
                                        )}

                                        {req.status === 'approved' && (
                                            <p style={{ fontSize: '12px', color: '#2d6a22', fontWeight: '500' }}>
                                                Approved — saved as customer
                                            </p>
                                        )}

                                        {req.status === 'rejected' && (
                                            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Rejected</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}