import { useMemo } from 'react';
import { useAuthStore } from '../../app/store/authStore';
import { useSellerContext } from '../../hooks/seller/useSellerContext';

type UserWithShop = {
  role?: string | null;
  id?: string | null;
  shopId?: string | null;
};

export const useIsSeller = () => {
  const user = useAuthStore((state) => state.user) as UserWithShop | null;
  const { authStatus, context } = useSellerContext();

  return useMemo(() => {
    const hasSellerProfile = Boolean(context?.profile);
    const normalizedRole = user?.role?.toLowerCase() ?? null;
    const isSeller = hasSellerProfile || normalizedRole === 'seller';
    const shopId = context?.profile?.id ?? user?.shopId ?? user?.id ?? null;
    const sellerCabinetLink = isSeller ? '/seller' : '/seller/onboarding';

    return {
      isSeller,
      shopId,
      sellerCabinetLink,
      sellerShopLink: shopId ? `/shop/${shopId}` : null,
      hasSellerProfile,
      isSellerContextResolved: authStatus !== 'loading'
    };
  }, [authStatus, context?.profile, user?.id, user?.role, user?.shopId]);
};
