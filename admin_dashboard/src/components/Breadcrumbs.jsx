import { Link } from 'react-router-dom'

/**
 * Breadcrumbs — renders a hierarchical breadcrumb trail.
 *
 * @param {{ items: Array<{ label: string, to?: string }> }} props
 *   items — ordered crumb list; the last item should omit `to` (current page).
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: 'Dashboard', to: '/admin/dashboard' },
 *     { label: 'Users', to: '/admin/users' },
 *     { label: 'John Doe' },
 *   ]} />
 */
export default function Breadcrumbs({ items }) {
  if (!items || items.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-3 overflow-x-auto pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex w-max min-w-full items-center gap-1 whitespace-nowrap text-slate-500 dark:text-slate-400">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.to ? (
              <Link to={item.to} className="block max-w-[11rem] truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className="block max-w-[11rem] truncate font-medium text-slate-700 dark:text-slate-200 sm:max-w-none">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
