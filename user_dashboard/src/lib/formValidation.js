import { useCallback, useRef } from 'react'

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const PHONE_REGEX = /^\d{10}$/
export const UPI_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i
export const REGISTRATION_REGEX = /^[A-Z0-9\- ]{1,20}$/i

export function createEmptyErrors(fields) {
  return Object.fromEntries([...fields, 'form'].map((field) => [field, '']))
}

export function sanitizeDigits(value, maxLength) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits
}

export function sanitizeUppercaseAlphaNumeric(value, maxLength) {
  const cleaned = String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  return typeof maxLength === 'number' ? cleaned.slice(0, maxLength) : cleaned
}

export function sanitizeUppercaseRegistration(value, maxLength = 20) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9\- ]/g, '')
    .slice(0, maxLength)
}

export function focusFirstError(errors, fieldOrder, refs) {
  const firstField = fieldOrder.find((field) => errors[field])
  if (!firstField) return null

  const element = refs[firstField]
  if (element?.focus) {
    element.focus({ preventScroll: true })
  }
  if (element?.scrollIntoView) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return firstField
}

export function useFirstErrorFocus(fieldOrder) {
  const fieldRefs = useRef({})

  const registerField = useCallback(
    (field) => (element) => {
      if (element) fieldRefs.current[field] = element
      else delete fieldRefs.current[field]
    },
    [],
  )

  const focusFirst = useCallback(
    (errors) => focusFirstError(errors, fieldOrder, fieldRefs.current),
    [fieldOrder],
  )

  return { registerField, focusFirst }
}
