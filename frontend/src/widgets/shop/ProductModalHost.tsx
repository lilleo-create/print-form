import { useUiStore } from '../../app/store/uiStore';
import { ProductModal } from './ProductModal';

export const ProductModalHost = () => {
  const isOpen = useUiStore((state) => Boolean(state.selectedProduct));

  if (!isOpen) {
    return null;
  }

  return <ProductModal />;
};
