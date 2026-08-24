begin;

alter table public.media_assets
  add constraint media_assets_gym_id_id_key unique (gym_id, id);

alter table public.gyms
  add column logo_media_asset_id uuid,
  add constraint gyms_logo_media_asset_same_gym_fkey
    foreign key (id, logo_media_asset_id)
    references public.media_assets(gym_id, id)
    on delete set null (logo_media_asset_id);

comment on column public.gyms.logo_media_asset_id is
  'Private gym logo stored in gym-media; the composite FK prevents cross-tenant references.';

commit;

-- Rollback: drop the FK and logo_media_asset_id, then drop media_assets_gym_id_id_key.
