import { ProductMiniCard as SharedProductMiniCard } from '../ProductMiniCard';

interface Props {
  title: string;
  price: number;
  qty?: number;
  image?: string;
}

export const ProductMiniCard = (props: Props) => <SharedProductMiniCard {...props} />;
