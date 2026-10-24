/* =====================================================================
   auth.js — first-run setup, login/logout, change password, page guard,
             role-based navigation, theme toggle.
   Depends on storage.js (loaded before this file).
   ===================================================================== */

/* Where are we? root (index.html) or inside /pages/ */
const IN_PAGES =
  /\/pages\/[^/]+\.html$/i.test(window.location.pathname) ||
  /pages[\\/]/i.test(window.location.pathname);
const BASE = IN_PAGES ? '' : 'pages/'; // link target dir
const ROOT = IN_PAGES ? '../' : ''; // link to root files

/* ---------- validation ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validEmail(email) {
  return EMAIL_RE.test((email || '').trim());
}

/* ---------- first-run setup: company + admin account ---------- */
function completeSetup({ name, adminName, adminEmail, password, department }) {
  if (isSetupDone()) throw new Error('Setup already completed.');
  if (!name || !name.trim()) throw new Error('Company name is required.');
  if (!validEmail(adminEmail)) throw new Error('Enter a valid admin email.');
  if (findUserByEmail(adminEmail)) throw new Error('Email already in use.');
  if (!password || password.length < 4)
    throw new Error('Password must be at least 4 characters.');

  saveCompany(defaultCompany(name.trim()));
  addUser({
    name: adminName.trim() || 'Admin',
    email: adminEmail.trim(),
    password,
    role: 'admin',
    department: (department || 'Management').trim(),
    salary: 0,
  });
}

/* ---------- login / logout ---------- */
function login(email, password) {
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  setSession(user.id);
  return { ok: true, user };
}
function logout() {
  clearSession();
  window.location.href = ROOT + 'index.html';
}
function changePassword(userId, oldPw, newPw) {
  const user = getUserById(userId);
  if (!user || user.password !== oldPw)
    return { ok: false, error: 'Current password is wrong.' };
  if (!newPw || newPw.length < 4)
    return { ok: false, error: 'New password must be at least 4 characters.' };
  updateUser(userId, { password: newPw });
  return { ok: true };
}

/* ---------- page guard ---------- */
// requireRole("admin") | requireRole("employee") | requireRole("any")
function requireRole(role) {
  const user = currentUser();
  if (!user) {
    window.location.href = ROOT + 'index.html';
    return null;
  }
  if (role !== 'any' && user.role !== role) {
    // wrong area -> send to their own dashboard
    window.location.href =
      user.role === 'admin' ? BASE + 'admin.html' : BASE + 'employee.html';
    return null;
  }
  return user;
}

/* ---------- navigation ---------- */
const NAV = {
  admin: [
    { label: 'Dashboard', href: 'admin.html' },
    { label: 'Employees', href: 'employees.html' },
    { label: 'Leaves', href: 'leaves.html' },
    { label: 'Payslips', href: 'payslip.html' },
    { label: 'Settings', href: 'settings.html' },
  ],
  employee: [
    { label: 'Dashboard', href: 'employee.html' },
    { label: 'My Payslip', href: 'payslip.html' },
  ],
};

function renderChrome(user, activeLabel) {
  const company = getCompany() || {};
  const mount = document.getElementById('nav-mount');
  if (!mount) return;
  const links = NAV[user.role]
    .map(
      (n) =>
        `<a class="nav-link${n.label === activeLabel ? ' active' : ''}" href="${BASE}${n.href}">${n.label}</a>`,
    )
    .join('');

  mount.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="logo">H</span>
        <div>
          <strong>${escapeHtml(company.name || 'HCM Lite')}</strong>
          <small>${user.role === 'admin' ? 'Admin' : 'Employee'}</small>
        </div>
      </div>
      <nav class="nav">${links}</nav>
      <div class="userbox">
        <button class="icon-btn" id="themeToggle" title="Toggle dark mode">◐</button>
        <span class="who">${escapeHtml(user.name)}</span>
        <button class="btn btn-ghost btn-sm" id="pwdBtn">Password</button>
        <button class="btn btn-sm" id="logoutBtn">Logout</button>
      </div>
    </header>
    <button class="hamburger" id="hamburger">☰</button>`;

  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('pwdBtn').onclick = () => openPasswordModal(user);
  document.getElementById('hamburger').onclick = () =>
    mount.querySelector('.nav').classList.toggle('open');

  // theme
  const root = document.documentElement;
  if (localStorage.getItem('hcm_theme') === 'dark') root.classList.add('dark');
  document.getElementById('themeToggle').onclick = () => {
    root.classList.toggle('dark');
    localStorage.setItem(
      'hcm_theme',
      root.classList.contains('dark') ? 'dark' : 'light',
    );
  };
}

/* ---------- password modal (change password) ---------- */
function openPasswordModal(user) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal">
      <h3>Change password</h3>
      <label>Current password<input type="password" id="cp_old"></label>
      <label>New password<input type="password" id="cp_new"></label>
      <p class="error" id="cp_err"></p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cp_cancel">Cancel</button>
        <button class="btn" id="cp_save">Save</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#cp_cancel').onclick = () => wrap.remove();
  wrap.querySelector('#cp_save').onclick = () => {
    const oldPw = wrap.querySelector('#cp_old').value;
    const newPw = wrap.querySelector('#cp_new').value;
    const res = changePassword(user.id, oldPw, newPw);
    if (!res.ok) {
      wrap.querySelector('#cp_err').textContent = res.error;
    } else {
      wrap.remove();
      toast('Password updated.');
    }
  };
}

/* ---------- tiny helpers ---------- */
function escapeHtml(s) {
  return (s == null ? '' : String(s)).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
}
function money(n) {
  return (
    'PKR ' +
    Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
