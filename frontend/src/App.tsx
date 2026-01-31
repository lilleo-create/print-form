import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './widgets/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CatalogPage } from './pages/CatalogPage';
import { BuyerAccountPage } from './pages/BuyerAccountPage';
import { SellerAccountPage } from './pages/SellerAccountPage';
import { AuthPage } from './pages/AuthPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProtectedRoute } from './app/routes/ProtectedRoute';
import { AdminRoute } from './app/routes/AdminRoute';
import { ProductPage } from './pages/ProductPage';
import { ProductReviewsPage } from './pages/ProductReviewsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SellerOnboardingPage } from './pages/SellerOnboardingPage';
import { OrdersPage } from './pages/OrdersPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminKycPage } from './pages/admin/AdminKycPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

const App = () => {
  return (
    <Routes>
      <Route
        element={
          <Layout>
            <Outlet />
          </Layout>
        }
      >
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/product/:id/reviews" element={<ProductReviewsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/returns" element={<ReturnsPage />} />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
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
            <ProtectedRoute requiredRole="seller">
              <SellerAccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="/seller/onboarding" element={<SellerOnboardingPage />} />
        <Route path="/auth/login" element={<AuthPage />} />
        <Route path="/auth/register" element={<AuthPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
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
      </Route>
    </Routes>
  );
};

export default App;
