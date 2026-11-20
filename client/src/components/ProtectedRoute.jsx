import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './Status';

const ProtectedRoute = ({ children }) => {
  const { user, checking } = useAuth();
  const location = useLocation();

  // Don't bounce to /login while the session cookie is still being checked.
  if (checking) return <Loading />;

  if (!user) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
