'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase/client'

type Customer = {
    id: string
    full_name: string
    email: string | null
    phone: string | null
    whatsapp: string | null
    notes: string | null
    created_at: string
}

type Pet = {
    id: string
    pet_name: string
    species: string | null
    breed: string | null
    age_years: number | null
    medical_notes: string | null
}

type VaccinationRecord = {
    id: string
    file_name: string
    file_url: string
    uploaded_at: string
    pet_id: string
}

type PetForm = {
    pet_name: string
    species: string
    breed: string
    age_years: string
    medical_notes: string
}

const emptyPetForm: PetForm = {
    pet_name: '', species: '', breed: '', age_years: '', medical_notes: '',
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

const inputStyle = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '8px 12px', fontSize: '14px', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box' as const,
}

const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: '500' as const,
    color: 'var(--muted)', marginBottom: '6px',
}

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [customer, setCustomer] = useState<Customer | null>(null)
    const [pets, setPets] = useState<Pet[]>([])
    const [vaccRecords, setVaccRecords] = useState<VaccinationRecord[]>([])
    const [loading, setLoading] = useState(true)

    const [showPetForm, setShowPetForm] = useState(false)
    const [petForm, setPetForm] = useState<PetForm>(emptyPetForm)
    const [savingPet, setSavingPet] = useState(false)

    const [uploadingFor, setUploadingFor] = useState<string | null>(null)

    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState<Partial<Customer>>({})
    const [savingEdit, setSavingEdit] = useState(false)

    useEffect(() => { fetchAll() }, [id])

    async function fetchAll() {
        setLoading(true)
        await Promise.all([fetchCustomer(), fetchPets(), fetchVaccRecords()])
        setLoading(false)
    }

    async function fetchCustomer() {
        const { data } = await supabase.from('customers').select('*').eq('id', id).single()
        if (data) { setCustomer(data); setEditForm(data) }
    }

    async function fetchPets() {
        const { data } = await supabase.from('pets').select('*').eq('customer_id', id).order('created_at', { ascending: true })
        setPets(data || [])
    }

    async function fetchVaccRecords() {
        const { data } = await supabase.from('vaccination_records').select('*').order('uploaded_at', { ascending: false })
        setVaccRecords(data || [])
    }

    async function handleSaveEdit() {
        if (!editForm.full_name?.trim()) return alert('Full name is required')
        setSavingEdit(true)
        const { error } = await supabase.from('customers').update({
            full_name: toTitleCase(editForm.full_name || ''),
            email: editForm.email || null,
            phone: editForm.phone || null,
            whatsapp: editForm.whatsapp || null,
            notes: editForm.notes || null,
        }).eq('id', id)
        if (!error) { setEditMode(false); fetchCustomer() }
        setSavingEdit(false)
    }

    async function handleDeleteCustomer() {
        if (!confirm(`Delete ${customer?.full_name}? This cannot be undone.`)) return
        const { error } = await supabase.from('customers').delete().eq('id', id)
        if (!error) router.push('/customers')
        else alert('Failed to delete customer.')
    }

    async function handleSavePet() {
        if (!petForm.pet_name.trim()) return alert('Pet name is required')
        setSavingPet(true)
        const { error } = await supabase.from('pets').insert([{
            customer_id: id,
            pet_name: petForm.pet_name.trim(),
            species: petForm.species || null,
            breed: petForm.breed || null,
            age_years: petForm.age_years ? parseInt(petForm.age_years) : null,
            medical_notes: petForm.medical_notes || null,
        }])
        if (!error) { setPetForm(emptyPetForm); setShowPetForm(false); fetchPets() }
        setSavingPet(false)
    }

    async function handleDeletePet(petId: string, petName: string) {
        if (!confirm(`Delete ${petName}?`)) return
        await supabase.from('pets').delete().eq('id', petId)
        fetchPets()
    }

    async function handleUploadVacc(petId: string, file: File) {
        setUploadingFor(petId)
        const filePath = `${petId}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('vaccination-records').upload(filePath, file)
        if (uploadError) { alert('Upload failed.'); setUploadingFor(null); return }
        const { data: urlData } = supabase.storage.from('vaccination-records').getPublicUrl(filePath)
        await supabase.from('vaccination_records').insert([{ pet_id: petId, file_name: file.name, file_url: urlData.publicUrl }])
        fetchVaccRecords()
        setUploadingFor(null)
    }

    if (loading) return <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading...</p>
    if (!customer) return <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Customer not found.</p>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <Link href="/customers" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
                ← Customers
            </Link>

            {/* Customer Info Card */}
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)' }}>{customer.full_name}</h1>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditMode(!editMode)} style={{
                            background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
                        }}>
                            {editMode ? 'Cancel' : 'Edit'}
                        </button>
                        <button onClick={handleDeleteCustomer} style={{
                            background: 'transparent', color: '#b91c1c', border: '1px solid #fecaca',
                            borderRadius: 'var(--radius-sm)', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
                        }}>
                            Delete
                        </button>
                    </div>
                </div>

                {editMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {[
                                { label: 'Full name *', key: 'full_name', type: 'text' },
                                { label: 'Email', key: 'email', type: 'email' },
                                { label: 'Phone', key: 'phone', type: 'text' },
                                { label: 'WhatsApp', key: 'whatsapp', type: 'text' },
                            ].map(({ label, key, type }) => (
                                <div key={key}>
                                    <label style={labelStyle}>{label}</label>
                                    <input
                                        type={type}
                                        value={(editForm as any)[key] || ''}
                                        onChange={(e) => {
                                            const val = (key === 'phone' || key === 'whatsapp')
                                                ? formatPhone(e.target.value)
                                                : e.target.value
                                            setEditForm((prev) => ({ ...prev, [key]: val }))
                                        }}
                                        style={inputStyle}
                                    />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Notes</label>
                                <textarea value={editForm.notes || ''}
                                          onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                                          rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                        </div>
                        <div>
                            <button onClick={handleSaveEdit} disabled={savingEdit} style={{
                                background: 'var(--accent)', color: '#fff', border: 'none',
                                borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                                fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: savingEdit ? 0.5 : 1,
                            }}>
                                {savingEdit ? 'Saving...' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        {[
                            { label: 'Email', value: customer.email },
                            { label: 'Phone', value: customer.phone },
                            { label: 'WhatsApp', value: customer.whatsapp },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</p>
                                <p style={{ fontSize: '14px', color: 'var(--text)', fontWeight: '500' }}>{value || '—'}</p>
                            </div>
                        ))}
                        {customer.notes && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Notes</p>
                                <p style={{ fontSize: '14px', color: 'var(--text)' }}>{customer.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pets */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Pets ({pets.length})
                    </p>
                    <button onClick={() => setShowPetForm(!showPetForm)} style={{
                        background: showPetForm ? 'transparent' : 'var(--accent-light)',
                        color: 'var(--accent)', border: '1px solid var(--accent-border)',
                        borderRadius: 'var(--radius-sm)', padding: '5px 14px',
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                    }}>
                        {showPetForm ? 'Cancel' : '+ Add pet'}
                    </button>
                </div>

                {showPetForm && (
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            {[
                                { label: 'Pet name *', key: 'pet_name', placeholder: 'Mochi' },
                                { label: 'Species', key: 'species', placeholder: 'Dog / Cat / Rabbit' },
                                { label: 'Breed', key: 'breed', placeholder: 'Golden Retriever' },
                                { label: 'Age (years)', key: 'age_years', placeholder: '3' },
                            ].map(({ label, key, placeholder }) => (
                                <div key={key}>
                                    <label style={labelStyle}>{label}</label>
                                    <input type="text" value={(petForm as any)[key]}
                                           onChange={(e) => setPetForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                           placeholder={placeholder} style={inputStyle} />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelStyle}>Medical notes</label>
                                <textarea value={petForm.medical_notes}
                                          onChange={(e) => setPetForm((prev) => ({ ...prev, medical_notes: e.target.value }))}
                                          rows={2} placeholder="Allergies, medications, special needs..."
                                          style={{ ...inputStyle, resize: 'vertical' }} />
                            </div>
                        </div>
                        <div style={{ marginTop: '14px' }}>
                            <button onClick={handleSavePet} disabled={savingPet} style={{
                                background: 'var(--accent)', color: '#fff', border: 'none',
                                borderRadius: 'var(--radius-sm)', padding: '8px 16px',
                                fontSize: '13px', fontWeight: '500', cursor: 'pointer', opacity: savingPet ? 0.5 : 1,
                            }}>
                                {savingPet ? 'Saving...' : 'Save pet'}
                            </button>
                        </div>
                    </div>
                )}

                {pets.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No pets added yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pets.map((pet) => {
                            const petVacc = vaccRecords.filter((v) => v.pet_id === pet.id)
                            return (
                                <div key={pet.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{pet.pet_name}</p>
                                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                                {[pet.species, pet.breed, pet.age_years ? `${pet.age_years} yr` : null].filter(Boolean).join(' · ') || '—'}
                                            </p>
                                        </div>
                                        <button onClick={() => handleDeletePet(pet.id, pet.pet_name)} style={{
                                            background: 'transparent', border: 'none', fontSize: '12px',
                                            color: '#b91c1c', cursor: 'pointer',
                                        }}>
                                            Delete
                                        </button>
                                    </div>

                                    {pet.medical_notes && (
                                        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '12px' }}>
                                            <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Medical notes</p>
                                            <p style={{ fontSize: '13px', color: 'var(--text)' }}>{pet.medical_notes}</p>
                                        </div>
                                    )}

                                    {/* Vaccination Records */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '500', color: 'var(--muted)', marginBottom: '8px' }}>
                                            Vaccination records
                                        </p>
                                        {petVacc.length === 0 ? (
                                            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>No records uploaded.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                                {petVacc.map((v) => (
                                                    <a key={v.id} href={v.file_url} target="_blank" rel="noopener noreferrer"
                                                       style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}
                                                       onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                       onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                                        {v.file_name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                        <label style={{ fontSize: '12px', color: 'var(--accent)', cursor: 'pointer', fontWeight: '500' }}>
                                            {uploadingFor === pet.id ? 'Uploading...' : '+ Upload file'}
                                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                                                   onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadVacc(pet.id, file) }}
                                                   disabled={uploadingFor !== null} style={{ display: 'none' }} />
                                        </label>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}