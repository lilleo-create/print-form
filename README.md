# Russian 3D Printing Marketplace

## Tech stack (fixed)
**Frontend**
- React + TypeScript + Vite
- React Router
- State: Zustand
- Styling: CSS Modules
- Forms: React Hook Form + Zod
- API layer: fetch wrapper + typed DTO
- Testing: Vitest + React Testing Library
- Lint/format: ESLint + Prettier

**Backend**
- Node.js + Express
- DB: PostgreSQL + Prisma
- Auth: JWT + refresh tokens (httpOnly cookies)
- Validation: Zod

## Project structure
```
/ frontend
  /src
    /app
    /entities
    /features
    /pages
    /shared
    /widgets
/ backend
  /src
    /config
    /lib
    /middleware
    /repositories
    /routes
    /services
    /usecases
```

## Pages and components
**Pages**
- Landing (hero, каталог, кастомная печать, преимущества, футер)
- Catalog (filters + grid + modal)
- Buyer Account (профиль + история заказов)
- Seller Account (товары + заказы + статистика)
- Auth (login/register)

**Key components**
- Layout: header/footer + cart drawer + product modal
- ProductCard, ProductModal
- CartDrawer + checkout form
- CustomPrintForm

## Running the project
### Frontend
```bash
cd frontend
npm install
# VITE_USE_MOCK=true (по умолчанию)
npm run dev
```

#### Yandex Maps (address picker)
1. Создайте `frontend/.env` и добавьте ключ:
   ```
   VITE_YMAPS_API_KEY=ваш_ключ
   ```
2. Перезапустите dev server после изменения env.

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Environment examples
**frontend/.env**
```
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:4000
```

**backend/.env.example**
```
DATABASE_URL=postgresql://user:password@localhost:5432/printform
JWT_SECRET=super-secret
JWT_REFRESH_SECRET=super-refresh-secret
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FRONTEND_URL=http://localhost:5173
PORT=4000
```

## Architecture decisions
- Chosen Express for backend to keep the stack lightweight while still enforcing layered architecture.
- Frontend uses feature-based layering (ui/features/entities/shared) and keeps business logic in hooks/services.
- Mock API adapter for fast UI iteration; ready to switch to real API endpoints.
