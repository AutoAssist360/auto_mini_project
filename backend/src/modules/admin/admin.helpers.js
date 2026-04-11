 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }import { prisma } from "../../lib/prisma.js";

/**
 * Write an entry to the audit_logs table.
 * Accepts an optional transaction client (`tx`) so the audit log
 * can be written atomically inside a $transaction.
 */
export async function logAudit(params







) {
  const client = _nullishCoalesce(params.tx, () => ( prisma));
  await client.auditLog.create({
    data: {
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      performed_by: params.performedBy,
      old_value: _nullishCoalesce(params.oldValue, () => ( undefined)),
      new_value: _nullishCoalesce(params.newValue, () => ( undefined)),
    },
  });
}

/**
 * Build Prisma-compatible date range filter.
 */
export function dateFilter(from, to) {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) filter.gte = new Date(from);
  if (to) {
    // when calling from a <input type="date" /> the value is YYYY-MM-DD
    // `new Date('2023-05-17')` gives midnight of that day which means any
    // rows later on the same date are excluded when using `lte`.
    // we treat simple date strings as inclusive by bumping to end of day.
    let dt = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      dt.setHours(23, 59, 59, 999);
    }
    filter.lte = dt;
  }
  return filter;
}

/**
 * Calculate skip from page + limit.
 */
export function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}
