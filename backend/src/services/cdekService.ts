import axios, { type AxiosRequestConfig } from 'axios';
import { getCdekConfig } from '../config/cdek';

type CdekTokenResponse = {
  access_token: string;
  expires_in: number;
};

type CdekPickupPoint = {
  code: string;
  name: string;
  location?: {
    city_code?: number;
    city?: string;
    latitude?: number;
    longitude?: number;
    address_full?: string;
  };
  work_time?: string;
  type?: string;
};

type CalculateDeliveryParams = {
  fromCityCode: number;
  toCityCode: number;
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

type CreateOrderItem = {
  id: string;
  name: string;
  article?: string;
  price: number;
  quantity: number;
};

type CreateOrderParams = {
  orderId: string;
  fromPvzCode: string;
  toPvzCode: string;
  comment?: string;
  recipientName: string;
  recipientPhone: string;
  senderName?: string;
  senderPhone?: string;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  items: CreateOrderItem[];
};

type CdekOrderResponse = {
  entity?: {
    uuid?: string;
    cdek_number?: string;
    statuses?: Array<{ code?: string }>;
  };
  cdek_number?: string;
  statuses?: Array<{ code?: string }>;
};

class CdekService {
  private tokenCache: { token: string; expiresAtMs: number } | null = null;

  private async request<T>(methodName: string, config: AxiosRequestConfig): Promise<T> {
    const startedAt = Date.now();
    try {
      const response = await axios.request<T>(config);
      console.info(`[CDEK][${methodName}]`, { status: response.status, durationMs: Date.now() - startedAt });
      return response.data;
    } catch (error: any) {
      console.info(`[CDEK][${methodName}]`, {
        status: Number(error?.response?.status ?? 0),
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAtMs - 60_000) {
      return this.tokenCache.token;
    }

    const { baseUrl, clientId, clientSecret } = getCdekConfig();

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await this.request<CdekTokenResponse>('getToken', {
      method: 'POST',
      url: `${baseUrl}/v2/oauth/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body.toString()
    });

    this.tokenCache = {
      token: response.access_token,
      expiresAtMs: now + response.expires_in * 1000
    };

    return response.access_token;
  }

  async getPickupPoints(cityCode?: number, city?: string) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekPickupPoint[]>('getPickupPoints', {
      method: 'GET',
      url: `${baseUrl}/v2/deliverypoints`,
      params: {
        city_code: cityCode,
        type: 'PVZ',
        is_handout: true,
        is_reception: true
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    return response
      .map((point) => {
        const lat = Number(point.location?.latitude ?? 0);
        const lon = Number(point.location?.longitude ?? 0);

        return {
          code: String(point.code ?? ''),
          name: String(point.name ?? ''),
          address: String(point.location?.address_full ?? ''),
          cityCode: Number(point.location?.city_code ?? 0),
          cityName: String(point.location?.city ?? ''),
          latitude: Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lon) ? lon : 0,
          workTime: String(point.work_time ?? ''),
          type: String(point.type ?? 'PVZ')
        };
      })
      .filter((point) => {
        if (!point.code) return false;
        if (!city) return true;
        return point.cityName.toLowerCase().includes(city.toLowerCase());
      });
  }

  async calculateDelivery(params: CalculateDeliveryParams) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<{ total_sum: number; period_min: number; period_max: number }>('calculateDelivery', {
      method: 'POST',
      url: `${baseUrl}/v2/calculator/tariff`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tariff_code: 136,
        from_location: { code: params.fromCityCode },
        to_location: { code: params.toCityCode },
        packages: [{
          weight: params.weightGrams,
          length: params.lengthCm ?? 10,
          width: params.widthCm ?? 10,
          height: params.heightCm ?? 10
        }]
      }
    });

    return {
      totalSum: Number(response.total_sum ?? 0),
      deliveryDaysMin: Number(response.period_min ?? 0),
      deliveryDaysMax: Number(response.period_max ?? 0),
      tariffCode: 136 as const
    };
  }

  async createOrder(params: CreateOrderParams) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekOrderResponse>('createOrder', {
      method: 'POST',
      url: `${baseUrl}/v2/orders`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tariff_code: 136,
        shipment_point: params.fromPvzCode,
        delivery_point: params.toPvzCode,
        comment: params.comment ?? '',
        recipient: {
          name: params.recipientName,
          phones: [{ number: params.recipientPhone }]
        },
        sender: {
          name: params.senderName ?? 'Маркетплейс PrintForm',
          phones: [{ number: params.senderPhone ?? '+70000000000' }]
        },
        services: [],
        packages: [{
          number: params.orderId,
          weight: params.weightGrams ?? 500,
          length: params.lengthCm ?? 10,
          width: params.widthCm ?? 10,
          height: params.heightCm ?? 10,
          comment: params.comment ?? '',
          items: params.items.map((item) => ({
            name: item.name,
            ware_key: item.article ?? item.id,
            payment: { value: 0 },
            cost: item.price,
            weight: 50,
            amount: item.quantity
          }))
        }]
      }
    });

    return {
      cdekOrderId: String(response.entity?.uuid ?? ''),
      trackingNumber: String(response.entity?.cdek_number ?? '')
    };
  }

  async getOrderInfo(cdekOrderId: string) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const response = await this.request<CdekOrderResponse>('getOrderInfo', {
      method: 'GET',
      url: `${baseUrl}/v2/orders/${cdekOrderId}`,
      headers: { Authorization: `Bearer ${token}` }
    });

    const statuses = response.entity?.statuses ?? response.statuses ?? [];
    const lastStatus = statuses.length > 0 ? statuses[statuses.length - 1]?.code ?? '' : '';

    return {
      cdekOrderId: String(response.entity?.uuid ?? cdekOrderId),
      status: String(lastStatus),
      trackingNumber: String(response.entity?.cdek_number ?? response.cdek_number ?? '')
    };
  }
}

export const cdekService = new CdekService();
