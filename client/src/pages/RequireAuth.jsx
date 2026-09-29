import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function RequireAuth({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return <div className="centered-page">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/login" replace />;
  return children;
}
