-- Gifting: a parent can mark an order a gift and add a short dedication printed
-- on the book's closing bookplate. Shipping already supports any recipient
-- address, so this is just the flag + message. Additive.
alter table orders add column if not exists is_gift boolean not null default false;
alter table orders add column if not exists gift_message text;
