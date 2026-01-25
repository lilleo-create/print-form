import { Route, Routes } from 'react-router-dom';
import { Layout } from './widgets/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CatalogPage } from './pages/CatalogPage';
import { BuyerAccountPage } from './pages/BuyerAccountPage';
import { SellerAccountPage } from './pages/SellerAccountPage';
import { AuthPage } from './pages/AuthPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { ProtectedRoute } from './app/routes/ProtectedRoute';
import { ProductPage } from './pages/ProductPage';
import { ProductReviewsPage } from './pages/ProductReviewsPage';

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/product/:id/reviews" element={<ProductReviewsPage />} />
        <Route path="/cart" element={<CartPage />} />
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
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
