import { apiClient } from './api';
import type {
  SellerFinanceDashboardResponse,
  SellerPayoutCreatePayload,
  SellerPayoutCreateResponse,
  SellerPayoutMethod,
  SellerPayoutMethodBindPayload
} from '../types';

export const sellerFinanceApi = {
  getDashboard() {
    return apiClient.request<SellerFinanceDashboardResponse>('/seller/finance');
  },

  getPayoutMethods() {
    return apiClient.request<SellerPayoutMethod[]>('/seller/payout-methods');
  },

  createPayoutMethod(payload: SellerPayoutMethodBindPayload) {
    return apiClient.request<SellerPayoutMethod>('/seller/payout-methods', {
      method: 'POST',
      body: payload
    });
  },

  makeDefaultPayoutMethod(id: string) {
    return apiClient.request<SellerPayoutMethod>(
      `/seller/payout-methods/${id}/default`,
      {
        method: 'PATCH'
      }
    );
  },

  revokePayoutMethod(id: string) {
    return apiClient.request<SellerPayoutMethod>(
      `/seller/payout-methods/${id}/revoke`,
      {
        method: 'PATCH'
      }
    );
  },

  triggerPayout(payload: SellerPayoutCreatePayload) {
    return apiClient.request<SellerPayoutCreateResponse>(
      '/seller/payouts/trigger',
      {
        method: 'POST',
        body: payload
      }
    );
  },

  syncPayoutStatus(payoutId: string) {
    return apiClient.request<{ status: string; payoutId: string }>(
      `/seller/payouts/${payoutId}/sync`,
      {
        method: 'POST'
      }
    );
  }
};
