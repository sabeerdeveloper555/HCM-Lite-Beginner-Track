/* =====================================================================
   settings.js — Admin manages company name, office start time, grace
   minutes, leave quota, half-day hours, working days.
   ===================================================================== */

function validateSettings(data) {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Company name is required.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime))
    errors.startTime = 'Use HH:MM (24h).';
  if (!(Number(data.graceMinutes) >= 0))
    errors.graceMinutes = 'Grace must be 0 or more.';
  if (!(Number(data.leaveQuota) >= 0))
    errors.leaveQuota = 'Quota must be 0 or more.';
  if (!(Number(data.halfDayHours) > 0))
    errors.halfDayHours = 'Half-day hours must be greater than 0.';
  if (!data.workingDays.length)
    errors.workingDays = 'Pick at least one working day.';
  return errors;
}

function saveSettings(data) {
  const company = getCompany() || defaultCompany(data.name);
  company.name = data.name.trim();
  company.startTime = data.startTime;
  company.graceMinutes = Number(data.graceMinutes);
  company.leaveQuota = Number(data.leaveQuota);
  company.halfDayHours = Number(data.halfDayHours);
  company.workingDays = data.workingDays.sort((a, b) => a - b);
  saveCompany(company);
  return company;
}

const DAY_LABELS = [
  { i: 0, l: 'Sun' },
  { i: 1, l: 'Mon' },
  { i: 2, l: 'Tue' },
  { i: 3, l: 'Wed' },
  { i: 4, l: 'Thu' },
  { i: 5, l: 'Fri' },
  { i: 6, l: 'Sat' },
];

/* wire the settings form for the current company */
function initSettingsForm() {
  const company = getCompany();
  const f = document.getElementById('settingsForm');
  if (!f || !company) return;

  f.company.value = company.name;
  f.start.value = company.startTime;
  f.grace.value = company.graceMinutes;
  f.quota.value = company.leaveQuota;
  f.half.value = company.halfDayHours;
  document.getElementById('workDays').innerHTML = DAY_LABELS.map(
    (d) =>
      `<label class="chk"><input type="checkbox" value="${d.i}" ${company.workingDays.includes(d.i) ? 'checked' : ''}> ${d.l}</label>`,
  ).join('');

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: f.company.value,
      startTime: f.start.value,
      graceMinutes: f.grace.value,
      leaveQuota: f.quota.value,
      halfDayHours: f.half.value,
      workingDays: [...f.querySelectorAll('#workDays input:checked')].map((i) =>
        Number(i.value),
      ),
    };
    const errors = validateSettings(data);
    [
      'name',
      'startTime',
      'graceMinutes',
      'leaveQuota',
      'halfDayHours',
      'workingDays',
    ].forEach((k) => {
      const fe = f.querySelector(`.field-error[data-for="${k}"]`);
      if (fe) fe.textContent = errors[k] || '';
    });
    if (Object.keys(errors).length) return;
    saveSettings(data);
    toast('Settings saved.');
    document.getElementById('settingSummary').textContent = summaryText();
  });
}

function summaryText() {
  const c = getCompany();
  if (!c) return '';
  const days = c.workingDays
    .map((i) => DAY_LABELS.find((d) => d.i === i).l)
    .join(', ');
  return `Office starts at ${c.startTime} with ${c.graceMinutes} min grace. Half day under ${c.halfDayHours} hrs. Leave quota ${c.leaveQuota} days/yr. Working days: ${days}.`;
}
