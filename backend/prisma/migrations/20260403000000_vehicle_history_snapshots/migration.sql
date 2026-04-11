ALTER TABLE "user_vehicles"
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "service_requests"
ADD COLUMN "vehicle_registration_snapshot" TEXT,
ADD COLUMN "vehicle_company_snapshot" TEXT,
ADD COLUMN "vehicle_model_snapshot" TEXT,
ADD COLUMN "vehicle_variant_snapshot" TEXT,
ADD COLUMN "vehicle_year_snapshot" INTEGER,
ADD COLUMN "vehicle_fuel_type_snapshot" "FuelType",
ADD COLUMN "vehicle_transmission_snapshot" "Transmission";

UPDATE "service_requests" AS sr
SET
  "vehicle_registration_snapshot" = uv."registration_number",
  "vehicle_company_snapshot" = cc."company_name",
  "vehicle_model_snapshot" = cm."model_name",
  "vehicle_variant_snapshot" = cv."variant_name",
  "vehicle_year_snapshot" = cv."year",
  "vehicle_fuel_type_snapshot" = cv."fuel_type",
  "vehicle_transmission_snapshot" = cv."transmission"
FROM "user_vehicles" AS uv
JOIN "car_variants" AS cv
  ON cv."variant_id" = uv."variant_id"
JOIN "car_models" AS cm
  ON cm."model_id" = cv."model_id"
JOIN "car_companies" AS cc
  ON cc."company_id" = cm."company_id"
WHERE sr."vehicle_id" = uv."vehicle_id"
  AND sr."vehicle_registration_snapshot" IS NULL;
