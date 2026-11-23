-- Real agency pages often leave some fields blank: KW Aruba prints
-- "Build up size: m² (0 Sq Ft)" on most homes and never states zoning or a
-- commercial use. The original shape check refused those rows outright, so
-- they could never reach the dashboard. Keep what identifies each class and
-- let the unknowns be null (price per sq ft and the value signal are then
-- simply not computed for that listing).
--
--   Property    a home type and a bedroom count   (built_sqft optional)
--   Land        'Land' and a lot size             (zoning optional)
--   Commercial  'Commercial'                      (use and built_sqft optional)

alter table public.property_master drop constraint property_master_shape;

alter table public.property_master add constraint property_master_shape check (
  case asset_class
    when 'Property'   then property_type not in ('Land', 'Commercial') and bedrooms is not null
    when 'Land'       then property_type = 'Land' and lot_sqft is not null
    when 'Commercial' then property_type = 'Commercial'
  end);
