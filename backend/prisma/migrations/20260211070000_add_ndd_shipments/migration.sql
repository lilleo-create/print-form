CREATE TABLE IF NOT EXISTS seller_delivery_profile (
  id TEXT PRIMARY KEY,
  seller_id TEXT UNIQUE NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  dropoff_station_id TEXT NOT NULL,
  dropoff_station_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  source_station_id TEXT NOT NULL,
  source_station_snapshot JSONB,
  destination_station_id TEXT NOT NULL,
  destination_station_snapshot JSONB,
  offer_payload TEXT,
  request_id TEXT,
  status TEXT NOT NULL,
  status_raw JSONB,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_shipment_status_history (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  payload_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
