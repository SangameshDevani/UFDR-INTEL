import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const inCase = pathname.startsWith("/cases/");

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">U</span>
          <span><strong>UFDR</strong><small>INVESTIGATION CONSOLE</small></span>
        </Link>
        <button className="menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <span /> <span /> <span />
        </button>
        <nav className={menuOpen ? "topnav open" : "topnav"}>
          <Link to="/" className={!inCase ? "active" : ""} onClick={() => setMenuOpen(false)}>Cases</Link>
          {inCase && <span className="nav-context">Case workspace</span>}
        </nav>
        <div className="secure-indicator"><span /> Secure workspace</div>
      </header>
      <main className="workspace"><Outlet /></main>
    </div>
  );
}
