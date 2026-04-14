import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROUTES } from "../constants/routes";
import { Loading } from "./Loading";

export const AuthGate = ({ children, requireAdmin = false }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading message="Authenticating..." />;
  }

  if (!requireAdmin) {
    return children;
  }

  // If a protected route is visited without a valid admin session,
  // redirect once to login and preserve the source route.
  if (!user || !isAdmin) {
    if (location.pathname !== ROUTES.LOGIN) {
      return (
        <Navigate
          to={ROUTES.LOGIN}
          replace
          state={{ from: `${location.pathname}${location.search}` }}
        />
      );
    }
    return <Loading message="Checking access..." />;
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return <Loading message="Loading..." />;
  }

  return children;
};

export default AuthGate;
