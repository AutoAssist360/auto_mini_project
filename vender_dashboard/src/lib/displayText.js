const LABEL_OVERRIDES = {
  active: 'Active',
  assigned: 'Assigned',
  cancelled: 'Cancelled',
  cash_on_delivery: 'Pay on delivery',
  completed: 'Completed',
  confirmed: 'Confirmed',
  converted: 'Used in order',
  created: 'Created',
  expired: 'Expired',
  failed: 'Failed',
  fulfilled: 'Completed',
  in_progress: 'In progress',
  in_transit: 'On the way',
  onsite: 'At customer location',
  paid: 'Paid',
  pending: 'Pending',
  pending_offers: 'Waiting for offers',
  processing: 'Being prepared',
  refunded: 'Refunded',
  returned: 'Returned',
  shipped: 'Shipped',
  tow_to_garage: 'Tow to garage',
}

function titleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function formatLabel(value, overrides = {}) {
  if (value == null || value === '') return ''

  const normalized = String(value).trim()
  const mapped = overrides[normalized] || LABEL_OVERRIDES[normalized]
  if (mapped) return mapped

  return titleCase(normalized.replace(/_/g, ' ').replace(/-/g, ' '))
}

export function formatUpperLabel(value, overrides = {}) {
  const label = formatLabel(value, overrides)
  return label ? label.toUpperCase() : ''
}
