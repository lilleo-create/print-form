import { useMemo } from 'react';
import { useAuthStore } from '../../app/store/authStore';

type UserWithShop = {
  role?: string | null;
  id?: string | null;
  shopId?: string | null;
};

export const useIsSeller = () => {
  const user = useAuthStore((state) => state.user) as UserWithShop | null;

  return useMemo(() => {
    const isSeller = user?.role === 'seller';
    const shopId = user?.shopId ?? user?.id ?? null;

    return {
      isSeller,
      shopId,
      sellerCabinetLink: isSeller ? '/seller' : '/seller/onboarding',
      sellerShopLink: shopId ? `/shop/${shopId}` : null
    };
  }, [user?.id, user?.role, user?.shopId]);
};
