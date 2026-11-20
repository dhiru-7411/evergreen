import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';

const navClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  // Refetch on navigation so the count drops right after a review.
  const { data: inbox } = useFetch(user ? '/fixes/inbox' : null, location.key);

  const handleLogout = async () => {
    await logout();
    // Full reload rather than navigate(): router navigations run in a
    // transition, so on a protected page ProtectedRoute would redirect to
    // /login (remembering this page) first. A reload also drops any of the
    // previous user's data still held in memory.
    window.location.assign('/');
  };

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" />
          Evergreen
        </Link>
        <div className="nav-links">
          <NavLink to="/learn" className={navClass}>
            Learn
          </NavLink>
          {user ? (
            <>
              <NavLink to="/inbox" className={navClass}>
                Fixes
                {inbox?.length > 0 && <span className="count-dot">{inbox.length}</span>}
              </NavLink>
              <NavLink to="/create" className={navClass}>
                Write
              </NavLink>
              <NavLink to={`/u/${user.username}`} className={(a) => `${navClass(a)} hide-sm`}>
                @{user.username}
              </NavLink>
              <NavLink to="/account" className={(a) => `${navClass(a)} hide-sm`}>
                Account
              </NavLink>
              <button className="btn btn-sm btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
              <Link to="/register" className="btn btn-sm btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
