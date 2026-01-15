import { Route, Routes } from 'react-router-dom';
import { Layout } from './widgets/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CatalogPage } from './pages/CatalogPage';
import { BuyerAccountPage } from './pages/BuyerAccountPage';
import { SellerAccountPage } from './pages/SellerAccountPage';
import { AuthPage } from './pages/AuthPage';
import { ProtectedRoute } from './app/routes/ProtectedRoute';

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
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
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
