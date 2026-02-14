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
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000
```

**backend/.env.example**
```
DATABASE_URL=postgresql://user:password@localhost:5432/printform
JWT_SECRET=replace-with-strong-32-char-secret
JWT_REFRESH_SECRET=replace-with-strong-32-char-refresh-secret
OTP_HASH_PEPPER=replace-with-strong-32-char-pepper
GOOGLE_SHEETS_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FRONTEND_URL=http://localhost:5173
PORT=4000
SMS_PROVIDER=console
```

## Architecture decisions
- Chosen Express for backend to keep the stack lightweight while still enforcing layered architecture.
- Frontend uses feature-based layering (ui/features/entities/shared) and keeps business logic in hooks/services.
- Frontend data flows through the backend API with token-based authentication and refresh handling.

## NDD Delivery test (tst)
1. Задайте env в `backend/.env`:
   ```env
   YANDEX_NDD_BASE_URL=https://b2b.taxi.tst.yandex.net
   YANDEX_NDD_TOKEN=<ваш токен>
   YANDEX_NDD_OPERATOR_STATION_ID=<числовой station_id продавца, например 10022023854>
   YANDEX_NDD_LANG=ru
   ```
2. Создайте заказ через checkout с `deliveryMethod=PICKUP_POINT` и валидным `pickupPoint.id` (станция назначения).
3. В ЛК продавца откройте `Настройки` и сохраните ПВЗ сдачи через виджет; в `raw` должен сохраниться `operator_station_id` (числовой station_id), а `YANDEX_NDD_OPERATOR_STATION_ID` используется как приоритетный источник station_id.
4. В ЛК продавца в разделе `Заказы` нажмите **Готов к отгрузке** — создастся заявка NDD.
5. Проверьте БД:
   - `order_shipments` (request_id, status, status_raw)
   - `order_shipment_status_history`
   - `seller_delivery_profile`
6. Для ручной синхронизации статусов:
   - endpoint: `POST /internal/jobs/shipments-sync`
   - либо script: `cd backend && npm run shipments:sync`
7. Для ярлыка в заказе продавца нажмите **Скачать ярлык** (или вызовите `GET /seller/orders/:orderId/shipping-label`).

> Подсказка для tst-контура: используйте тестовые станции и ПВЗ в Москве/МО (Москва-only ограничения Яндекс NDD).
