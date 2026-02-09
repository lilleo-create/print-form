import { useMemo } from 'react';
import { useAuthStore } from '../app/store/authStore';

type SellerIdentity = {
  isSeller: boolean;
  shopId: string | null;
};

export const useIsSeller = (): SellerIdentity => {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    if (!user) {
      return { isSeller: false, shopId: null };
    }
    const normalizedRole = user.role?.toLowerCase?.() ?? '';
    const inferredShopId =
      (user as { shopId?: string; sellerId?: string }).shopId ??
      (user as { shopId?: string; sellerId?: string }).sellerId ??
      user.id ??
      null;
    const isSeller = normalizedRole === 'seller' || Boolean((user as { sellerId?: string; shopId?: string }).sellerId);
    return { isSeller, shopId: inferredShopId };
  }, [user]);
};
