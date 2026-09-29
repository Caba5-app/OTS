import { Navigate } from 'react-router-dom';
import { useDependenciaAuth } from '../DependenciaAuthContext';

export default function RequireDependenciaAuth({ children }) {
  const { loggedIn, loading } = useDependenciaAuth();

  if (loading) return <div className="centered-page">Cargando...</div>;
  if (!loggedIn) return <Navigate to="/dependencia/login" replace />;
  return children;
}
