# Yandex Delivery integration

## Implemented methods
- `pickup-points/list`
- `location/detect`
- `offers/create`
- `offers/confirm`
- `request/create`
- `request/info`
- `request/cancel`
- `request/generate-labels`
- `request/get-handover-act`

## Required env
- `YANDEX_NDD_BASE_URL` (e.g. `https://b2b-authproxy.taxi.yandex.net` for test env)
- `YANDEX_NDD_TOKEN`
- `YANDEX_NDD_LANG` (default `ru`)

## SellerDeliveryProfile linkage
Marketplace orchestration must read seller dropoff from `SellerDeliveryProfile`:
- `sellerId`
- `defaultDropoffPvzId`
- `dropoffPlatformStationId` / `dropoffOperatorStationId` are derived from `pickup-points/list` and used only when present.
No station ids are hardcoded in integration.
