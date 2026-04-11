const LABEL_OVERRIDES = {
  active: 'Active',
  assigned: 'Ready to start',
  battery_issue: 'Battery problem',
  brake_issue: 'Brake problem',
  cancelled: 'Cancelled',
  cash_on_delivery: 'Pay on delivery',
  completed: 'Completed',
  confirmed: 'Confirmed',
  converted: 'Used in order',
  created: 'New request',
  electrical_issue: 'Electrical problem',
  engine_problem: 'Engine problem',
  failed: 'Failed',
  home: 'Home',
  in_progress: 'Working now',
  mechanical_failure: 'Mechanical problem',
  offer_accepted: 'Accepted',
  office: 'Office',
  onsite: 'At customer location',
  parking: 'Parking',
  pending: 'Pending',
  pending_offers: 'Waiting for offers',
  processing: 'Being prepared',
  refunded: 'Refunded',
  rejected: 'Rejected',
  returned: 'Returned',
  roadside: 'Roadside',
  shipped: 'Shipped',
  tire_related: 'Tyre problem',
  tow_to_garage: 'Tow to garage',
  verified: 'Checked',
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
