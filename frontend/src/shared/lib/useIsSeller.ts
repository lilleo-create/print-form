import { useMemo } from 'react';
import { useAuthStore } from '../../app/store/authStore';
import { useSellerContext } from '../../hooks/seller/useSellerContext';

type UserWithShop = {
  role?: string | null;
  id?: string | null;
  shopId?: string | null;
};

type SellerProfileWithUserId = {
  id?: string | null;
  userId?: string | null;
};

export const useIsSeller = () => {
  const user = useAuthStore((state) => state.user) as UserWithShop | null;
  const { authStatus, context } = useSellerContext();

  return useMemo(() => {
    const hasSellerProfile = Boolean(context?.profile);
    const normalizedRole = user?.role?.toLowerCase() ?? null;
    const isSeller = hasSellerProfile || normalizedRole === 'seller';
    const profile = (context?.profile ?? null) as SellerProfileWithUserId | null;

    // Public shop endpoints expect seller USER id.
    // sellerProfile.id is a separate entity id and may return NOT_FOUND on /shops/:shopId.
    const shopId = user?.id ?? user?.shopId ?? profile?.userId ?? profile?.id ?? null;
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
