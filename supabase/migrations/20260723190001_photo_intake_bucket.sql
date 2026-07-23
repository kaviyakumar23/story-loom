-- Private, isolated bucket for ephemeral photo intake — deliberately NOT the
-- 'assets' bucket, so nothing that signs/serves product assets can ever touch a
-- raw child photo. Access is service-role only via src/server/lib/photo-intake.ts.
insert into storage.buckets (id, name, public)
values ('photo-intake', 'photo-intake', false)
on conflict (id) do nothing;
