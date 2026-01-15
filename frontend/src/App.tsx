import { Route, Routes } from 'react-router-dom';
import { Layout } from './widgets/layout/Layout';
import { LandingPage } from './pages/LandingPage';
import { CatalogPage } from './pages/CatalogPage';
import { BuyerAccountPage } from './pages/BuyerAccountPage';
import { SellerAccountPage } from './pages/SellerAccountPage';
import { AuthPage } from './pages/AuthPage';

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/account" element={<BuyerAccountPage />} />
        <Route path="/seller" element={<SellerAccountPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
