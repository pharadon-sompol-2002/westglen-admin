'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type Booking = {
    id: string
    status: string
    start_date: string
    end_date: string
    start_time: string | null
    end_time: string | null
    notes: string | null
    created_at: string
    customer: { id: string; full_name: string; phone: string | null; whatsapp: string | null } | null
    booking_pets: {
        id: string
        pet: { id: string; pet_name: string; species: string | null; breed: string | null } | null
        room: { id: string; room_name: string; room_type: string | null } | null
    }[]
}

type Pet = { id: string; pet_name: string }
type Room = { id: string; room_name: string; room_type: string | null }
type TimeValue = { hr: string; min: string; ampm: string }

const STATUS_FLOW: Record<string, { next: string; label: string; bg: string; color: string } | null> = {
    pending_confirmation: { next: 'confirmed', label: 'Confirm booking', bg: '#2563eb', color: '#fff' },
    confirmed: { next: 'checked_in', label: 'Check in', bg: '#16a34a', color: '#fff' },
    checked_in: { next: 'checked_out', label: 'Check out', bg: 'var(--accent)', color: '#fff' },
    checked_out: null,
    cancelled: null,
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    pending_confirmation: { label: 'Pending', bg: '#fef8e6', color: '#8a6200' },
    confirmed: { label: 'Confirmed', bg: '#e6f0fb', color: '#1a5296' },
    checked_in: { label: 'Checked in', bg: '#eaf5e6', color: '#2d6a22' },
    checked_out: { label: 'Completed', bg: '#f0eeea', color: '#5a5a56' },
    cancelled: { label: 'Cancelled', bg: '#f0eeea', color: '#8a8a86' },
}

const MINS = ['00', '15', '30', '45']

function getDayOfWeek(dateStr: string): number | null {
    if (!dateStr) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).getDay()
}

function getValidHours(day: number | null): { hr: string; ampm: 'AM' | 'PM' }[] {
    const slots: { hr: string; ampm: 'AM' | 'PM' }[] = []
    if (day === null) return slots
    if (day === 0) {
        for (let h = 6; h <= 11; h++) slots.push({ hr: String(h), ampm: 'AM' })
        slots.push({ hr: '12', ampm: 'PM' })
        for (let h = 1; h <= 10; h++) slots.push({ hr: String(h), ampm: 'PM' })
        return slots
    }
    if (day === 6) {
        for (let h = 9; h <= 11; h++) slots.push({ hr: String(h), ampm: 'AM' })
        slots.push({ hr: '12', ampm: 'PM' })
        for (let h = 1; h <= 4; h++) slots.push({ hr: String(h), ampm: 'PM' })
        return slots
    }
    for (let h = 8; h <= 11; h++) slots.push({ hr: String(h), ampm: 'AM' })
    slots.push({ hr: '12', ampm: 'PM' })
    for (let h = 1; h <= 6; h++) slots.push({ hr: String(h), ampm: 'PM' })
    return slots
}

function timeToMinutes(t: TimeValue): number {
    let hr = parseInt(t.hr)
    const min = parseInt(t.min)
    if (t.ampm === 'PM' && hr !== 12) hr += 12
    if (t.ampm === 'AM' && hr === 12) hr = 0
    return hr * 60 + min
}

function parseTimeString(t: string | null): TimeValue {
    if (!t) return { hr: '8', min: '00', ampm: 'AM' }
    const parts = t.split(' ')
    const [hr, min] = parts[0].split(':')
    return { hr, min, ampm: parts[1] || 'AM' }
}

function formatTimeValue(t: TimeValue): string {
    return `${t.hr}:${t.min} ${t.ampm}`
}

function formatDateEn(d: string) {
    if (!d) return '—'
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
}

function nightsBetween(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.round(diff / (1000 * 60 * 60 * 24))
}

function getToday() {
    return new Date().toISOString().split('T')[0]
}

