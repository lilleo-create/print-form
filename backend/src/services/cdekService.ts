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

type CdekPrintTaskResponse = {
  entity?: { uuid?: string };
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
  async getPickupPointByCode(pvzCode: string) {
    const code = String(pvzCode ?? '').trim();
    if (!code) throw new Error('CDEK_PVZ_CODE_REQUIRED');

    const points = await this.getPickupPoints(); // без cityCode, вернет все доступные (может быть много)
    const found = points.find((p) => String(p.code).toUpperCase() === code.toUpperCase());

    if (!found) {
      const err: any = new Error(`CDEK_PVZ_NOT_FOUND: ${code}`);
      err.code = 'CDEK_PVZ_NOT_FOUND';
      throw err;
    }

    // Сформируем raw в том формате, который твой sellerDropoffPvzSchema ожидает
    return {
      code: found.code,
      name: found.name,
      type: found.type ?? 'PVZ',
      location: {
        city_code: found.cityCode,
        city: found.cityName,
        latitude: found.latitude,
        longitude: found.longitude,
        address_full: found.address
      },
      work_time: found.workTime
    };
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
        packages: [
          {
            weight: params.weightGrams,
            length: params.lengthCm ?? 10,
            width: params.widthCm ?? 10,
            height: params.heightCm ?? 10
          }
        ]
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
        packages: [
          {
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
          }
        ]
      }
    });
    console.info('[CDEK][createOrder] pvz', {
      from: params.fromPvzCode,
      to: params.toPvzCode,
      orderId: params.orderId
    });

    if (!params.fromPvzCode) throw new Error('CDEK_FROM_PVZ_MISSING');
    if (!params.toPvzCode) throw new Error('CDEK_DESTINATION_PVZ_MISSING');
    const looksLikeCdekPvz = (v?: string) => typeof v === 'string' && /^[A-Z]{3}\d{2,6}$/.test(v);

    if (!looksLikeCdekPvz(params.toPvzCode)) {
      throw new Error(`CDEK_DESTINATION_PVZ_INVALID_CODE: ${params.toPvzCode}`);
    }
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

  /**
   * ✅ Обертка под “старый” вызов из проекта:
   * cdekService.createOrderFromMarketplaceOrder(...)
   * Чтобы не переписывать полпроекта.
   */
  async createOrderFromMarketplaceOrder(payload: {
    orderId: string;
    fromPvzCode: string;
    toPvzCode: string;
    recipientName: string;
    recipientPhone: string;
    items: CreateOrderItem[];
    comment?: string;
    senderName?: string;
    senderPhone?: string;
    weightGrams?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }) {
    
    return this.createOrder({
      orderId: payload.orderId,
      fromPvzCode: payload.fromPvzCode,
      toPvzCode: payload.toPvzCode,
      recipientName: payload.recipientName,
      recipientPhone: payload.recipientPhone,
      items: payload.items,
      comment: payload.comment,
      senderName: payload.senderName,
      senderPhone: payload.senderPhone,
      weightGrams: payload.weightGrams,
      lengthCm: payload.lengthCm,
      widthCm: payload.widthCm,
      heightCm: payload.heightCm
    });
  }

  /**
   * Создает задачу печати (накладная/квитанция).
   * CDEK обычно возвращает uuid задачи печати.
   */
  async createWaybillPrintTask(orderUuid: string) {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const resp = await this.request<CdekPrintTaskResponse>('createWaybillPrintTask', {
      method: 'POST',
      url: `${baseUrl}/v2/print/orders`,
      headers: { Authorization: `Bearer ${token}` },
      data: {
        orders: [{ order_uuid: orderUuid }],
        copy_count: 1
      }
    });

    const uuid = String(resp.entity?.uuid ?? '');
    if (!uuid) throw new Error('CDEK_PRINT_TASK_UUID_MISSING');
    return uuid;
  }

  /**
   * Забирает PDF по uuid задачи печати.
   * У CDEK это обычно GET /v2/print/orders/{uuid}.pdf
   */
  async getWaybillPdfByPrintTaskUuid(printTaskUuid: string): Promise<Buffer> {
    const token = await this.getToken();
    const { baseUrl } = getCdekConfig();

    const arrayBuffer = await this.request<ArrayBuffer>('getWaybillPdfByPrintTaskUuid', {
      method: 'GET',
      url: `${baseUrl}/v2/print/orders/${printTaskUuid}.pdf`,
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });

    return Buffer.from(arrayBuffer);
  }

  /**
   * Удобный метод: сразу pdf по uuid заказа.
   */
  async getWaybillPdfByOrderUuid(orderUuid: string): Promise<Buffer> {
    const printTaskUuid = await this.createWaybillPrintTask(orderUuid);
    return this.getWaybillPdfByPrintTaskUuid(printTaskUuid);
  }
}

export const cdekService = new CdekService();