export function createRequestVehicleSnapshotData(vehicle) {
  const variant = vehicle?.variant
  const model = variant?.model
  const company = model?.company

  return {
    vehicle_registration_snapshot: vehicle?.registration_number || null,
    vehicle_company_snapshot: company?.company_name || null,
    vehicle_model_snapshot: model?.model_name || null,
    vehicle_variant_snapshot: variant?.variant_name || null,
    vehicle_year_snapshot: variant?.year ?? null,
    vehicle_fuel_type_snapshot: variant?.fuel_type || null,
    vehicle_transmission_snapshot: variant?.transmission || null,
  }
}

function createDisplayVehicle(requestLike) {
  const registrationNumber =
    requestLike?.vehicle_registration_snapshot ||
    requestLike?.vehicle?.registration_number ||
    null

  const companyName =
    requestLike?.vehicle_company_snapshot ||
    requestLike?.vehicle?.variant?.model?.company?.company_name ||
    null

  const modelName =
    requestLike?.vehicle_model_snapshot ||
    requestLike?.vehicle?.variant?.model?.model_name ||
    null

  const variantName =
    requestLike?.vehicle_variant_snapshot ||
    requestLike?.vehicle?.variant?.variant_name ||
    null

  const year =
    requestLike?.vehicle_year_snapshot ??
    requestLike?.vehicle?.variant?.year ??
    null

  const fuelType =
    requestLike?.vehicle_fuel_type_snapshot ||
    requestLike?.vehicle?.variant?.fuel_type ||
    null

  const transmission =
    requestLike?.vehicle_transmission_snapshot ||
    requestLike?.vehicle?.variant?.transmission ||
    null

  if (
    !requestLike?.vehicle &&
    !registrationNumber &&
    !companyName &&
    !modelName &&
    !variantName
  ) {
    return null
  }

  return {
    vehicle_id: requestLike?.vehicle?.vehicle_id || requestLike?.vehicle_id || null,
    registration_number: registrationNumber,
    vin_number: requestLike?.vehicle?.vin_number || null,
    deleted_at: requestLike?.vehicle?.deleted_at || null,
    variant: {
      variant_id: requestLike?.vehicle?.variant?.variant_id || null,
      variant_name: variantName,
      year,
      fuel_type: fuelType,
      transmission,
      model: {
        model_id: requestLike?.vehicle?.variant?.model?.model_id || null,
        model_name: modelName,
        company_id:
          requestLike?.vehicle?.variant?.model?.company?.company_id || null,
        company: {
          company_id:
            requestLike?.vehicle?.variant?.model?.company?.company_id || null,
          company_name: companyName,
        },
      },
    },
  }
}

export function attachRequestVehicleSnapshot(requestLike) {
  if (!requestLike) return requestLike

  return {
    ...requestLike,
    vehicle: createDisplayVehicle(requestLike),
  }
}

export function attachJobRequestVehicleSnapshot(job) {
  if (!job?.request) return job

  return {
    ...job,
    request: attachRequestVehicleSnapshot(job.request),
  }
}

export function attachOfferRequestVehicleSnapshot(offer) {
  if (!offer?.request) return offer

  return {
    ...offer,
    request: attachRequestVehicleSnapshot(offer.request),
  }
}
