export function toTitleCase(str: string): string {
    if (!str) return ''
    return str
        .trim()
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

export function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    const area = digits.slice(0, 3)
    const mid = digits.slice(3, 6)
    const last = digits.slice(6, 10)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${area}`
    if (digits.length <= 6) return `(${area}) - ${mid}`
    return `(${area}) - ${mid} - ${last}`
}