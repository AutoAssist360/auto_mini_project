const LABEL_OVERRIDES = {
  assigned: 'Waiting to start',
  pending_offers: 'Waiting for offers',
  offer_accepted: 'Offer accepted',
  in_progress: 'In progress',
  tow_to_garage: 'Tow to workshop',
  onsite: 'On-site visit',
  cash_on_delivery: 'Cash on delivery',
  mechanical_failure: 'Mechanical failure',
  electrical_issue: 'Electrical issue',
  tire_related: 'Tire related',
  battery_issue: 'Battery issue',
  engine_problem: 'Engine problem',
  brake_issue: 'Brake issue',
  in_transit: 'In transit',
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
