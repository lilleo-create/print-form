export type BackendSellerType = 'IP' | 'LLC' | 'SELF_EMPLOYED';
export type SellerTypeUi = 'ИП' | 'ООО' | 'Самозанятый';
export type SellerTypeValue = BackendSellerType | SellerTypeUi;

const sellerTypeToUiMap: Record<SellerTypeValue, SellerTypeUi> = {
  IP: 'ИП',
  LLC: 'ООО',
  SELF_EMPLOYED: 'Самозанятый',
  ИП: 'ИП',
  ООО: 'ООО',
  Самозанятый: 'Самозанятый'
};

const sellerTypeToBackendMap: Record<SellerTypeUi, BackendSellerType> = {
  ИП: 'IP',
  ООО: 'LLC',
  Самозанятый: 'SELF_EMPLOYED'
};

export const normalizeSellerType = (
  value: string | null | undefined
): SellerTypeUi | null => {
  if (!value) {
    return null;
  }

  return value in sellerTypeToUiMap
    ? sellerTypeToUiMap[value as SellerTypeValue]
    : null;
};

export const toBackendSellerType = (
  value: SellerTypeUi
): BackendSellerType => sellerTypeToBackendMap[value];
