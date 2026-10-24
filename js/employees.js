/* =====================================================================
   employees.js — add (creates login), edit, delete, search, filter.
   Admin only. Used by pages/employees.html
   ===================================================================== */

/* validate an employee form. editingId set when updating (skip own email). */
function validateEmployee(data, editingId) {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Name is required.';
  if (!validEmail(data.email)) errors.email = 'Valid email is required.';
  else {
    const existing = findUserByEmail(data.email);
    if (existing && existing.id !== editingId)
      errors.email = 'Email already in use.';
  }
  if (!data.department.trim()) errors.department = 'Department is required.';
  if (!(Number(data.salary) > 0))
    errors.salary = 'Salary must be greater than 0.';
  if (!editingId && (!data.password || data.password.length < 4))
    errors.password = 'Password must be at least 4 characters.';
  return errors;
}

/* returns the created/updated user */
function saveEmployee(data, editingId) {
  if (editingId) {
    return updateUser(editingId, {
      name: data.name.trim(),
      email: data.email.trim(),
      department: data.department.trim(),
      salary: Number(data.salary),
      ...(data.password ? { password: data.password } : {}),
    });
  }
  return addUser({
    name: data.name.trim(),
    email: data.email.trim(),
    password: data.password,
    role: 'employee',
    department: data.department.trim(),
    salary: Number(data.salary),
  });
}

function departmentList() {
  const set = new Set(
    getUsers()
      .map((u) => u.department)
      .filter(Boolean),
  );
  return [...set].sort();
}

/* filter + search over employees */
function queryEmployees(search, dept) {
  const q = (search || '').trim().toLowerCase();
  return getEmployees().filter((e) => {
    const matchQ =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q);
    const matchD = !dept || e.department === dept;
    return matchQ && matchD;
  });
}

/* render the employees table into a container element */
function renderEmployeeTable(rows) {
  const body = document.getElementById('empRows');
  const count = document.getElementById('empCount');
  if (count)
    count.textContent =
      rows.length + (rows.length === 1 ? ' employee' : ' employees');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="empty">No employees found.</td></tr>`;
    return;
  }
  body.innerHTML = rows
    .map(
      (e) => `<tr>
        <td><strong>${escapeHtml(e.name)}</strong><br><small>${escapeHtml(e.email)}</small></td>
        <td>${escapeHtml(e.department)}</td>
        <td>${money(e.salary)}</td>
        <td>${escapeHtml(attendanceSummary(e.id))}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-edit="${e.id}">Edit</button>
          <button class="btn btn-red btn-sm" data-del="${e.id}">Delete</button>
        </td>
      </tr>`,
    )
    .join('');

  body
    .querySelectorAll('[data-edit]')
    .forEach(
      (b) => (b.onclick = () => openEmployeeForm(Number(b.dataset.edit))),
    );
  body.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () => {
        const emp = getUserById(Number(b.dataset.del));
        if (
          confirm(
            `Delete ${emp.name}? Their attendance and leaves will be removed.`,
          )
        ) {
          deleteUser(emp.id);
          toast('Employee deleted.');
          refreshEmployeeView();
        }
      }),
  );
}

function attendanceSummary(employeeId) {
  const recs = attendanceFor(employeeId);
  if (!recs.length) return 'No attendance yet';
  const late = recs.filter((r) => r.status === 'late').length;
  return `${recs.length} days · ${late} late`;
}

/* ---------- form modal ---------- */
let editingEmployeeId = null;

function openEmployeeForm(id) {
  editingEmployeeId = id || null;
  const emp = id ? getUserById(id) : null;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal">
      <h3>${emp ? 'Edit employee' : 'Add employee'}</h3>
      <form id="empForm" novalidate>
        <label>Full name *<input id="e_name" value="${emp ? escapeHtml(emp.name) : ''}"><span class="field-error" data-for="name"></span></label>
        <label>Email *<input id="e_email" type="email" value="${emp ? escapeHtml(emp.email) : ''}"><span class="field-error" data-for="email"></span></label>
        <label>Department *<input id="e_dept" list="deptList" value="${emp ? escapeHtml(emp.department) : ''}"><span class="field-error" data-for="department"></span></label>
        <datalist id="deptList">${departmentList()
          .map((d) => `<option value="${escapeHtml(d)}">`)
          .join('')}</datalist>
        <label>Monthly salary *<input id="e_sal" type="number" min="1" value="${emp ? emp.salary : ''}"><span class="field-error" data-for="salary"></span></label>
        <label>${emp ? 'New password (optional)' : 'Login password *'}<input id="e_pw" type="password" placeholder="${emp ? 'leave blank to keep' : 'min 4 characters'}"><span class="field-error" data-for="password"></span></label>
        <p class="muted" style="font-size:.82rem">Adding an employee also creates their login.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="emp_cancel">Cancel</button>
          <button type="submit" class="btn">${emp ? 'Save changes' : 'Create employee'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('#emp_cancel').onclick = () => wrap.remove();
  wrap.addEventListener('click', (ev) => {
    if (ev.target === wrap) wrap.remove();
  });

  wrap.querySelector('#empForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const data = {
      name: wrap.querySelector('#e_name').value,
      email: wrap.querySelector('#e_email').value,
      department: wrap.querySelector('#e_dept').value,
      salary: wrap.querySelector('#e_sal').value,
      password: wrap.querySelector('#e_pw').value,
    };
    const errors = validateEmployee(data, editingEmployeeId);
    ['name', 'email', 'department', 'salary', 'password'].forEach((k) => {
      const fe = wrap.querySelector(`.field-error[data-for="${k}"]`);
      if (fe) fe.textContent = errors[k] || '';
    });
    if (Object.keys(errors).length) return;
    saveEmployee(data, editingEmployeeId);
    wrap.remove();
    toast(
      editingEmployeeId
        ? 'Employee updated.'
        : 'Employee added & login created.',
    );
    refreshEmployeeView();
  });
}

function refreshEmployeeView() {
  const search = (document.getElementById('empSearch') || {}).value || '';
  const dept = (document.getElementById('deptFilter') || {}).value || '';
  const rows = queryEmployees(search, dept);
  const dl = document.getElementById('deptFilter');
  if (dl) {
    dl.innerHTML =
      `<option value="">All departments</option>` +
      departmentList()
        .map(
          (d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`,
        )
        .join('');
    dl.value = dept;
  }
  renderEmployeeTable(rows);
}
