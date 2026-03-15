import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import { ROUTES } from "../constants/routes";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      showToast("Login successful!", "success");
      navigate(ROUTES.ADMIN_SETUP);
    } catch (error) {
      showToast(error.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-primary text-center mb-2">
          Cricket Auction
        </h1>
        <p className="text-textLight text-center mb-6">Admin Login</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label className="block text-text font-semibold mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary transition"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-text font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary transition"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-accent text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="text-primary hover:text-accent font-semibold transition"
          >
            ← Back to Home
          </button>
        </div>

        {/* Demo Credentials */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800 font-semibold mb-2">
            Demo Credentials:
          </p>
          <p className="text-sm text-blue-700">
            Check your Firebase console for credentials
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
