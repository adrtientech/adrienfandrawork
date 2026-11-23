import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

export function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const now = new Date()
    const past = new Date(dateStr)
    const diffMs = now.getTime() - past.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays} hari lalu`
    if (diffHours > 0) return `${diffHours} jam lalu`
    return 'Baru saja'
  } catch {
    return dateStr
  }
}

export function formatCurrencyUSD(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount)
}
