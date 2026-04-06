'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type Customer = {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    created_at: string
}

type CustomerForm = {
    full_name: string
    email: string
    phone: string
    whatsapp: string
    notes: string
}

type Pet = { id: string; pet_name: string }
type Room = { id: string; room_name: string; room_type: string | null }

type TimeValue = { hr: string; min: string; ampm: string }

type BookingForm = {
    start_date: string
    start_time: TimeValue
    end_date: string
    end_time: TimeValue
    notes: string
    pet_ids: string[]
    room_map: Record<string, string>
}

const emptyCustomerForm: CustomerForm = {
    full_name: '', email: '', phone: '', whatsapp: '', notes: '',
}

function toTitleCase(str: string): string {
    if (!str) return ''
    return str.trim().toLowerCase().split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    const area = digits.slice(0, 3)
    const mid = digits.slice(3, 6)
    const last = digits.slice(6, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${area}`
    if (digits.length <= 6) return `(${area}) - ${mid}`
    return `(${area}) - ${mid} - ${last}`
}

const emptyBookingForm: BookingForm = {
    start_date: '',
    start_time: { hr: '8', min: '00', ampm: 'AM' },
    end_date: '',
    end_time: { hr: '12', min: '00', ampm: 'PM' },
    notes: '',
    pet_ids: [],
    room_map: {},
}

const MINS = ['00', '15', '30', '45']

function getDayOfWeek(dateStr: string): number | null {
    if (!dateStr) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).getDay()
}

function getDayName(dateStr: string): string {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', { weekday: 'long' })
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

function formatTime(t: TimeValue): string {
    return `${t.hr}:${t.min} ${t.ampm}`
}

function formatDateEn(dateStr: string): string {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
    })
}

type Warning = { type: string; message: string }

function getWarnings(form: BookingForm): Warning[] {
    const warnings: Warning[] = []
    const startDay = getDayOfWeek(form.start_date)
    const endDay = getDayOfWeek(form.end_date)
    if (startDay === 0) warnings.push({ type: 'sunday_checkin', message: '$35 Sunday fee applies for check-in' })
    if (endDay === 0) warnings.push({ type: 'sunday_checkout', message: '$35 Sunday fee applies for check-out' })
    if (form.end_date && form.end_time.hr) {
        const endMins = timeToMinutes(form.end_time)
        if (endDay !== null && endDay !== 0) {
            const limit = endDay === 6
                ? timeToMinutes({ hr: '4', min: '00', ampm: 'PM' })
                : timeToMinutes({ hr: '6', min: '00', ampm: 'PM' })
            if (endMins > limit) {
                warnings.push({ type: 'after_hours', message: 'Check-out outside business hours — additional day will be charged' })
            }
        }
    }
    return warnings
}

function TimePicker({ value, onChange, dateStr, label }: {
    value: TimeValue
    onChange: (v: TimeValue) => void
    dateStr: string
    label: string
}) {
    const day = getDayOfWeek(dateStr)
    const validSlots = getValidHours(day)
    const ampmOptions = Array.from(new Set(validSlots.map((s) => s.ampm)))
    const hrOptions = validSlots.filter((s) => s.ampm === value.ampm).map((s) => s.hr)

    function setHr(hr: string) {
        const match = validSlots.find((s) => s.hr === hr)
        onChange({ ...value, hr, ampm: match?.ampm || value.ampm })
    }
    function setAmpm(ampm: string) {
        const validHrs = validSlots.filter((s) => s.ampm === ampm).map((s) => s.hr)
        const hr = validHrs.includes(value.hr) ? value.hr : validHrs[0] || value.hr
        onChange({ ...value, ampm, hr })
    }

    const selectStyle = {
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        fontSize: '14px',
        color: 'var(--text)',
        background: 'var(--surface)',
        outline: 'none',
        opacity: !dateStr ? 0.4 : 1,
    }

    return (
        <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--muted)', marginBottom: '6px' }}>
                {label}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
                <select value={value.hr} onChange={(e) => setHr(e.target.value)} disabled={!dateStr} style={selectStyle}>
                    {hrOptions.length === 0 ? <option>{value.hr}</option> : hrOptions.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select value={value.min} onChange={(e) => onChange({ ...value, min: e.target.value })} disabled={!dateStr} style={selectStyle}>
                    {MINS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={value.ampm} onChange={(e) => setAmpm(e.target.value)} disabled={!dateStr} style={selectStyle}>
                    {ampmOptions.length === 0 ? <option>{value.ampm}</option> : ampmOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
        </div>
    )
}

const inputStyle = {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--surface)',
    outline: 'none',
    boxSizing: 'border-box' as const,
}

const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500' as const,
    color: 'var(--muted)',
    marginBottom: '6px',
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState<CustomerForm>(emptyCustomerForm)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')

    const [bookingFor, setBookingFor] = useState<Customer | null>(null)
    const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm)
    const [pets, setPets] = useState<Pet[]>([])
    const [rooms, setRooms] = useState<Room[]>([])
    const [savingBooking, setSavingBooking] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    useEffect(() => { fetchCustomers() }, [])

    async function fetchCustomers() {
        setLoading(true)
        const { data } = await supabase
            .from('customers')
            .select('id, full_name, email, phone, whatsapp, created_at')
            .order('created_at', { ascending: false })
        setCustomers(data || [])
        setLoading(false)
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    }

    async function handleSave() {
        if (!form.full_name.trim()) return alert('Full name is required')
        setSaving(true)
        const { error } = await supabase.from('customers').insert([{
            full_name: toTitleCase(form.full_name),
            email: form.email || null,
            phone: form.phone || null,
            whatsapp: form.whatsapp || null,
            notes: form.notes || null,
        }])
        if (!error) {
            setForm(emptyCustomerForm)
            setShowForm(false)
            fetchCustomers()
        }
        setSaving(false)
    }

    async function openBookingForm(customer: Customer) {
        setBookingFor(customer)
        setBookingForm(emptyBookingForm)
        setShowConfirm(false)
        const [petsRes, roomsRes] = await Promise.all([
            supabase.from('pets').select('id, pet_name').eq('customer_id', customer.id),
            supabase.from('rooms').select('id, room_name, room_type').eq('is_active', true).order('room_name'),
        ])
        setPets(petsRes.data || [])
        setRooms(roomsRes.data || [])
    }

    function closeBookingForm() {
        setBookingFor(null)
        setBookingForm(emptyBookingForm)
        setShowConfirm(false)
    }

    function togglePet(petId: string) {
        setBookingForm((prev) => {
            const selected = prev.pet_ids.includes(petId)
                ? prev.pet_ids.filter((id) => id !== petId)
                : [...prev.pet_ids, petId]
            const room_map = { ...prev.room_map }
            if (!selected.includes(petId)) delete room_map[petId]
            return { ...prev, pet_ids: selected, room_map }
        })
    }

    function setRoom(petId: string, roomId: string) {
        setBookingForm((prev) => ({ ...prev, room_map: { ...prev.room_map, [petId]: roomId } }))
    }

    function handleReviewBooking() {
        if (!bookingFor) return
        if (!bookingForm.start_date || !bookingForm.end_date) return alert('Please select dates')
        if (bookingForm.pet_ids.length === 0) return alert('Please select at least one pet')
        if (bookingForm.end_date < bookingForm.start_date) return alert('End date must be after start date')
        setShowConfirm(true)
    }

    async function handleConfirmBooking() {
        if (!bookingFor) return
        setSavingBooking(true)

        const notes = [
            bookingForm.notes,
            warnings.find(w => w.type === 'after_hours') ? '⚠ Check-out outside hours — additional day charge applies' : '',
            warnings.filter(w => w.type === 'sunday_checkin' || w.type === 'sunday_checkout').map(w => `⚠ ${w.message}`).join('\n'),
        ].filter(Boolean).join('\n').trim()

        const { data: booking, error } = await supabase
            .from('bookings')
            .insert([{
                customer_id: bookingFor.id,
                start_date: bookingForm.start_date,
                end_date: bookingForm.end_date,
                start_time: formatTime(bookingForm.start_time),
                end_time: formatTime(bookingForm.end_time),
                status: 'pending_confirmation',
                notes: notes || null,
            }])
            .select('id')
            .single()

        if (error || !booking) {
            alert('Failed to create booking.')
            setSavingBooking(false)
            return
        }

        await supabase.from('booking_pets').insert(
            bookingForm.pet_ids.map((petId) => ({
                booking_id: booking.id,
                pet_id: petId,
                room_id: bookingForm.room_map[petId] || null,
            }))
        )

        closeBookingForm()
        setSavingBooking(false)
    }

    const warnings = getWarnings(bookingForm)
    const startDay = getDayOfWeek(bookingForm.start_date)
    const endDay = getDayOfWeek(bookingForm.end_date)

    const filtered = customers.filter((c) =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>Customers</h1>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                        {customers.length} customer{customers.length !== 1 ? 's' : ''} total
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    style={{
                        background: showForm ? 'var(--surface)' : 'var(--accent)',
                        color: showForm ? 'var(--muted)' : '#fff',
                        border: showForm ? '1px solid var(--border)' : 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                    }}
                >
                    {showForm ? 'Cancel' : '+ Add customer'}
                </button>
            </div>

            {/* Add Customer Form */}
            {showForm && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>New customer</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[
                            { label: 'Full name *', name: 'full_name', type: 'text', placeholder: 'Jane Smith' },
                            { label: 'Email', name: 'email', type: 'email', placeholder: 'jane@example.com' },
                            { label: 'Phone', name: 'phone', type: 'text', placeholder: '(587) - 435 - 3628' },
                            { label: 'WhatsApp', name: 'whatsapp', type: 'text', placeholder: '(587) - 435 - 3628' },
                        ].map(({ label, name, type, placeholder }) => (
                            <div key={name}>
                                <label style={labelStyle}>{label}</label>
                                <input
                                    type={type}
                                    name={name}
                                    value={(form as any)[name]}
                                    onChange={(e) => {
                                        const val = (name === 'phone' || name === 'whatsapp')
                                            ? formatPhone(e.target.value)
                                            : e.target.value
                                        setForm((prev) => ({ ...prev, [name]: val }))
                                    }}
                                    placeholder={placeholder}
                                    style={inputStyle}
                                />
                            </div>
                        ))}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Notes</label>
                            <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                                      style={{ ...inputStyle, resize: 'vertical' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button onClick={handleSave} disabled={saving} style={{
                            background: 'var(--accent)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.5 : 1,
                        }}>
                            {saving ? 'Saving...' : 'Save customer'}
                        </button>
                        <button onClick={() => { setShowForm(false); setForm(emptyCustomerForm) }} style={{
                            background: 'transparent', color: 'var(--muted)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Booking Form */}
            {bookingFor && !showConfirm && (
                <div style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)',
                    padding: '24px', border: '2px solid var(--accent)',
                    display: 'flex', flexDirection: 'column', gap: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                            New booking — <span style={{ color: 'var(--accent)' }}>{bookingFor.full_name}</span>
                        </p>
                        <button onClick={closeBookingForm} style={{
                            background: 'transparent', border: 'none', fontSize: '13px',
                            color: 'var(--muted)', cursor: 'pointer',
                        }}>Cancel</button>
                    </div>

                    {/* Check-in */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Check-in date *</label>
                            <input type="date" value={bookingForm.start_date}
                                   onChange={(e) => setBookingForm((p) => ({ ...p, start_date: e.target.value }))}
                                   style={inputStyle} />
                            {bookingForm.start_date && (
                                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                    {getDayName(bookingForm.start_date)}
                                </p>
                            )}
                        </div>
                        <TimePicker label="Check-in time" value={bookingForm.start_time}
                                    onChange={(v) => setBookingForm((p) => ({ ...p, start_time: v }))}
                                    dateStr={bookingForm.start_date} />
                    </div>

                    {startDay === 0 && (
                        <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                            Sunday check-in — $35 fee applies
                        </div>
                    )}

                    {/* Check-out */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Check-out date *</label>
                            <input type="date" value={bookingForm.end_date}
                                   onChange={(e) => setBookingForm((p) => ({ ...p, end_date: e.target.value }))}
                                   style={inputStyle} />
                            {bookingForm.end_date && (
                                <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                    {getDayName(bookingForm.end_date)}
                                </p>
                            )}
                        </div>
                        <TimePicker label="Check-out time" value={bookingForm.end_time}
                                    onChange={(v) => setBookingForm((p) => ({ ...p, end_time: v }))}
                                    dateStr={bookingForm.end_date} />
                    </div>

                    {endDay === 0 && (
                        <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                            Sunday check-out — $35 fee applies
                        </div>
                    )}

                    {warnings.find(w => w.type === 'after_hours') && (
                        <div style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                            Check-out outside business hours — additional day will be charged
                        </div>
                    )}

                    {/* Pets */}
                    <div>
                        <label style={labelStyle}>Pets *</label>
                        {pets.length === 0 ? (
                            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                No pets found.{' '}
                                <Link href={`/customers/${bookingFor.id}`} style={{ color: 'var(--accent)' }}>Add pets →</Link>
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {pets.map((pet) => (
                                    <div key={pet.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={bookingForm.pet_ids.includes(pet.id)}
                                                   onChange={() => togglePet(pet.id)} />
                                            {pet.pet_name}
                                        </label>
                                        {bookingForm.pet_ids.includes(pet.id) && (
                                            <select value={bookingForm.room_map[pet.id] || ''}
                                                    onChange={(e) => setRoom(pet.id, e.target.value)}
                                                    style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface)', outline: 'none' }}>
                                                <option value="">Assign room (optional)</option>
                                                {rooms.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.room_name}{r.room_type ? ` · ${r.room_type}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={labelStyle}>Notes</label>
                        <textarea value={bookingForm.notes}
                                  onChange={(e) => setBookingForm((p) => ({ ...p, notes: e.target.value }))}
                                  rows={2} placeholder="Any special requests..."
                                  style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <button onClick={handleReviewBooking} style={{
                        background: 'var(--accent)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-sm)', padding: '10px 20px',
                        fontSize: '13px', fontWeight: '500', cursor: 'pointer', alignSelf: 'flex-start',
                    }}>
                        Review booking →
                    </button>
                </div>
            )}

            {/* Confirmation Summary */}
            {bookingFor && showConfirm && (
                <div style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)',
                    padding: '24px', border: '2px solid var(--accent)',
                    display: 'flex', flexDirection: 'column', gap: '20px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Confirm booking</p>
                        <button onClick={() => setShowConfirm(false)} style={{
                            background: 'transparent', border: 'none', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer',
                        }}>← Edit</button>
                    </div>

                    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'Customer', value: bookingFor.full_name },
                            { label: 'Pets', value: bookingForm.pet_ids.map((id) => pets.find((p) => p.id === id)?.pet_name).filter(Boolean).join(', ') },
                            { label: 'Check-in', value: `${formatDateEn(bookingForm.start_date)} · ${formatTime(bookingForm.start_time)}` },
                            {
                                label: 'Check-out',
                                value: `${formatDateEn(bookingForm.end_date)} · ${formatTime(bookingForm.end_time)}`,
                                suffix: warnings.find(w => w.type === 'after_hours') ? '+1 day charge' : null,
                            },
                            ...(bookingForm.notes ? [{ label: 'Notes', value: bookingForm.notes }] : []),
                        ].map(({ label, value, suffix }: any) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{label}</span>
                                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '500', textAlign: 'right' }}>
                  {value}
                                    {suffix && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#9b2a2a', fontWeight: '500' }}>{suffix}</span>}
                </span>
                            </div>
                        ))}
                    </div>

                    {warnings.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {warnings.map((w, i) => (
                                <div key={i} style={{ background: '#fdecea', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '12px', fontWeight: '500', color: '#9b2a2a' }}>
                                    ⚠ {w.message}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleConfirmBooking} disabled={savingBooking} style={{
                            background: 'var(--accent)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-sm)', padding: '10px 20px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: savingBooking ? 0.5 : 1,
                        }}>
                            {savingBooking ? 'Saving...' : 'Confirm & create booking'}
                        </button>
                        <button onClick={closeBookingForm} style={{
                            background: 'transparent', color: 'var(--muted)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            padding: '10px 16px', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Search by name, email, or phone..."
                   style={{ ...inputStyle, padding: '10px 16px' }} />

            {/* Table */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                {loading ? (
                    <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>Loading...</p>
                ) : filtered.length === 0 ? (
                    <p style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--muted)' }}>
                        {search ? 'No customers match your search.' : 'No customers yet.'}
                    </p>
                ) : (
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>WhatsApp</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((c) => (
                            <tr key={c.id}>
                                <td className="primary">
                                    <Link href={`/customers/${c.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}
                                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                        {c.full_name}
                                    </Link>
                                </td>
                                <td>{c.email || '—'}</td>
                                <td>{c.phone || '—'}</td>
                                <td>{c.whatsapp || '—'}</td>
                                <td>
                                    <button
                                        onClick={() => openBookingForm(c)}
                                        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 14px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
                                    >
                                        Book
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}