import type { Address } from '../../shared/types';

type CheckoutAddressModalGateProps = {
  isOpen: boolean;
  addresses: Address[];
  selectedAddressId: string;
  userId: string;
  onClose: () => void;
  onSelect: (addressId: string) => Promise<void>;
  onCreate: (payload: Omit<Address, 'id' | 'createdAt'>) => Promise<Address>;
  onUpdate: (payload: Address) => Promise<Address>;
  onDelete: (addressId: string) => Promise<void>;
};

export const CheckoutAddressModalGate = (_props: CheckoutAddressModalGateProps) => null;
