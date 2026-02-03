import { useEffect } from 'react';
import type { Product } from '../shared/types';
import { useProductBoardStore } from '../app/store/productBoardStore';

export const useProductBoard = (product: Product | null) => {
  const setProductBoard = useProductBoardStore((state) => state.setProduct);

  useEffect(() => {
    if (product) {
      setProductBoard(product);
    }
  }, [product, setProductBoard]);

  useEffect(() => () => setProductBoard(null), [setProductBoard]);
};
