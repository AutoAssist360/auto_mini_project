import { Router } from "express";
import Decimal from "decimal.js";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { requireVendorVerification } from "../../../middleware/vendorVerification.js";
import { analyticsQuery, lowStockQuery } from "../vendor.schemas.js";
import { dateFilter, ownerWarehouse, paginate } from "../vendor.helpers.js";

export const vendorAnalyticsRouter = Router();
vendorAnalyticsRouter.use(userAuth, roleGuard("vendor"), requireVendorVerification);

const INDIA_TIME_ZONE = "Asia/Kolkata";

function getIndiaDayBounds(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);

  return { start, end };
}

async function vendorWarehouseIds(vendorId) {
  const warehouses = await prisma.warehouse.findMany({
    where: { vendor_id: vendorId },
    select: { warehouse_id: true },
  });
  return warehouses.map((warehouse) => warehouse.warehouse_id);
}

vendorAnalyticsRouter.get(
  "/revenue",
  asyncWrapper(async (req, res) => {
    const { from, to } = analyticsQuery.parse(req.query);
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total_revenue: 0,
        total_orders: 0,
        avg_order_value: 0,
      });
    }

    const where = {
      warehouse_id: { in: warehouseIds },
      order_status: { not: "cancelled" },
    };
    const created = dateFilter(from, to);
    if (created) where.created_at = created;

    const orders = await prisma.order.findMany({
      where,
      select: { total: true },
    });

    const totalRevenue = orders.reduce(
      (sum, order) => sum.add(order.total),
      new Decimal(0)
    );

    const toMoney = (value) => Number(value.toFixed(2));

    res.json({
      total_revenue: toMoney(totalRevenue),
      total_orders: orders.length,
      avg_order_value: orders.length > 0 ? toMoney(totalRevenue.div(orders.length)) : 0,
    });
  })
);

vendorAnalyticsRouter.get(
  "/orders",
  asyncWrapper(async (req, res) => {
    const { from, to } = analyticsQuery.parse(req.query);
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total: 0,
        by_status: {},
        by_payment: {},
      });
    }

    const baseWhere = { warehouse_id: { in: warehouseIds } };
    const created = dateFilter(from, to);
    if (created) baseWhere.created_at = created;

    const [total, byStatus, byPayment] = await Promise.all([
      prisma.order.count({ where: baseWhere }),
      prisma.order.groupBy({
        by: ["order_status"],
        where: baseWhere,
        _count: { order_id: true },
      }),
      prisma.order.groupBy({
        by: ["payment_status"],
        where: baseWhere,
        _count: { order_id: true },
      }),
    ]);

    res.json({
      total,
      by_status: Object.fromEntries(
        byStatus.map((group) => [group.order_status, group._count.order_id])
      ),
      by_payment: Object.fromEntries(
        byPayment.map((group) => [group.payment_status, group._count.order_id])
      ),
    });
  })
);

vendorAnalyticsRouter.get(
  "/inventory",
  asyncWrapper(async (req, res) => {
    const warehouseIds = await vendorWarehouseIds(req.userId);

    if (warehouseIds.length === 0) {
      return res.json({
        total_items: 0,
        total_available: 0,
        total_reserved: 0,
        total_value: 0,
        low_stock_count: 0,
      });
    }

    const inventories = await prisma.inventory.findMany({
      where: { warehouse_id: { in: warehouseIds } },
      select: {
        quantity_available: true,
        quantity_reserved: true,
        unit_cost: true,
        reorder_level: true,
      },
    });

    let totalAvailable = 0;
    let totalReserved = 0;
    let totalValue = new Decimal(0);
    let lowStockCount = 0;

    for (const inventory of inventories) {
      totalAvailable += inventory.quantity_available;
      totalReserved += inventory.quantity_reserved;
      totalValue = totalValue.add(
        new Decimal(inventory.unit_cost).mul(inventory.quantity_available)
      );
      if (
        inventory.reorder_level > 0 &&
        inventory.quantity_available <= inventory.reorder_level
      ) {
        lowStockCount += 1;
      }
    }

    res.json({
      total_items: inventories.length,
      total_available: totalAvailable,
      total_reserved: totalReserved,
      total_value: Number(totalValue.toFixed(2)),
      low_stock_count: lowStockCount,
    });
  })
);

