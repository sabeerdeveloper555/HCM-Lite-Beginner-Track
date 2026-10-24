# HCM Lite — Saylani Hackathon (Beginner Track)

A small **Human Capital Management** web app for **Admin** and **Employee** roles,
built with **only HTML, CSS and JavaScript**. There is **no framework and no
backend** — all data is stored in the browser using `localStorage`. The app
starts empty; the Admin sets up the company and adds employees, and every number
on the dashboards and payslips comes from what people actually do in the app.

---

## Tools

- HTML5, CSS3, Vanilla JavaScript
- `localStorage` for persistence
- Optional: Chart.js / camera check-in (bonus ideas below)

## Run it locally

No build step. Open `index.html` in a browser, or serve the folder:

```bash
# using Python
python -m http.server 8123
# then open http://localhost:8123/index.html
```

> `localStorage` is tied to one browser/origin. To host it, push to GitHub Pages,
> Netlify or Vercel (all free).

---

## How to use (quick start)

1. **First run** → `index.html` shows a **Company setup** form. Enter the company
   name and the Admin's name/email/password. This creates the company settings
   and the Admin account, and logs you in.
2. **Admin dashboard** → add employees (**Employees → + Add employee**). Adding an
   employee also creates that employee's login (email + password).
3. **Settings** → tune business rules: office start time, grace minutes, half-day
   threshold, yearly leave quota and working days.
4. **Employee login** → self-service dashboard: **check in / check out**, view your
   attendance, **apply for leave**, and see your personal stats.
5. **Leaves (Admin)** → approve or reject requests with a comment. Balances update.
6. **Payslips** → Admin can view any employee's monthly payslip; employees see
   their own. Use **Print / Save PDF**.
7. **Smart helper** → ask questions on either dashboard; answers come from real data.

## The two roles

| Area                               | Admin          | Employee |
| ---------------------------------- | -------------- | -------- |
| First-run setup, company settings  | Manage         | —        |
| Add / edit / delete employees      | Manage         | —        |
| Employee list with search & filter | All            | —        |
| Check in / check out               | —              | Own      |
| Attendance records                 | All            | Own      |
| Apply for leave                    | —              | Own      |
| Approve / reject leave             | Manage         | —        |
| Dashboard                          | Company totals | Personal |
| Payslip                            | All            | Own      |
| Smart helper                       | All data       | Own data |
| Announcements                      | Post           | Read     |

Every page checks who is logged in; an Employee opening an Admin page is sent
back to their own dashboard.

---

## Business rules

**Attendance** — Late if check-in is after `start + grace`. One check-in per day;
check-out only after check-in. Worked hours = out − in; under the half-day
threshold = **half day**. A working day with no record = **absent**.

**Leave** — From must be on/before To. Only **working days** are counted (weekends
skipped). Requests cannot overlap another leave and cannot exceed the yearly
quota.

**Payslip** — `per-day = salary ÷ working days in month`;
`deduction = per-day × (absent days + 0.5 × half days)`;
`net = salary − deduction`. Approved paid-leave days are not deducted.

**Forms** — required fields, valid email, email not already used, salary > 0,
errors shown next to each field.

---

## Data model (localStorage keys)

| Key                 | Stores                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| `hcm_company`       | name + settings (start time, grace, quota, half-day hours, working days) |
| `hcm_users`         | admin & employees: id, name, email, password, role, department, salary   |
| `hcm_attendance`    | one entry per employee per day: date, check-in, check-out, status        |
| `hcm_leaves`        | requests: employee id, type, from, to, days, reason, status, comment     |
| `hcm_announcements` | posted notices: text, author, timestamp                                  |
| `hcm_session`       | who is logged in right now                                               |

---

## Project structure

```
index.html            Login + first-run setup
pages/
  admin.html          Admin dashboard (totals, today, pending leaves, helper, announcements)
  employees.html      Manage employees (add/edit/delete, search, filter, CSV export)
  leaves.html         Approve / reject leave requests
  payslip.html        Monthly payslip (print / save PDF)
  settings.html       Company settings & business rules
  employee.html       Employee dashboard (check-in/out, apply leave, helper)
css/
  style.css           Responsive layout, light/dark theme, print styles
js/
  storage.js          All localStorage helpers + business-rule functions
  auth.js             Setup, login/logout, change password, page guard, nav
  employees.js        Employee CRUD + search/filter + table rendering
  attendance.js       Check-in/out + attendance rules + CSV export
  leave.js            Apply / approve / reject + balance + rendering
  payslip.js          Payslip calculation + printable slip
  helper.js           Keyword-based smart chat (answers from real data)
  announcements.js    Post / read announcements
  settings.js         Company settings form
```

---

## Smart helper

The chat matches keywords in the question and replies with **real numbers** from
the app's data. Admins get company-wide answers; employees only ever get their
own data. Examples: _“How many employees do we have?”_, _“Who is on leave
today?”_, _“How many leaves do I have left?”_, _“How many hours did I work this
week?”_, _“What is my payslip?”_.

## Bonus ideas (already included)

- 📊 **Charts with Chart.js** — attendance by department, today's status doughnut,
  14-day check-in trend (admin) and weekly worked-hours (employee)
- 🌙 Dark mode toggle (charts re-render to match the theme)
- 📄 Printable payslip (Save as PDF via browser print)
- 📤 Export attendance to CSV
- 📢 Announcements (admin posts, employees read)

Ideas you can add next: camera/face check-in
(`getUserMedia` + `face-api.js`), geofenced check-in, and an LLM-backed helper.

---

Built for the Saylani Hackathon — Beginner Track. Best of luck!