function getWarnings(startDate: string, endDate: string, endTime: TimeValue) {
    const warnings: string[] = []
    const startDay = getDayOfWeek(startDate)
    const endDay = getDayOfWeek(endDate)
    if (startDay === 0) warnings.push('$35 Sunday fee applies for check-in')
    if (endDay === 0) warnings.push('$35 Sunday fee applies for check-out')
    if (endDate && endTime.hr) {
        const endMins = timeToMinutes(endTime)
        if (endDay !== null && endDay !== 0) {
            const limit = endDay === 6
                ? timeToMinutes({ hr: '4', min: '00', ampm: 'PM' })
                : timeToMinutes({ hr: '6', min: '00', ampm: 'PM' })
            if (endMins > limit) warnings.push('Check-out outside business hours — additional day will be charged')
        }
    }
    return warnings
}

function TimePicker({ value, onChange, dateStr, label }: {
    value: TimeValue; onChange: (v: TimeValue) => void; dateStr: string; label: string
}) {
    const day = getDayOfWeek(dateStr)
    const validSlots = getValidHours(day)
    const ampmOptions = Array.from(new Set(validSlots.map((s) => s.ampm)))
    const hrOptions = validSlots.filter((s) => s.ampm === value.ampm).map((s) => s.hr)

    const selectStyle = {
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        padding: '8px 10px', fontSize: '14px', color: 'var(--text)',
        background: 'var(--surface)', outline: 'none',
        opacity: !dateStr ? 0.4 : 1,
    }

    return (
        <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--muted)', marginBottom: '6px' }}>{label}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
                <select value={value.hr} onChange={(e) => {
                    const hr = e.target.value
                    const match = validSlots.find((s) => s.hr === hr)
                    onChange({ ...value, hr, ampm: match?.ampm || value.ampm })
                }} disabled={!dateStr} style={selectStyle}>
                    {hrOptions.length === 0 ? <option>{value.hr}</option> : hrOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={value.min} onChange={(e) => onChange({ ...value, min: e.target.value })} disabled={!dateStr} style={selectStyle}>
                    {MINS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={value.ampm} onChange={(e) => {
                    const ampm = e.target.value
                    const validHrs = validSlots.filter((s) => s.ampm === ampm).map((s) => s.hr)
                    const hr = validHrs.includes(value.hr) ? value.hr : validHrs[0] || value.hr
                    onChange({ ...value, ampm, hr })
                }} disabled={!dateStr} style={selectStyle}>
                    {ampmOptions.length === 0 ? <option>{value.ampm}</option> : ampmOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
        </div>
    )
}

const inputStyle = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '8px 12px', fontSize: '14px', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '500' as const,
    color: 'var(--muted)', marginBottom: '6px',
}

export default function BookingDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [booking, setBooking] = useState<Booking | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [editMode, setEditMode] = useState(false)

    const [allPets, setAllPets] = useState<Pet[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [editStartDate, setEditStartDate] = useState('')
    const [editStartTime, setEditStartTime] = useState<TimeValue>({ hr: '8', min: '00', ampm: 'AM' })
    const [editEndDate, setEditEndDate] = useState('')
    const [editEndTime, setEditEndTime] = useState<TimeValue>({ hr: '12', min: '00', ampm: 'PM' })
    const [editNotes, setEditNotes] = useState('')
    const [editPetIds, setEditPetIds] = useState<string[]>([])
    const [editRoomMap, setEditRoomMap] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => { fetchBooking() }, [id])

    async function fetchBooking() {
        setLoading(true)
        const { data } = await supabase
            .from('bookings')
            .select(`
        id, status, start_date, end_date, start_time, end_time, notes, created_at,
        customer:customers(id, full_name, phone, whatsapp),
        booking_pets(id, pet:pets(id, pet_name, species, breed), room:rooms(id, room_name, room_type))
      `)
            .eq('id', id)
            .single()
        setBooking( data as unknown as unknown as Booking)
        setLoading(false)
    }

    async function openEdit() {
        if (!booking) return
        setEditStartDate(booking.start_date)
        setEditStartTime(parseTimeString(booking.start_time))
        setEditEndDate(booking.end_date)
        setEditEndTime(parseTimeString(booking.end_time))
        setEditNotes(booking.notes || '')
        setEditPetIds(booking.booking_pets.map((bp) => bp.pet?.id || '').filter(Boolean))
        const roomMap: Record<string, string> = {}
        booking.booking_pets.forEach((bp) => { if (bp.pet?.id && bp.room?.id) roomMap[bp.pet.id] = bp.room.id })
        setEditRoomMap(roomMap)
        const [petsRes, roomsRes] = await Promise.all([
            supabase.from('pets').select('id, pet_name').eq('customer_id', booking.customer?.id || ''),
            supabase.from('rooms').select('id, room_name, room_type').eq('is_active', true).order('room_name'),
        ])
        setAllPets(petsRes.data || [])
        setRooms(roomsRes.data || [])
        setEditMode(true)
    }

    function toggleEditPet(petId: string) {
        setEditPetIds((prev) => {
            const selected = prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]
            if (!selected.includes(petId)) setEditRoomMap((r) => { const m = { ...r }; delete m[petId]; return m })
            return selected
        })
    }

    async function handleSaveEdit() {
        if (!editStartDate || !editEndDate) return alert('Please select dates')
        if (editPetIds.length === 0) return alert('Please select at least one pet')
        if (editEndDate < editStartDate) return alert('End date must be after start date')
        setSaving(true)
        await supabase.from('bookings').update({
            start_date: editStartDate, end_date: editEndDate,
            start_time: formatTimeValue(editStartTime), end_time: formatTimeValue(editEndTime),
            notes: editNotes || null,
        }).eq('id', id)
        await supabase.from('booking_pets').delete().eq('booking_id', id)
        await supabase.from('booking_pets').insert(
            editPetIds.map((petId) => ({ booking_id: id, pet_id: petId, room_id: editRoomMap[petId] || null }))
        )
        setEditMode(false)
        fetchBooking()
        setSaving(false)
    }

    async function handleStatusChange(nextStatus: string) {
        setUpdating(true)
        await supabase.from('bookings').update({ status: nextStatus }).eq('id', id)
        fetchBooking()
        setUpdating(false)
    }

    async function handleCancel() {
        if (!confirm('Cancel this booking?')) return
        await handleStatusChange('cancelled')
    }

    async function handleDelete() {
        if (!confirm('Delete this booking permanently?')) return
        await supabase.from('bookings').delete().eq('id', id)
        router.push('/bookings')
    }

    if (loading) return <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading...</p>
    if (!booking) return <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Booking not found.</p>

    const isOverstay = booking.status === 'checked_in' && booking.end_date < getToday()
    const badge = isOverstay
        ? { label: 'Overstay', bg: '#fdecea', color: '#9b2a2a' }
        : STATUS_BADGE[booking.status] ?? { label: booking.status, bg: '#f0eeea', color: '#5a5a56' }
    const nextAction = STATUS_FLOW[booking.status]
    const nights = nightsBetween(booking.start_date, booking.end_date)
    const editWarnings = editMode ? getWarnings(editStartDate, editEndDate, editEndTime) : []

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <Link href="/bookings" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
                ← Bookings
            </Link>

            {/* Overstay Banner */}
            {isOverstay && (
                <div style={{ background: '#fdecea', borderRadius: 'var(--radius)', padding: '12px 20px', fontSize: '13px', fontWeight: '500', color: '#9b2a2a' }}>
                    This pet has overstayed — checkout was {formatDateEn(booking.end_date)}
                </div>
            )}

            {/* Main Card */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>
                                {booking.customer?.full_name || 'Unknown'}
                            </h1>
                            <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '500' }}>
                {badge.label}
              </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                            {formatDateEn(booking.start_date)} → {formatDateEn(booking.end_date)} · {nights} night{nights !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {!editMode && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {nextAction && (
                                <button onClick={() => handleStatusChange(nextAction.next)} disabled={updating}
                                        style={{ background: nextAction.bg, color: nextAction.color, border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: updating ? 0.5 : 1 }}>
                                    {updating ? '...' : nextAction.label}
                                </button>
                            )}
                            <button onClick={openEdit}
                                    style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                                Edit
                            </button>
                            {booking.status !== 'cancelled' && booking.status !== 'checked_out' && (
                                <button onClick={handleCancel}
                                        style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            )}
                            <button onClick={handleDelete}
                                    style={{ background: 'transparent', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>
                                Delete
                            </button>
                        </div>
                    )}
                </div>

                {/* View Mode */}
                {!editMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Customer info */}
                        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                            {[
                                { label: 'Customer', value: booking.customer?.full_name, link: `/customers/${booking.customer?.id}` },
                                { label: 'Phone', value: booking.customer?.phone },
                                { label: 'WhatsApp', value: booking.customer?.whatsapp },
                                { label: 'Nights', value: String(nights) },
                            ].map(({ label, value, link }) => (
                                <div key={label}>
                                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</p>
                                    {link && value
                                        ? <Link href={link} style={{ fontSize: '14px', fontWeight: '500', color: 'var(--accent)', textDecoration: 'none' }}>{value}</Link>
                                        : <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{value || '—'}</p>
                                    }
                                </div>
                            ))}
                        </div>

                        {/* Dates & times */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {[
                                { label: 'Check-in', date: booking.start_date, time: booking.start_time },
                                { label: 'Check-out', date: booking.end_date, time: booking.end_time },
                            ].map(({ label, date, time }) => (
                                <div key={label} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px' }}>
                                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</p>
                                    <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{formatDateEn(date)}</p>
                                    {time && <p style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '2px' }}>{time}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Pets & rooms */}
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                Pets & rooms
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {booking.booking_pets.map((bp) => (
                                    <div key={bp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '12px 18px' }}>
                                        <div>
                                            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>{bp.pet?.pet_name || '—'}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                                {[bp.pet?.species, bp.pet?.breed].filter(Boolean).join(' · ') || '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '13px', color: bp.room ? 'var(--text)' : 'var(--muted)', fontWeight: bp.room ? '500' : '400' }}>
                                                {bp.room?.room_name || 'No room assigned'}
                                            </p>
                                            {bp.room?.room_type && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{bp.room.room_type}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        {booking.notes && (
                            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '14px 18px' }}>
                                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>Notes</p>
                                <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.6' }}>{booking.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Edit Mode */}
                {editMode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Check-in date</label>
                                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} style={inputStyle} />
                            </div>
                            <TimePicker label="Check-in time" value={editStartTime} onChange={setEditStartTime} dateStr={editStartDate} />
                        </div>

                        {getDayOfWeek(editStartDate) === 0 && (
                            <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                                Sunday check-in — $35 fee applies
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Check-out date</label>
                                <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} style={inputStyle} />
                            </div>
                            <TimePicker label="Check-out time" value={editEndTime} onChange={setEditEndTime} dateStr={editEndDate} />
                        </div>

                        {getDayOfWeek(editEndDate) === 0 && (
                            <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                                Sunday check-out — $35 fee applies
                            </div>
                        )}

                        {editWarnings.find(w => w.includes('outside business hours')) && (
                            <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                                Check-out outside business hours — additional day will be charged
                            </div>
                        )}

                        {/* Pets & Rooms */}
                        <div>
                            <label style={labelStyle}>Pets & rooms</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {allPets.map((pet) => (
                                    <div key={pet.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={editPetIds.includes(pet.id)} onChange={() => toggleEditPet(pet.id)} />
                                            {pet.pet_name}
                                        </label>
                                        {editPetIds.includes(pet.id) && (
                                            <select value={editRoomMap[pet.id] || ''} onChange={(e) => setEditRoomMap((prev) => ({ ...prev, [pet.id]: e.target.value }))}
                                                    style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}>
                                                <option value="">Assign room (optional)</option>
                                                {rooms.map((r) => (
                                                    <option key={r.id} value={r.id}>{r.room_name}{r.room_type ? ` · ${r.room_type}` : ''}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label style={labelStyle}>Notes</label>
                            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleSaveEdit} disabled={saving} style={{
                                background: 'var(--accent)', color: '#fff', border: 'none',
                                borderRadius: 'var(--radius-sm)', padding: '10px 20px',
                                fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.5 : 1,
                            }}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button onClick={() => setEditMode(false)} style={{
                                background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
                            }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}