import type { AxiosError } from 'axios';

export type AppError = {
  code: string;
  httpStatus: number;
  message: string;
  details?: unknown;
};

export const createError = (code: string, httpStatus: number, message: string, details?: unknown): AppError => ({
  code,
  httpStatus,
  message,
  details,
});

const CATALOG: Array<{ status: number; needle: string; code: string; message: string }> = [
  { status: 400, needle: 'Cannot parse destination info', code: 'NDD_DESTINATION_PARSE_FAILED', message: 'Cannot parse destination info' },
  { status: 400, needle: 'There already was request with such code within this employer', code: 'NDD_DUPLICATE_OPERATOR_REQUEST_ID', message: 'Duplicate operator request id' },
  { status: 400, needle: 'Cant get station id for point', code: 'NDD_STATION_ID_NOT_FOUND', message: 'Can not resolve station id for point' },
  { status: 400, needle: 'Payment on delivery option is not available for courier delivery', code: 'NDD_COD_NOT_AVAILABLE_FOR_COURIER', message: 'Payment on delivery is not available for courier' },
  { status: 400, needle: 'destination station is disabled', code: 'NDD_DESTINATION_STATION_DISABLED', message: 'Destination station is disabled' },
  { status: 400, needle: "Pickup point doesn't accept payment on delivery", code: 'NDD_PICKUP_POINT_COD_UNAVAILABLE', message: 'Pickup point does not accept COD' },
  { status: 400, needle: "Pickup point doesn't accept prepaid", code: 'NDD_PICKUP_POINT_PREPAID_UNAVAILABLE', message: 'Pickup point does not accept prepaid payment' },
  { status: 400, needle: 'Particular items refuse is not allowed', code: 'NDD_PARTIAL_REFUSE_NOT_ALLOWED', message: 'Particular items refuse is not allowed' },
  { status: 400, needle: 'Fitting is not available', code: 'NDD_FITTING_NOT_AVAILABLE', message: 'Fitting is not available' },
  { status: 401, needle: 'Access denied', code: 'NDD_ACCESS_DENIED', message: 'Access denied' },
  { status: 404, needle: 'No delivery options', code: 'NDD_NO_DELIVERY_OPTIONS', message: 'No delivery options' },
  { status: 404, needle: 'No dropoff available', code: 'NDD_NO_DROPOFF_AVAILABLE', message: 'No dropoff available' },
  { status: 404, needle: 'Dimensions should not exceed limit', code: 'NDD_DIMENSIONS_LIMIT_EXCEEDED', message: 'Dimensions exceed limit' },
];

export function mapYandexError(error: unknown): AppError {
  const axiosError = error as AxiosError<any>;
  const status = axiosError.response?.status ?? 500;
  const payload = axiosError.response?.data;
  const upstreamMessage = String(payload?.message ?? payload?.error ?? axiosError.message ?? 'Yandex request failed');
  const match = CATALOG.find((item) => status === item.status && upstreamMessage.includes(item.needle));

  if (match) {
    return createError(match.code, match.status, match.message, payload);
  }

  if (status === 401) return createError('NDD_ACCESS_DENIED', 401, 'Access denied', payload);
  return createError('NDD_REQUEST_FAILED', status >= 400 ? status : 502, upstreamMessage, payload);
}
