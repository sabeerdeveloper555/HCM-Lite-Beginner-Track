/* =====================================================================
   attendance.js — check-in / check-out + records rendering.
   Rules: one check-in per day; late if after start+grace; check-out only
   after check-in; under halfDayHours worked => half day.
   ===================================================================== */

// today's attendance record for an employee (or null)
function todayAttendance(employeeId) {
  return findAttendance(employeeId, todayStr());
}

// returns { ok, message, record }
function checkIn(employeeId) {
  const company = getCompany();
  const existing = todayAttendance(employeeId);
  if (existing) return { ok: false, message: 'You already checked in today.' };

  const time = nowTimeStr();
  let status = statusFromCheckIn(time, company);
  const rec = {
    employeeId,
    date: todayStr(),
    checkIn: time,
    checkOut: null,
    status,
  };
  const rows = getAttendance();
  rows.push(rec);
  saveAttendance(rows);
  return {
    ok: true,
    message: `Checked in at ${time} — marked ${status}.`,
    record: rec,
  };
}

function checkOut(employeeId) {
  const company = getCompany();
  const rows = getAttendance();
  const i = rows.findIndex(
    (a) => a.employeeId === employeeId && a.date === todayStr(),
  );
  if (i === -1) return { ok: false, message: 'You must check in first.' };
  if (rows[i].checkOut)
    return { ok: false, message: 'You already checked out today.' };

  const time = nowTimeStr();
  rows[i].checkOut = time;
  rows[i].status = statusWithCheckout(
    rows[i].status,
    rows[i].checkIn,
    time,
    company,
  );
  saveAttendance(rows);
  const hrs = workedHours(rows[i].checkIn, time).toFixed(1);
  return {
    ok: true,
    message: `Checked out at ${time}. Worked ${hrs} hrs — ${rows[i].status}.`,
    record: rows[i],
  };
}

/* status pill markup — class-safe (spaces -> dash) */
function pill(status) {
  const cls = String(status).toLowerCase().replace(/\s+/g, '-');
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

/* render a list of attendance records into a container */
function renderAttendanceTable(containerId, records, showName) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!records.length) {
    el.innerHTML = `<tr><td colspan="${showName ? 6 : 5}" class="empty">No attendance records yet.</td></tr>`;
    return;
  }
  el.innerHTML = records
    .map((r) => {
      const emp = showName ? getUserById(r.employeeId) : null;
      const hrs = r.checkOut
        ? workedHours(r.checkIn, r.checkOut).toFixed(1)
        : '—';
      return `<tr>
        ${showName ? `<td>${escapeHtml(emp ? emp.name : '—')}</td>` : ''}
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.checkIn || '—')}</td>
        <td>${escapeHtml(r.checkOut || '—')}</td>
        <td>${hrs}</td>
        <td>${pill(r.status)}</td>
      </tr>`;
    })
    .join('');
}

/* attendance snapshot for "today" across all employees (admin) */
function todaySnapshot() {
  const company = getCompany();
  const today = todayStr();
  const emps = getEmployees();
  const recs = getAttendance().filter((a) => a.date === today);
  const present = recs.filter((r) => r.status === 'present').length;
  const late = recs.filter((r) => r.status === 'late').length;
  const half = recs.filter((r) => r.status === 'half day').length;
  const onLeaveToday = emps.filter((e) =>
    getLeaves().some(
      (l) =>
        l.employeeId === e.id &&
        l.status === 'approved' &&
        l.from <= today &&
        l.to >= today,
    ),
  ).length;
  const absent = Math.max(0, emps.length - recs.length - onLeaveToday);
  return {
    total: emps.length,
    present,
    late,
    half,
    onLeaveToday,
    absent,
    isWorkingDay: isWorkingDay(new Date(), company),
  };
}

/* export attendance of a set of records to CSV (bonus) */
function exportAttendanceCSV(records) {
  const head = ['Date', 'Employee', 'Check-in', 'Check-out', 'Hours', 'Status'];
  const lines = records.map((r) => {
    const emp = getUserById(r.employeeId);
    return [
      r.date,
      emp ? emp.name : '',
      r.checkIn,
      r.checkOut || '',
      r.checkOut ? workedHours(r.checkIn, r.checkOut).toFixed(2) : '',
      r.status,
    ];
  });
  const csv = [head, ...lines]
    .map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attendance_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
