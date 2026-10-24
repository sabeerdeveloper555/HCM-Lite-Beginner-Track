/* =====================================================================
   announcements.js — Admin posts, everyone reads.
   ===================================================================== */

function renderAnnouncements(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const rows = getAnnouncements();
  if (!rows.length) {
    el.innerHTML = `<p class="muted">No announcements yet.</p>`;
    return;
  }
  el.innerHTML = rows
    .map(
      (a) => `<div class="ann">
        <div>${escapeHtml(a.text)}</div>
        <small class="muted">${escapeHtml(a.author)} · ${new Date(a.createdAt).toLocaleString()}</small>
        <button class="del" data-del="${a.id}" title="Delete">×</button>
      </div>`,
    )
    .join('');
  el.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () => {
        saveAnnouncements(
          getAnnouncements().filter((a) => a.id !== Number(b.dataset.del)),
        );
        renderAnnouncements(containerId);
      }),
  );
}

function initAnnouncementPost(containerId, listId, user) {
  const box = document.getElementById(containerId);
  if (!box || user.role !== 'admin') return;
  box.innerHTML = `<form id="annForm"><textarea id="annText" rows="2" placeholder="Write an announcement for all employees…"></textarea>
    <button class="btn btn-sm" type="submit">Post announcement</button></form>`;
  box.querySelector('#annForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('annText').value.trim();
    if (!text) return;
    addAnnouncement(text, user.name);
    document.getElementById('annText').value = '';
    renderAnnouncements(listId);
    toast('Announcement posted.');
  });
}
