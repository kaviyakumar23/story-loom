-- Private bucket for delivery assets (§11). Served only via signed URLs.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;
