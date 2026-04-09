import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { IoSunny, IoMoon } from "react-icons/io5";
import pcLogo from "/images/PCL Logo.png";

export const Header = ({ showBranding = true }) => {
  const { user, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <nav className="bg-darkBg bg-opacity-95 backdrop-blur-sm p-4 sm:p-5 border-b-2 border-secondary border-opacity-40 shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
        {/* Logo & Branding */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-white rounded-lg p-1 shadow-md">
            <img
              src={pcLogo}
              alt="PCL 26"
              className="w-full h-full object-contain"
            />
          </div>
          {showBranding && (
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-3xl font-bold text-secondary">
                PCL 26
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 font-semibold">
                Panchsheel Cricket League
              </p>
            </div>
          )}
        </div>

        {/* Right side - Theme Toggle & User Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="theme-toggle bg-gray-700 hover:bg-gray-600 text-yellow-400"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <IoSunny className="w-5 h-5" />
            ) : (
              <IoMoon className="w-5 h-5" />
            )}
          </button>

          {/* User Info */}
          {user && (
            <>
              <span className="text-sm sm:text-base text-gray-300 text-right">
                {user.email}
              </span>
              {isAdmin && (
                <span className="bg-secondary text-primary px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-bold whitespace-nowrap">
                  Admin
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Header;
