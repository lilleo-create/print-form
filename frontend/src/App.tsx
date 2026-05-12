import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './widgets/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CatalogPage } from './pages/CatalogPage';
import { BuyerAccountPage } from './pages/account/BuyerAccountPage';
import { SellerDashboardPage } from './pages/SellerDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProtectedRoute } from './app/routes/ProtectedRoute';
import { AdminRoute } from './app/routes/AdminRoute';
import { ProductPage } from './pages/ProductPage';
import { ProductReviewsPage } from './pages/ProductReviewsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ServiceRulesPage } from './pages/ServiceRulesPage';
import { OfferPage } from './pages/OfferPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SellerOnboardingPage } from './pages/SellerOnboardingPage';
import { OrdersPage } from './pages/OrdersPage';
import { CartSavedPage } from './pages/CartSavedPage';
import { CartSharedPage } from './pages/CartSharedPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminKycPage } from './pages/admin/AdminKycPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminChatsPage } from './pages/admin/AdminChatsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ShopPage } from './pages/ShopPage/ShopPage';
import { CdekWidgetPage } from './pages/CdekWidgetPage';
import { AuthBootstrap } from './app/providers/AuthBootstrap';
import { RouteScrollManager } from './app/providers/RouteScrollManager';
import { RouteProgressBar } from './app/providers/RouteProgressBar';
import { SellerProductDetailPage } from './pages/SellerProductDetailPage';
import { PaymentReturnPage } from './pages/PaymentReturnPage';

const OrderRedirect = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={`/account?tab=orders${orderId ? `&orderId=${orderId}` : ''}`} replace />;
};

const App = () => {
  return (
    <>
      <AuthBootstrap />
      <RouteScrollManager />
      <RouteProgressBar />
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/product/:id/reviews" element={<ProductReviewsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/cart/saved" element={<CartSavedPage />} />
        <Route path="/cart/shared" element={<CartSharedPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/returns" element={<ReturnsPage />} />

        <Route
          path="/cancel"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/return"
          element={
            <ProtectedRoute>
              <PaymentReturnPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <BuyerAccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller"
          element={
            <ProtectedRoute>
              <SellerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller/products/:productId"
          element={
            <ProtectedRoute>
              <SellerProductDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />
        <Route path="/auth/login" element={<AuthPage />} />
        <Route path="/auth/register" element={<AuthPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/oauth-callback" element={<OAuthCallbackPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/service-rules" element={<ServiceRulesPage />} />
        <Route path="/offer" element={<OfferPage />} />
      </Route>

      <Route element={<Layout showHeader={false} />}>
        <Route path="/shop/:shopId" element={<ShopPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/kyc" replace />} />
        <Route path="kyc" element={<AdminKycPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
        <Route path="chats" element={<AdminChatsPage />} />
      </Route>

      <Route path="/cdek-widget" element={<CdekWidgetPage />} />
      </Routes>
    </>
  );
};

export default App;
