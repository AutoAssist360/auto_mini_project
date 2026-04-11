import { z } from "zod";

const phoneRegex = /^\d{10}$/;

const orderItemSchema = z.object({
  part_id: z.coerce.number().int().positive("Part ID must be positive"),
  quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
  inventory_id: z.string().uuid("Invalid inventory ID").optional(),
});

const orderPaymentMethodSchema = z.enum(["upi", "cash_on_delivery"]);

export const createOrderSchema = z.object({
  warehouse_id: z.string().uuid("Invalid warehouse ID").optional(),
  request_id: z.string().uuid("Invalid request ID").optional(),
  payment_method: orderPaymentMethodSchema.optional(),
  delivery_contact_name: z.string().trim().min(1, "Delivery contact name is required").max(200).optional(),
  delivery_phone: z.string().trim().regex(phoneRegex, "Delivery phone number must be exactly 10 digits").optional(),
  delivery_address: z.string().trim().min(5, "Delivery address is too short").max(500).optional(),
  delivery_city: z.string().trim().min(2, "Delivery city is required").max(120).optional(),
  delivery_state: z.string().trim().min(2, "Delivery state is required").max(120).optional(),
  delivery_postal_code: z.string().trim().min(4, "Delivery postal code is required").max(20).optional(),
  delivery_latitude: z.coerce.number().min(-90).max(90).optional(),
  delivery_longitude: z.coerce.number().min(-180).max(180).optional(),
  delivery_instructions: z.string().trim().max(500).optional(),
  items: z
    .array(orderItemSchema)
    .min(1, "Order must contain at least one item"),
  notes: z.string().optional(),
});

export const payOrderSchema = z.object({
  payment_method: orderPaymentMethodSchema,
  transaction_id: z.string().trim().min(1, "Transaction ID is required").optional(),
}).superRefine((data, ctx) => {
  if (data.payment_method === "upi" && !data.transaction_id) {
    ctx.addIssue({
      code: "custom",
      path: ["transaction_id"],
      message: "Transaction ID is required for UPI payments",
    });
  }
});

export const reservePartSchema = z.object({
  inventory_id: z.string().uuid("Invalid inventory ID"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  request_id: z.string().uuid("Invalid request ID").optional(),
  ttl_minutes: z
    .number()
    .int()
    .min(1)
    .max(1440, "TTL cannot exceed 24 hours (1440 minutes)")
    .default(30),
});

export const requestOrderReturnSchema = z.object({
  reason: z.string().trim().min(10, "Please share a return reason with at least 10 characters").max(1000),
});
