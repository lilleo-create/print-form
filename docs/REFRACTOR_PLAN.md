# Refactor Plan & Audit

## Audit summary

### Backend
- **Location:** `backend/` (Node.js + Express). Entry point: `backend/src/main.ts`.【F:backend/src/main.ts†L1-L29】
- **Routing:**
  - `POST /auth/register|login|refresh|logout` in `authRoutes.ts`.【F:backend/src/routes/authRoutes.ts†L1-L65】
  - `GET /products` (filters: category/material/minPrice/maxPrice), `GET /products/:id` in `productRoutes.ts`.【F:backend/src/routes/productRoutes.ts†L1-L36】
  - `POST /orders`, `GET /orders/me`, `GET /orders/:id` in `orderRoutes.ts`.【F:backend/src/routes/orderRoutes.ts†L1-L47】
  - `POST /custom-requests` in `customRequestRoutes.ts`.【F:backend/src/routes/customRequestRoutes.ts†L1-L22】
  - `GET /seller/products|orders|stats`, `POST/PUT/DELETE /seller/products/:id` in `sellerRoutes.ts`.【F:backend/src/routes/sellerRoutes.ts†L1-L76】
  - `GET /filters` in `filterRoutes.ts` (derived from products).【F:backend/src/routes/filterRoutes.ts†L1-L16】
  - `GET /me/orders` in `meRoutes.ts`.【F:backend/src/routes/meRoutes.ts†L1-L12】
- **Data layer:** Prisma already present with Postgres in `backend/prisma/schema.prisma` (User/Product/Order/OrderItem/CustomRequest/RefreshToken).【F:backend/prisma/schema.prisma†L1-L67】
- **Storage:** Uses Postgres via Prisma client (`backend/src/lib/prisma.ts`). Current domain models are partial vs. requested entities (no ProductImage/Variant/Review).【F:backend/prisma/schema.prisma†L1-L67】

### Frontend
- **Location:** `frontend/` (React + Vite + TS).
- **Routing:** React Router in `frontend/src/App.tsx` (landing, catalog, cart, checkout, account, seller, auth).【F:frontend/src/App.tsx†L1-L44】
- **State:** Zustand stores in `frontend/src/app/store/*` (auth, cart, orders, products, ui, address).【F:frontend/src/app/store/addressStore.ts†L1-L57】
- **API client:** `frontend/src/shared/api/*` uses `fetch` client or mock adapter with localStorage (addresses, orders, products).【F:frontend/src/shared/api/index.ts†L1-L48】
- **Persistence:** localStorage keys in `frontend/src/shared/constants/storageKeys.ts`.【F:frontend/src/shared/constants/storageKeys.ts†L1-L10】

### Where to integrate DB
- Prisma already configured. Extend existing Prisma schema to include new entities (ProductImage, ProductVariant, Review) and add fields to Product (sku, ratingAvg, ratingCount, descriptionShort/Full, currency, created/updated). Reuse existing migration system and Prisma client.

## Implementation plan (incremental commits)

1. **Audit doc + plan**
   - Add this file to document current system and plan.

2. **DB schema & migrations**
   - Extend Prisma schema with requested entities/fields (User/Product/ProductImage/ProductVariant/Review/Order/OrderItem).
   - Add rating cache fields on Product and update timestamps.
   - Create migration + seed (20+ products, variants, images, reviews, orders).

3. **Products persistence + filters/sort**
   - Update product routes to support new filters/sort without breaking existing query params.
   - Add DTO mapping to preserve old response shape for frontend compatibility.

4. **Reviews & rating recalculation**
   - Add routes for reviews (list/create) and update product rating within a transaction.
   - Add basic tests for rating recalculation.

5. **Orders + Google Sheets sync**
   - Add order creation integration with Google Sheets; store sync status on Order.
   - Implement retry-safe logging (simple status column) with graceful failures.

6. **Frontend UI updates**
   - Update header (search bar, icons, categories).
   - Filter modal with query param sync (min/max, rating, delivery).

7. **Product page**
   - Add product details page (gallery, variants, reviews, delivery date).
   - Add infinite scroll “other products”.

8. **Cleanup & docs**
   - README additions (backend setup, DB, migrations, seed, env, Google Sheets).
   - Lint/format checks and targeted tests.

## Dependencies & risks
- **Prisma migrations:** ensure existing data remains valid when adding required fields (may need defaults or backfill script).
- **Google Sheets API:** requires service account credentials and network access; design for graceful failure when unavailable.
- **Frontend compatibility:** keep legacy response shape or update adapters to avoid breaking the mock API toggle.

## Open questions
- What is the required schema for Google Sheets rows (column order, required fields)?
- Should review creation be authenticated-only or allow guest ratings?
- Are product categories fixed list or managed in DB?

## Validation checklist
- Prisma generate + migrate runs cleanly on fresh database.
- Product list, filters, and detail pages render with mock API disabled.
- Order creation triggers a Google Sheets entry and records sync status.
