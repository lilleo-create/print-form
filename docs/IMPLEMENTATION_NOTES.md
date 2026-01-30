# Implementation Notes

## Backend
- **Framework:** Express (TypeScript).
- **Entrypoint:** `backend/src/main.ts`.
- **Existing routes:**
  - `GET /health`
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /products`
  - `GET /products/:id`
  - `POST /orders`
  - `GET /orders/:id`
  - `POST /custom-requests`
  - `GET /seller/products`
  - `POST /seller/products`
  - `PATCH /seller/products/:id`
  - `DELETE /seller/products/:id`
  - `GET /seller/orders`
  - `GET /filters`
  - `GET /me/orders`
- **Current mock data locations:** none on backend.

## Frontend
- **Stack:** React + TypeScript + Vite, Zustand for state, CSS modules.
- **API client approach:** `frontend/src/shared/api/index.ts` uses the fetch client with `VITE_API_URL`.
- **Current mock data locations:** none in the frontend runtime; tests use local mocks.

## Reuse vs. Replace
- **Reuse:** existing Express app, routes, repository/usecase structure, shared types, and styling system.
- **Replace/Refactor:** product listing filters, catalog UI, product detail view, and API layer shapes to align with new persistence-backed endpoints and review/order flows.
