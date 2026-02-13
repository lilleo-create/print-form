import { useParams } from 'react-router-dom';
import { ProductPageLayout } from '../components/product/ProductPageLayout';

export const ProductPage = () => {
  const { id } = useParams();

  if (!id) return null;

  return <ProductPageLayout productId={id} />;
};
