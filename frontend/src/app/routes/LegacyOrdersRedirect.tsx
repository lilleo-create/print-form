import { Navigate, useParams } from 'react-router-dom';

export const LegacyOrdersRedirect = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={orderId ? `/account/orders/${encodeURIComponent(orderId)}` : '/account?tab=orders'} replace />;
};
