/* =====================================================================
   charts.js — Chart.js visuals for the dashboards.
   Palette matches the app theme (emerald / amber / red / purple). No blue.
   Requires Chart.js (CDN) loaded before this file.
   ===================================================================== */

const CHART_COLORS = {
  present: '#12805c',
  late: '#b45309',
  half: '#e0983a',
  leave: '#6d28d9',
  absent: '#b42318',
  neutral: '#9ca3af',
};

/* keep references so we can destroy before re-render */
const _charts = {};
function _mount(id, config) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  if (_charts[id]) _charts[id].destroy();
  _charts[id] = new Chart(el.getContext('2d'), config);
}

function _themeFont() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    family: "'Roboto', system-ui, sans-serif",
    color: dark ? '#c4cbd1' : '#3d434a',
    grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,25,28,0.07)',
    tick: dark ? '#8b949e' : '#6b7280',
  };
}

function _baseScales(t, stacked) {
  return {
    x: {
      stacked: !!stacked,
      grid: { display: false },
      ticks: { color: t.tick },
      border: { display: false },
    },
    y: {
      stacked: !!stacked,
      beginAtZero: true,
      grid: { color: t.grid },
      ticks: { color: t.tick, precision: 0 },
      border: { display: false },
    },
  };
}

/* today's counts for one department */
function _deptCounts(dept) {
  const today = todayStr();
  const emps = getEmployees().filter((e) => e.department === dept);
  let present = 0,
    late = 0,
    half = 0,
    leave = 0;
  emps.forEach((e) => {
    const rec = findAttendance(e.id, today);
    const onLeave = getLeaves().some(
      (l) =>
        l.employeeId === e.id &&
        l.status === 'approved' &&
        l.from <= today &&
        l.to >= today,
    );
    if (onLeave) {
      leave++;
      return;
    }
    if (rec) {
      if (rec.status === 'late') late++;
      else if (rec.status === 'half day') half++;
      else present++;
    }
  });
  const absent = Math.max(0, emps.length - present - late - half - leave);
  return { present, late, half, leave, absent };
}

/* Stacked bar: attendance status by department (today) */
function renderDeptChart(canvasId) {
  const t = _themeFont();
  const depts = [...new Set(getEmployees().map((e) => e.department))]
    .filter(Boolean)
    .sort();
  if (!depts.length) {
    _emptyChart(canvasId, 'Add employees to see the chart');
    return;
  }
  const c = depts.map(_deptCounts);
  const mk = (label, key, color) => ({
    label,
    data: c.map((x) => x[key]),
    backgroundColor: color,
    borderRadius: 5,
    stack: 's',
    maxBarThickness: 46,
  });
  _mount(canvasId, {
    type: 'bar',
    data: {
      labels: depts,
      datasets: [
        mk('Present', 'present', CHART_COLORS.present),
        mk('Late', 'late', CHART_COLORS.late),
        mk('Half day', 'half', CHART_COLORS.half),
        mk('On leave', 'leave', CHART_COLORS.leave),
        mk('Absent', 'absent', CHART_COLORS.absent),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: t.color,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 14,
            font: { family: t.family },
          },
        },
        tooltip: {
          backgroundColor: t.color === '#c4cbd1' ? '#1e242a' : '#16191c',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: _baseScales(t, true),
    },
  });
}

/* Doughnut: today's status distribution across the company */
function renderStatusDoughnut(canvasId) {
  const t = _themeFont();
  const emps = getEmployees();
  if (!emps.length) {
    _emptyChart(canvasId, 'No employees yet');
    return;
  }
  const today = todayStr();
  let present = 0,
    late = 0,
    half = 0,
    leave = 0;
  emps.forEach((e) => {
    const rec = findAttendance(e.id, today);
    const onLeave = getLeaves().some(
      (l) =>
        l.employeeId === e.id &&
        l.status === 'approved' &&
        l.from <= today &&
        l.to >= today,
    );
    if (onLeave) {
      leave++;
      return;
    }
    if (rec) {
      if (rec.status === 'late') late++;
      else if (rec.status === 'half day') half++;
      else present++;
    }
  });
  const absent = Math.max(0, emps.length - present - late - half - leave);
  _mount(canvasId, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Late', 'Half day', 'On leave', 'Absent'],
      datasets: [
        {
          data: [present, late, half, leave, absent],
          backgroundColor: [
            CHART_COLORS.present,
            CHART_COLORS.late,
            CHART_COLORS.half,
            CHART_COLORS.leave,
            CHART_COLORS.absent,
          ],
          borderColor: 'transparent',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: t.color,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 12,
            font: { family: t.family },
          },
        },
      },
    },
  });
}

/* Bar: an employee's worked hours over the last 7 days */
function renderWeeklyHours(canvasId, employeeId) {
  const t = _themeFont();
  const labels = [],
    hours = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = todayStr(d);
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    const rec = findAttendance(employeeId, iso);
    hours.push(
      rec && rec.checkOut
        ? Number(workedHours(rec.checkIn, rec.checkOut).toFixed(1))
        : 0,
    );
  }
  _mount(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Hours worked',
          data: hours,
          backgroundColor: CHART_COLORS.present,
          borderRadius: 6,
          maxBarThickness: 34,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: _baseScales(t, false),
    },
  });
}

/* Line: company present-count trend over the last 14 days */
function renderTrend(canvasId) {
  const t = _themeFont();
  const labels = [],
    data = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = todayStr(d);
    labels.push(
      d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    );
    data.push(
      getAttendance().filter((a) => a.date === iso && a.status !== 'absent')
        .length,
    );
  }
  _mount(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Check-ins',
          data,
          borderColor: CHART_COLORS.present,
          backgroundColor: 'rgba(18,128,92,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: CHART_COLORS.present,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: _baseScales(t, false),
    },
  });
}

/* placeholder when there's no data */
function _emptyChart(canvasId, msg) {
  const t = _themeFont();
  if (_charts[canvasId]) _charts[canvasId].destroy();
  const el = document.getElementById(canvasId);
  if (!el) return;
  _charts[canvasId] = new Chart(el.getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      title: {
        display: true,
        text: msg,
        color: t.tick,
        font: { family: t.family, size: 13, weight: '500' },
      },
    },
  });
}
