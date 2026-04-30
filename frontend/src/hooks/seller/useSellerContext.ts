export type SellerAuthStatus = 'loading' | 'authorized' | 'unauthorized';

export type SellerProfile = {
  id: string;
  userId: string;
  sellerType?: string | null;
  storeName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  city?: string | null;
  representativeName?: string | null;
  legalName?: string | null;
  inn?: string | null;
  ogrn?: string | null;
};

export type SellerContextError = {
  code?: string;
  status?: number;
  message: string;
} | null;

export type SellerContext = {
  authStatus: SellerAuthStatus;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: SellerContextError;
  reload: () => void;
  context: {
    profile: SellerProfile | null;
  } | null;
};

export const useSellerContext = (): SellerContext => {
  return {
    authStatus: 'unauthorized',
    status: 'idle',
    error: null,
    reload: () => {},
    context: null
  };
};
