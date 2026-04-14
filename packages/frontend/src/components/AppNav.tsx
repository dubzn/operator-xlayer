import { NavLink } from "react-router-dom";

export function AppNav() {
  return (
    <nav className="shell-nav glass-card" aria-label="Primary navigation">
      <NavLink to="/home" className="shell-brand">
        X402 Operator
      </NavLink>

      <div className="shell-nav-links">
        <NavLink to="/vaults" className={({ isActive }) => `shell-nav-link ${isActive ? "active" : ""}`}>
          Vaults
        </NavLink>
        <NavLink to="/docs" className={({ isActive }) => `shell-nav-link ${isActive ? "active" : ""}`}>
          Docs
        </NavLink>
      </div>
    </nav>
  );
}
