export const vehicleSummarySelect = {
  vehicle_id: true,
  user_id: true,
  variant_id: true,
  registration_number: true,
  vin_number: true,
  deleted_at: true,
};

export const vehicleDetailSelect = {
  ...vehicleSummarySelect,
  variant: {
    select: {
      variant_id: true,
      variant_name: true,
      year: true,
      fuel_type: true,
      transmission: true,
      model: {
        select: {
          model_id: true,
          model_name: true,
          company_id: true,
          company: {
            select: {
              company_id: true,
              company_name: true,
            },
          },
        },
      },
    },
  },
};