vendorAnalyticsRouter.get(
  "/warehouses/:warehouseId/low-stock",
  asyncWrapper(async (req, res) => {
    const warehouse = await ownerWarehouse(req.params.warehouseId, req.userId);
    const { page, limit, threshold } = lowStockQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const allInventory = await prisma.inventory.findMany({
      where: { warehouse_id: warehouse.warehouse_id },
      include: {
        part: {
          select: { part_id: true, part_name: true, category_id: true },
        },
      },
      orderBy: { quantity_available: "asc" },
    });

    const lowStock = allInventory.filter((inventory) => {
      const level = threshold !== undefined ? threshold : inventory.reorder_level;
      return level > 0 && inventory.quantity_available <= level;
    });

    res.json({
      low_stock: lowStock.slice(skip, skip + take),
      total: lowStock.length,
      page,
      limit,
    });
  })
);

vendorAnalyticsRouter.get(
  "/ledger",
  asyncWrapper(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const payoutWhere = {
      recipient_id: req.userId,
      recipient_role: "vendor",
    };
    const { start, end } = getIndiaDayBounds();

    const [payouts, total, totalEarnedAggregate, pendingCreditsAggregate, todayCommissionPayouts] =
      await Promise.all([
        prisma.payout.findMany({
          where: payoutWhere,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
        prisma.payout.count({ where: payoutWhere }),
        prisma.payout.aggregate({
          where: {
            ...payoutWhere,
            status: "completed",
            amount: { gt: 0 },
          },
          _sum: { amount: true },
        }),
        prisma.payout.aggregate({
          where: {
            ...payoutWhere,
            status: "pending",
            amount: { gt: 0 },
          },
          _sum: { amount: true },
        }),
        prisma.payout.findMany({
          where: {
            ...payoutWhere,
            status: "pending",
            amount: { lt: 0 },
            created_at: {
              gte: start,
              lte: end,
            },
          },
          orderBy: { created_at: "desc" },
        }),
      ]);

    const orderIds = payouts
      .filter((payout) => payout.source_type === "order" && payout.source_id)
      .map((payout) => payout.source_id);

    const orders = orderIds.length > 0
      ? await prisma.order.findMany({
          where: { order_id: { in: orderIds } },
          select: {
            order_id: true,
            order_number: true,
            total: true,
            warehouse: { select: { name: true } },
            user: { select: { full_name: true } },
          },
        })
      : [];

    const orderMap = new Map(orders.map((order) => [order.order_id, order]));
    const todayCommissionDue = todayCommissionPayouts.reduce(
      (sum, payout) => sum + Math.abs(Number(payout.amount || 0)),
      0
    );

    const ledger = payouts.map((payout) => {
      const amount = Number(payout.amount || 0);
      const linkedOrder = payout.source_id ? orderMap.get(payout.source_id) : null;
      const isCommission = amount < 0;

      return {
        payout_id: payout.payout_id,
        ledger_id: payout.payout_id,
        reference:
          linkedOrder?.order_number ||
          payout.source_id ||
          payout.transaction_id ||
          payout.payout_id,
        type: isCommission ? "admin_commission" : "order_earning",
        amount: Number(amount.toFixed(2)),
        gross_amount: linkedOrder ? Number(linkedOrder.total) : Number(Math.abs(amount).toFixed(2)),
        status: payout.status,
        warehouse: linkedOrder?.warehouse?.name || null,
        customer: linkedOrder?.user?.full_name || null,
        notes:
          payout.notes ||
          (isCommission
            ? "5% admin commission due for vendor payment"
            : "Vendor earning received from customer order"),
        created_at: payout.created_at,
        paid_at: payout.paid_at,
        payment_method: payout.payment_method,
        transaction_id: payout.transaction_id,
        order_id: linkedOrder?.order_id || payout.source_id || null,
        order_number: linkedOrder?.order_number || null,
      };
    });

    res.json({
      summary: {
        total_earned: Number(Number(totalEarnedAggregate._sum.amount || 0).toFixed(2)),
        pending_credits: Number(Number(pendingCreditsAggregate._sum.amount || 0).toFixed(2)),
        today_commission_due: Number(todayCommissionDue.toFixed(2)),
        today_commission_orders: todayCommissionPayouts.length,
        today_reset_at: end.toISOString(),
      },
      ledger,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);
