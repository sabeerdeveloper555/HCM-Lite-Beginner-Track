/* =====================================================================
   leave.js — apply, validate, approve/reject, balance, rendering.
   Rules: from <= to; count working days only; no overlap; no over quota.
   ===================================================================== */

const LEAVE_TYPES = ['Casual', 'Sick', 'Annual', 'Unpaid'];

function leaveBalance(employeeId) {
  const company = getCompany();
  const quota = Number(company.leaveQuota || 0);
  const used = leavesUsed(employeeId, new Date().getFullYear());
  return { quota, used, left: Math.max(0, quota - used) };
}

/* validate a new leave request -> { ok, days, error } */
function validateLeave(employeeId, type, from, to, reason) {
  const company = getCompany();
  if (!from || !to)
    return { ok: false, error: 'From and To dates are required.' };
  if (from > to)
    return { ok: false, error: 'From date must be on or before To date.' };
  if (!type) return { ok: false, error: 'Leave type is required.' };

  const days = countWorkingDays(from, to, company);
  if (days === 0)
    return { ok: false, error: 'Selected range has no working days.' };

  if (overlapsLeave(employeeId, from, to))
    return { ok: false, error: 'This range overlaps another leave request.' };

  if (type !== 'Unpaid') {
    const bal = leaveBalance(employeeId);
    if (days > bal.left)
      return {
        ok: false,
        error: `Only ${bal.left} leave day(s) left in your yearly quota.`,
      };
  }
  return { ok: true, days };
}

function applyLeave(employeeId, type, from, to, reason) {
  const v = validateLeave(employeeId, type, from, to, reason);
  if (!v.ok) return v;
  const rows = getLeaves();
  const leave = {
    id: Date.now(),
    employeeId,
    type,
    from,
    to,
    days: v.days,
    reason: (reason || '').trim(),
    status: 'pending',
    comment: '',
  };
  rows.push(leave);
  saveLeaves(rows);
  return {
    ok: true,
    leave,
    message: `Applied for ${v.days} working day(s) of ${type} leave.`,
  };
}

function decideLeave(leaveId, decision, comment) {
  const rows = getLeaves();
  const i = rows.findIndex((l) => l.id === leaveId);
  if (i === -1) return { ok: false, error: 'Leave not found.' };
  rows[i].status = decision; // approved | rejected
  rows[i].comment = (comment || '').trim();
  saveLeaves(rows);
  return { ok: true, message: `Leave ${decision}.` };
}

function leaveRowHTML(l, showName) {
  const emp = getUserById(l.employeeId);
  return `<tr>
    ${showName ? `<td>${escapeHtml(emp ? emp.name : '—')}</td>` : ''}
    <td>${escapeHtml(l.type)}</td>
    <td>${escapeHtml(l.from)} → ${escapeHtml(l.to)}</td>
    <td>${l.days}</td>
    <td>${escapeHtml(l.reason || '—')}</td>
    <td>${pill(l.status)}</td>
    ${showName ? `<td class="muted">${escapeHtml(l.comment || '—')}</td>` : ''}
  </tr>`;
}

function renderLeavesTable(containerId, leaves, showName, withActions) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const colspan =
    (showName ? 3 : 2) + 3 + (showName ? 1 : 0) + (withActions ? 1 : 0);
  if (!leaves.length) {
    el.innerHTML = `<tr><td colspan="${colspan}" class="empty">No leave requests.</td></tr>`;
    return;
  }
  el.innerHTML = leaves
    .map((l) => {
      const emp = getUserById(l.employeeId);
      const actions = withActions
        ? l.status === 'pending'
          ? `<td>
              <button class="btn btn-green btn-sm" data-ok="${l.id}">Approve</button>
              <button class="btn btn-red btn-sm" data-no="${l.id}">Reject</button>
            </td>`
          : `<td><small class="muted">Decided</small></td>`
        : '';
      return `<tr>
        ${showName ? `<td><strong>${escapeHtml(emp ? emp.name : '—')}</strong><br><small>${escapeHtml(emp ? emp.department : '')}</small></td>` : ''}
        <td>${escapeHtml(l.type)}</td>
        <td>${escapeHtml(l.from)} → ${escapeHtml(l.to)}</td>
        <td>${l.days}</td>
        <td>${escapeHtml(l.reason || '—')}</td>
        <td>${pill(l.status)}${l.comment && showName ? `<br><small class="muted">${escapeHtml(l.comment)}</small>` : ''}</td>
        ${actions}
      </tr>`;
    })
    .join('');

  if (withActions) {
    el.querySelectorAll('[data-ok]').forEach(
      (b) =>
        (b.onclick = () => promptDecision(Number(b.dataset.ok), 'approved')),
    );
    el.querySelectorAll('[data-no]').forEach(
      (b) =>
        (b.onclick = () => promptDecision(Number(b.dataset.no), 'rejected')),
    );
  }
}

function promptDecision(leaveId, decision) {
  const comment = prompt(`Comment for "${decision}" (optional):`, '');
  if (comment === null) return; // cancelled
  const res = decideLeave(leaveId, decision, comment);
  toast(res.message);
  if (typeof refreshLeaveView === 'function') refreshLeaveView();
  if (typeof refreshAdminDashboard === 'function') refreshAdminDashboard();
}
