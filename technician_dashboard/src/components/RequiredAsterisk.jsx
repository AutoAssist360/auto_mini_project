export default function RequiredAsterisk({ className = '' }) {
  return (
    <span aria-hidden="true" className={`ml-1 text-red-500 ${className}`.trim()}>
      *
    </span>
  )
}
