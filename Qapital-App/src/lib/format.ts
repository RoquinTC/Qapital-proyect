/**
 * Format a number as Colombian pesos.
 * Shows up to 2 decimal places when the value has fractional parts.
 */
export function formatCurrency(value: number): string {
  const hasDecimals = value % 1 !== 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Shortened currency format (e.g., $1.5M)
 */
export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value}`
}
