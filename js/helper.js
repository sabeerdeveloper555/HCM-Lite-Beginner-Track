/* =====================================================================
   helper.js — keyword-based smart chat that answers from real app data.
   Admin => company-wide answers. Employee => only their own data.
   ===================================================================== */

function helperAnswer(raw, user) {
  const q = (raw || '').toLowerCase().trim();
  const company = getCompany() || {};
  const today = todayStr();
  const isAdmin = user.role === 'admin';
  const emps = getEmployees();

  const has = (...words) => words.some((w) => q.includes(w));

  /* ----- employee count ----- */
  if (
    isAdmin &&
    has(
      'how many employee',
      'number of employee',
      'total employee',
      'employee count',
      'staff count',
    )
  )
    return `We have ${emps.length} employee${emps.length === 1 ? '' : 's'}.`;

  /* ----- on leave today ----- */
  if (has('on leave', 'who is on leave', 'leave today')) {
    if (isAdmin) {
      const names = emps
        .filter((e) =>
          getLeaves().some(
            (l) =>
              l.employeeId === e.id &&
              l.status === 'approved' &&
              l.from <= today &&
              l.to >= today,
          ),
        )
        .map((e) => e.name);
      return names.length
        ? `${names.length} employee(s) on leave today: ${names.join(', ')}.`
        : 'No one is on leave today.';
    }
    const mine = leavesFor(user.id).some(
      (l) => l.status === 'approved' && l.from <= today && l.to >= today,
    );
    return mine
      ? 'Yes — you are on approved leave today.'
      : 'No, you are not on leave today.';
  }

  /* ----- late today ----- */
  if (has('late today', 'who was late', 'who is late')) {
    if (isAdmin) {
      const late = getAttendance()
        .filter((a) => a.date === today && a.status === 'late')
        .map((a) => (getUserById(a.employeeId) || {}).name)
        .filter(Boolean);
      return late.length
        ? `${late.length} late today: ${late.join(', ')}.`
        : 'No one was late today.';
    }
    const rec = todayAttendance(user.id);
    return rec && rec.status === 'late'
      ? 'Yes, you checked in late today.'
      : 'No, you were not late today.';
  }

  /* ----- leave balance / how many leaves left ----- */
  if (
    has(
      'how many leave',
      'leaves do i have',
      'leave left',
      'leave balance',
      'remaining leave',
      'quota',
    )
  ) {
    if (isAdmin) {
      return `The yearly leave quota is ${company.leaveQuota} days per employee.`;
    }
    const b = leaveBalance(user.id);
    return `You have ${b.left} of ${b.quota} paid leave days left this year (${b.used} used).`;
  }

  /* ----- worked hours this week ----- */
  if (
    has(
      'how many hours',
      'hours did i work',
      'work this week',
      'hours this week',
      'worked this week',
    )
  ) {
    const scope = isAdmin ? null : user.id;
    const startWeek = new Date();
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7)); // Monday
    const recs = getAttendance().filter((a) => {
      if (scope && a.employeeId !== scope) return false;
      return a.date >= todayStr(startWeek) && a.date <= today;
    });
    const hrs = recs.reduce(
      (s, a) => s + workedHours(a.checkIn, a.checkOut),
      0,
    );
    return `You worked ${hrs.toFixed(1)} hours this week (${recs.filter((r) => r.checkOut).length} completed days).`;
  }

  /* ----- today's / my attendance ----- */
  if (
    has(
      'my attendance',
      'attendance today',
      'did i check',
      'check in today',
      'my status',
      'how many absent',
      'absent',
    )
  ) {
    if (isAdmin && has('company', 'all', 'everyone', 'total attendance')) {
      const s = todaySnapshot();
      return `Today: ${s.present} present, ${s.late} late, ${s.half} half-day, ${s.onLeaveToday} on leave, ${s.absent} absent.`;
    }
    const rec = todayAttendance(user.id);
    if (has('absent')) {
      const myRecs = attendanceFor(user.id);
      return `You have ${myRecs.length} attendance records.`;
    }
    return rec
      ? `Today you checked in at ${rec.checkIn} (${rec.status})${rec.checkOut ? ', out at ' + rec.checkOut : ', still working'}.`
      : 'You have not checked in today yet.';
  }

  /* ----- pending leave requests (admin) ----- */
  if (isAdmin && has('pending leave', 'leave request', 'approve', 'requests')) {
    const pend = getLeaves().filter((l) => l.status === 'pending');
    if (!pend.length) return 'There are no pending leave requests.';
    return `${pend.length} pending leave request(s): ${pend
      .map(
        (l) =>
          (getUserById(l.employeeId) || {}).name +
          ' (' +
          l.type +
          ', ' +
          l.days +
          'd)',
      )
      .filter(Boolean)
      .join(', ')}.`;
  }

  /* ----- salary / payslip ----- */
  if (has('payslip', 'salary', 'pay', 'net')) {
    if (isAdmin)
      return `Open the Payslips page to view any employee's monthly payslip.`;
    const now = new Date();
    const p = computePayslip(user, now.getFullYear(), now.getMonth());
    return `This month your net payable is ${money(Math.round(p.net))} (gross ${money(p.gross)}, deductions ${money(Math.round(p.deduction))}).`;
  }

  /* ----- announcements / policies ----- */
  if (has('announcement', 'notice', 'policy')) {
    const a = getAnnouncements()[0];
    return a
      ? `Latest announcement: “${a.text}”`
      : 'There are no announcements yet.';
  }

  /* ----- greeting ----- */
  if (has('hi', 'hello', 'hey', 'help'))
    return `Hi ${user.name.split(' ')[0]}! Ask me things like “who is on leave today?”, “how many leaves do I have left?”, or ${
      isAdmin
        ? '“how many employees do we have?”'
        : '“how many hours did I work this week?”'
    }`;

  /* ----- fallback ----- */
  return 'I can answer about employees, attendance, leaves, payslips and announcements. Try rephrasing with words like “leave”, “late”, “hours”, or “payslip”.';
}

/* wire a chat UI: expects #chatLog, #chatInput, #chatSend, optional .chips[data-q] */
function initChat(user) {
  const log = document.getElementById('chatLog');
  const input = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  if (!log || !input || !send) return;

  function push(text, who) {
    const b = document.createElement('div');
    b.className = 'bubble ' + who;
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }
  push(
    `Hi ${user.name.split(' ')[0]}! I'm the HCM assistant. Ask me about attendance, leaves or payslips.`,
    'bot',
  );

  function submit() {
    const q = input.value.trim();
    if (!q) return;
    push(q, 'me');
    input.value = '';
    setTimeout(() => push(helperAnswer(q, user), 'bot'), 220);
  }
  send.onclick = submit;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  document.querySelectorAll('.chip[data-q]').forEach(
    (c) =>
      (c.onclick = () => {
        input.value = c.dataset.q;
        submit();
      }),
  );
}
