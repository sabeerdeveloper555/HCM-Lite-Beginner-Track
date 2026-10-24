/* =====================================================================
   payslip.js — monthly salary slip.
   perDay   = salary / working days in month
   deduction= perDay * (absent days + 0.5 * half days)
   net      = salary - deduction
   ===================================================================== */

// classify an employee's month into present/full, half, absent, leave counts
function payslipBreakdown(employeeId, year, month /* 0-11 */) {
  const company = getCompany();
  const workDays = workingDaysInMonth(year, month, company);
  const last = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  const recs = getAttendance().filter((a) => a.employeeId === employeeId);
  const byDate = {};
  recs.forEach((r) => (byDate[r.date] = r));

  // approved leave dates for this employee
  const approved = getLeaves().filter(
    (l) => l.employeeId === employeeId && l.status === 'approved',
  );

  let full = 0,
    half = 0,
    absent = 0,
    leave = 0;
  for (let d = 1; d <= last; d++) {
    const date = new Date(year, month, d);
    const iso = todayStr(date);
    if (!isWorkingDay(date, company)) continue; // skip weekends
    if (iso > today) continue; // ignore future days
    if (byDate[iso]) {
      if (byDate[iso].status === 'half day') half++;
      else full++;
    } else if (approved.some((l) => iso >= l.from && iso <= l.to)) {
      leave++; // paid leave, not deducted
    } else {
      absent++;
    }
  }
  return { workDays, full, half, absent, leave };
}

function computePayslip(employee, year, month) {
  const company = getCompany();
  const b = payslipBreakdown(employee.id, year, month);
  const perDay = b.workDays ? Number(employee.salary) / b.workDays : 0;
  const deduction = perDay * (b.absent + 0.5 * b.half);
  const net = Math.max(0, Number(employee.salary) - deduction);
  return {
    employee,
    year,
    month,
    halfThreshold: Number(company.halfDayHours || 5),
    ...b,
    perDay,
    gross: Number(employee.salary),
    deduction,
    net,
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/* build the printable payslip HTML */
function renderPayslip(container, p) {
  const d = new Date();
  container.innerHTML = `
    <div class="payslip card">
      <div class="page-head">
        <div>
          <h2>${escapeHtml(getCompany().name || 'HCM Lite')}</h2>
          <p class="muted">Monthly Payslip · ${MONTH_NAMES[p.month]} ${p.year}</p>
        </div>
        <span class="badge-role">Payslip</span>
      </div>
      <div class="grid cols-2" style="margin:1rem 0">
        <div><strong>Employee</strong><br>${escapeHtml(p.employee.name)}</div>
        <div><strong>Department</strong><br>${escapeHtml(p.employee.department)}</div>
        <div><strong>Email</strong><br>${escapeHtml(p.employee.email)}</div>
      </div>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><td>Working days in month</td><td style="text-align:right">${p.workDays}</td></tr>
            <tr><td>Days present</td><td style="text-align:right">${p.full}</td></tr>
            <tr><td>Half days (&lt; ${p.halfThreshold} hrs)</td><td style="text-align:right">${p.half}</td></tr>
            <tr><td>Days on approved leave</td><td style="text-align:right">${p.leave}</td></tr>
            <tr><td>Absent days</td><td style="text-align:right">${p.absent}</td></tr>
            <tr><td>Per-day rate</td><td style="text-align:right">${money(p.perDay)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top:1rem">
        <div class="payslip-line"><span>Gross salary</span><span>${money(p.gross)}</span></div>
        <div class="payslip-line"><span>Deductions (absent + ½·half)</span><span>− ${money(Math.round(p.deduction))}</span></div>
        <div class="payslip-line payslip-total"><span>Net payable</span><span>${money(Math.round(p.net))}</span></div>
      </div>
      <p class="muted" style="font-size:.8rem;margin-top:1rem">Generated ${d.toLocaleString()} · figures from attendance &amp; leave records.</p>
    </div>`;
}
