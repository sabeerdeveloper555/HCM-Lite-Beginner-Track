/* =====================================================================
   storage.js — All localStorage reads/writes + shared business helpers
   Keys: hcm_company, hcm_users, hcm_attendance, hcm_leaves,
         hcm_session, hcm_announcements
   ===================================================================== */

const KEYS = {
  company: 'hcm_company',
  users: 'hcm_users',
  attendance: 'hcm_attendance',
  leaves: 'hcm_leaves',
  session: 'hcm_session',
  announcements: 'hcm_announcements',
};

/* ---------- low level ---------- */
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------- company / settings ---------- */
function getCompany() {
  return read(KEYS.company, null);
}
function saveCompany(company) {
  write(KEYS.company, company);
}
function isSetupDone() {
  return !!getCompany();
}
// settings default shape
function defaultCompany(name) {
  return {
    name: name,
    startTime: '09:00', // office start (HH:MM)
    graceMinutes: 15, // grace after start before "late"
    leaveQuota: 12, // yearly paid leave quota per employee
    halfDayHours: 5, // under this many worked hours = half day
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri (0 = Sunday)
  };
}

/* ---------- users ---------- */
function getUsers() {
  return read(KEYS.users, []);
}
function saveUsers(users) {
  write(KEYS.users, users);
}
function findUserByEmail(email) {
  const e = (email || '').trim().toLowerCase();
  return getUsers().find((u) => u.email.toLowerCase() === e) || null;
}
function getUserById(id) {
  return getUsers().find((u) => u.id === id) || null;
}
function getEmployees() {
  return getUsers().filter((u) => u.role === 'employee');
}
function addUser(user) {
  const users = getUsers();
  user.id = user.id || Date.now();
  users.push(user);
  saveUsers(users);
  return user;
}
function updateUser(id, patch) {
  const users = getUsers();
  const i = users.findIndex((u) => u.id === id);
  if (i === -1) return null;
  users[i] = { ...users[i], ...patch };
  saveUsers(users);
  return users[i];
}
function deleteUser(id) {
  saveUsers(getUsers().filter((u) => u.id !== id));
  // remove their records too
  saveAttendance(getAttendance().filter((a) => a.employeeId !== id));
  saveLeaves(getLeaves().filter((l) => l.employeeId !== id));
}

/* ---------- attendance ---------- */
function getAttendance() {
  return read(KEYS.attendance, []);
}
function saveAttendance(rows) {
  write(KEYS.attendance, rows);
}
function attendanceFor(employeeId) {
  return getAttendance()
    .filter((a) => a.employeeId === employeeId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
function findAttendance(employeeId, date) {
  return (
    getAttendance().find(
      (a) => a.employeeId === employeeId && a.date === date,
    ) || null
  );
}

/* ---------- leaves ---------- */
function getLeaves() {
  return read(KEYS.leaves, []);
}
function saveLeaves(rows) {
  write(KEYS.leaves, rows);
}
function leavesFor(employeeId) {
  return getLeaves()
    .filter((l) => l.employeeId === employeeId)
    .sort((a, b) => (a.from < b.from ? 1 : -1));
}

/* ---------- announcements ---------- */
function getAnnouncements() {
  return read(KEYS.announcements, []);
}
function saveAnnouncements(rows) {
  write(KEYS.announcements, rows);
}
function addAnnouncement(text, authorName) {
  const rows = getAnnouncements();
  rows.unshift({
    id: Date.now(),
    text,
    author: authorName,
    createdAt: new Date().toISOString(),
  });
  saveAnnouncements(rows);
  return rows;
}

/* ---------- session ---------- */
function getSession() {
  return read(KEYS.session, null);
}
function setSession(userId) {
  write(KEYS.session, { userId, at: Date.now() });
}
function clearSession() {
  localStorage.removeItem(KEYS.session);
}
function currentUser() {
  const s = getSession();
  if (!s) return null;
  return getUserById(s.userId);
}

/* =====================================================================
   Business helpers (dates, working days, status)
   ===================================================================== */

function todayStr(d) {
  const t = d || new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function nowTimeStr() {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
function minutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// true if the given Date falls on a configured working day
function isWorkingDay(date, company) {
  const days = (company && company.workingDays) || [1, 2, 3, 4, 5];
  return days.includes(date.getDay());
}

// count working days between two ISO dates (inclusive), skipping weekends
function countWorkingDays(fromStr, toStr, company) {
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T00:00:00');
  if (isNaN(from) || isNaN(to) || from > to) return 0;
  let n = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (isWorkingDay(cur, company)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

// total working days in a given month (month = 0-11)
function workingDaysInMonth(year, month, company) {
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= last; d++) {
    if (isWorkingDay(new Date(year, month, d), company)) n++;
  }
  return n;
}

// decide status label from check-in time vs company rules
function statusFromCheckIn(checkIn, company) {
  const limit = minutes(company.startTime) + Number(company.graceMinutes || 0);
  return minutes(checkIn) > limit ? 'late' : 'present';
}

// recompute status after check-out using worked hours
function statusWithCheckout(baseStatus, checkIn, checkOut, company) {
  if (!checkOut) return baseStatus;
  const worked = (minutes(checkOut) - minutes(checkIn)) / 60;
  if (worked < Number(company.halfDayHours || 5)) return 'half day';
  return baseStatus; // present or late
}

function workedHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, (minutes(checkOut) - minutes(checkIn)) / 60);
}

// does leave range [from,to] overlap any approved/pending leave for employee
function overlapsLeave(employeeId, from, to) {
  return getLeaves().some(
    (l) =>
      l.employeeId === employeeId &&
      l.status !== 'rejected' &&
      !(to < l.from || from > l.to),
  );
}

// approved leave days used this year by an employee
function leavesUsed(employeeId, year) {
  return getLeaves()
    .filter((l) => {
      if (l.employeeId !== employeeId || l.status !== 'approved') return false;
      return year
        ? new Date(l.from + 'T00:00:00').getFullYear() === year
        : true;
    })
    .reduce((sum, l) => sum + Number(l.days || 0), 0);
}
