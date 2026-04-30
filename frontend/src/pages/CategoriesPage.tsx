import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const CategoriesPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/catalog', { replace: true });
  }, [navigate]);

  return null;
};
