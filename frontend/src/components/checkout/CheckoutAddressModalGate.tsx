import type { Address } from '../../shared/types';
import { AddressModal } from '../../shared/ui/address/AddressModal';

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

export const CheckoutAddressModalGate = ({
  isOpen,
  addresses,
  selectedAddressId,
  userId,
  onClose,
  onSelect,
  onCreate,
  onUpdate,
  onDelete
}: CheckoutAddressModalGateProps) => (
  <AddressModal
    isOpen={isOpen}
    addresses={addresses}
    selectedAddressId={selectedAddressId}
    userId={userId}
    onClose={onClose}
    onSelect={onSelect}
    onCreate={onCreate}
    onUpdate={onUpdate}
    onDelete={onDelete}
  />
);
