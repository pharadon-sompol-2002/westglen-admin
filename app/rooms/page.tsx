'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase/client'

type RoomRow = {
    id: string
    room_name: string
    room_type: string | null
    is_active: boolean
    booking_pets: {
        booking: {
            id: string
            end_date: string
            customer: { full_name: string } | null
        } | null
        pet: { pet_name: string } | null
    }[]
}

type RoomForm = { room_name: string; room_type: string }
const emptyForm: RoomForm = { room_name: '', room_type: '' }

function getToday() {
    return new Date().toISOString().split('T')[0]
}

function formatDate(d: string) {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

export default function RoomsPage() {
    const [rooms, setRooms] = useState<RoomRow[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState<RoomForm>(emptyForm)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<RoomForm>(emptyForm)

    useEffect(() => { fetchRooms() }, [])

    async function fetchRooms() {
        setLoading(true)
        const today = getToday()
        const { data } = await supabase
            .from('rooms')
            .select(`
        id, room_name, room_type, is_active,
        booking_pets(
          pet:pets(pet_name),
          booking:bookings(id, end_date, customer:customers(full_name))
        )
      `)
            .eq('is_active', true)
            .order('room_name')

        const filtered = await Promise.all(
            (data || []).map(async (room: any) => {
                const activePets = []
                for (const bp of room.booking_pets || []) {
                    if (!bp.booking) continue
                    const { data: bk } = await supabase.from('bookings').select('status').eq('id', bp.booking.id).single()
                    if (bk?.status === 'checked_in') activePets.push(bp)
                }
                return { ...room, booking_pets: activePets }
            })
        )

        setRooms(filtered)
        setLoading(false)
    }

    async function handleSave() {
        if (!form.room_name.trim()) return alert('Room name is required')
        setSaving(true)
        const { error } = await supabase.from('rooms').insert([{
            room_name: form.room_name.trim(), room_type: form.room_type || null, is_active: true,
        }])
        if (!error) { setForm(emptyForm); setShowForm(false); fetchRooms() }
        setSaving(false)
    }

    async function handleSaveEdit(id: string) {
        if (!editForm.room_name.trim()) return alert('Room name is required')
        const { error } = await supabase.from('rooms')
            .update({ room_name: editForm.room_name.trim(), room_type: editForm.room_type || null })
            .eq('id', id)
        if (!error) { setEditingId(null); fetchRooms() }
    }

    async function handleDeactivate(id: string, name: string) {
        if (!confirm(`Remove room "${name}"?`)) return
        await supabase.from('rooms').update({ is_active: false }).eq('id', id)
        fetchRooms()
    }

    const available = rooms.filter((r) => r.booking_pets.length === 0)
    const occupied = rooms.filter((r) => r.booking_pets.length > 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>Rooms</h1>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                        {occupied.length} occupied · {available.length} available
                    </p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{
                    background: showForm ? 'transparent' : 'var(--accent)',
                    color: showForm ? 'var(--muted)' : '#fff',
                    border: showForm ? '1px solid var(--border)' : 'none',
                    borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                }}>
                    {showForm ? 'Cancel' : '+ Add room'}
                </button>
            </div>

            {/* Add Room Form */}
            {showForm && (
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '16px' }}>New room</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                            <label style={labelStyle}>Room name *</label>
                            <input type="text" value={form.room_name}
                                   onChange={(e) => setForm((p) => ({ ...p, room_name: e.target.value }))}
                                   placeholder="A1, Room 1, Suite..." style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Type</label>
                            <input type="text" value={form.room_type}
                                   onChange={(e) => setForm((p) => ({ ...p, room_type: e.target.value }))}
                                   placeholder="Standard, Deluxe, Suite..." style={inputStyle} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                        <button onClick={handleSave} disabled={saving} style={{
                            background: 'var(--accent)', color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                            fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: saving ? 0.5 : 1,
                        }}>
                            {saving ? 'Saving...' : 'Save room'}
                        </button>
                        <button onClick={() => { setShowForm(false); setForm(emptyForm) }} style={{
                            background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</p>
            ) : rooms.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No rooms yet. Add your first room above.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Occupied */}
                    {occupied.length > 0 && (
                        <div>
                            <p className="section-title">Occupied ({occupied.length})</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                {occupied.map((room) => {
                                    const bp = room.booking_pets[0]
                                    const isOverstay = bp?.booking?.end_date && bp.booking.end_date < getToday()
                                    return (
                                        <div key={room.id} style={{
                                            background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '18px',
                                            border: isOverstay ? '1.5px solid #fca5a5' : 'none',
                                        }}>
                                            {editingId === room.id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <input type="text" value={editForm.room_name}
                                                           onChange={(e) => setEditForm((p) => ({ ...p, room_name: e.target.value }))}
                                                           style={inputStyle} />
                                                    <input type="text" value={editForm.room_type}
                                                           onChange={(e) => setEditForm((p) => ({ ...p, room_type: e.target.value }))}
                                                           placeholder="Type (optional)" style={inputStyle} />
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <button onClick={() => handleSaveEdit(room.id)} style={{ fontSize: '12px', fontWeight: '500', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                                                        <button onClick={() => setEditingId(null)} style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                        <div>
                                                            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{room.room_name}</p>
                                                            {room.room_type && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{room.room_type}</p>}
                                                        </div>
                                                        <span style={{
                                                            background: isOverstay ? '#fdecea' : '#fdecea',
                                                            color: '#9b2a2a', padding: '3px 10px',
                                                            borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                                                        }}>
                              {isOverstay ? 'Overstay' : 'Occupied'}
                            </span>
                                                    </div>

                                                    <div style={{ marginBottom: '12px' }}>
                                                        <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)' }}>
                                                            {bp?.pet?.pet_name || '—'}
                                                        </p>
                                                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                                            {bp?.booking?.customer?.full_name || '—'}
                                                        </p>
                                                        {bp?.booking && (
                                                            <Link href={`/bookings/${bp.booking.id}`} style={{
                                                                display: 'inline-block', marginTop: '4px',
                                                                fontSize: '12px', color: 'var(--accent)', textDecoration: 'none',
                                                            }}
                                                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                                                checkout {formatDate(bp.booking.end_date)} →
                                                            </Link>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                                                        <button onClick={() => { setEditingId(room.id); setEditForm({ room_name: room.room_name, room_type: room.room_type || '' }) }}
                                                                style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handleDeactivate(room.id, room.room_name)}
                                                                style={{ fontSize: '12px', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                            Remove
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Available */}
                    {available.length > 0 && (
                        <div>
                            <p className="section-title">Available ({available.length})</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                                {available.map((room) => (
                                    <div key={room.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '18px' }}>
                                        {editingId === room.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <input type="text" value={editForm.room_name}
                                                       onChange={(e) => setEditForm((p) => ({ ...p, room_name: e.target.value }))}
                                                       style={inputStyle} />
                                                <input type="text" value={editForm.room_type}
                                                       onChange={(e) => setEditForm((p) => ({ ...p, room_type: e.target.value }))}
                                                       placeholder="Type (optional)" style={inputStyle} />
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleSaveEdit(room.id)} style={{ fontSize: '12px', fontWeight: '500', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                                                    <button onClick={() => setEditingId(null)} style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <div>
                                                        <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{room.room_name}</p>
                                                        {room.room_type && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{room.room_type}</p>}
                                                    </div>
                                                    <span style={{
                                                        background: '#d0ecda', color: '#1a5c34',
                                                        padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                                                    }}>
                            Available
                          </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                                                    <button onClick={() => { setEditingId(room.id); setEditForm({ room_name: room.room_name, room_type: room.room_type || '' }) }}
                                                            style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleDeactivate(room.id, room.room_name)}
                                                            style={{ fontSize: '12px', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        Remove
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}