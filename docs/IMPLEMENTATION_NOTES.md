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
- **Current mock data locations:** none on backend; mocks live in frontend.

## Frontend
- **Stack:** React + TypeScript + Vite, Zustand for state, CSS modules.
- **API client approach:** `frontend/src/shared/api/index.ts` selects a mock adapter or a fetch client using `VITE_USE_MOCK` and `VITE_API_URL`.
- **Mock toggle:** `VITE_USE_MOCK=true` is optional for local development; production defaults to the real API.
- **Current mock data locations:** `frontend/src/shared/api/mockData.ts` plus mock routing in `frontend/src/shared/api/mockAdapter.ts`.

## Reuse vs. Replace
- **Reuse:** existing Express app, routes, repository/usecase structure, mock adapter switching, shared types, and styling system.
- **Replace/Refactor:** product listing filters, catalog UI, product detail view, and API layer shapes to align with new persistence-backed endpoints and review/order flows.
