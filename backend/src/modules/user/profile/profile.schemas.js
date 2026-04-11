import { z } from "zod";

const phoneRegex = /^\d{10}$/;
const optionalNullableString = (maxLength) =>
  z.string().trim().max(maxLength).nullable().optional();

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  phone_number: z
    .string()
    .regex(phoneRegex, "Phone number must be exactly 10 digits")
    .optional(),
  upi_id: optionalNullableString(100),
  bank_account_number: optionalNullableString(30),
  bank_ifsc: optionalNullableString(20),
  bank_holder_name: optionalNullableString(200),
});
