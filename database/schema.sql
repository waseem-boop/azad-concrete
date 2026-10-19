-- Foundation schema for Aiven PostgreSQL. UI currently runs in local demo mode.
CREATE TABLE IF NOT EXISTS products (
 id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('Slab','Girder')),
 length_ft numeric NOT NULL CHECK(length_ft > 0), width_ft numeric,
 stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0)
);
CREATE TABLE IF NOT EXISTS materials (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, unit text NOT NULL,
 stock numeric NOT NULL DEFAULT 0 CHECK(stock >= 0)
);
CREATE TABLE IF NOT EXISTS recipes (
 product_id text REFERENCES products(id), material_id text REFERENCES materials(id),
 quantity_per_unit numeric NOT NULL CHECK(quantity_per_unit >= 0),
 PRIMARY KEY(product_id, material_id)
);
CREATE TABLE IF NOT EXISTS production_batches (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 product_id text NOT NULL REFERENCES products(id), quantity integer NOT NULL CHECK(quantity > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS material_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 material_id text NOT NULL REFERENCES materials(id),
 batch_id bigint REFERENCES production_batches(id), quantity numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gatepasses (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 customer_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gatepass_items (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 gatepass_id bigint NOT NULL REFERENCES gatepasses(id), product_id text NOT NULL REFERENCES products(id),
 quantity integer NOT NULL CHECK(quantity > 0), unit_price numeric NOT NULL CHECK(unit_price > 0)
);
CREATE TABLE IF NOT EXISTS expenses (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, description text NOT NULL,
 amount numeric NOT NULL CHECK(amount > 0), created_at timestamptz NOT NULL DEFAULT now()
);
