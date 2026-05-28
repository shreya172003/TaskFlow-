// ── State ──────────────────────────────────────────────
let tasks = JSON.parse(localStorage.getItem('tf_tasks') || '[]');
let currentCategory = 'all';
let currentStatus   = 'all';
let specialFilter   = null;
let editingId       = null;
let dragSrcIndex    = null;

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setDateLabels();
    renderAll();

    // Close modal on Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('open')) {
            e.preventDefault();
            saveTask();
        }
    });

    // Show/hide search clear button
    document.getElementById('searchInput').addEventListener('input', function () {
        document.getElementById('searchClear').classList.toggle('visible', this.value.length > 0);
    });
});

function setDateLabels() {
    const now = new Date();
    const opts = { weekday: 'short', month: 'short', day: 'numeric' };
    const str  = now.toLocaleDateString('en-US', opts);
    document.getElementById('sidebarDate').textContent = str;
}

// ── Save ───────────────────────────────────────────────
function save() {
    localStorage.setItem('tf_tasks', JSON.stringify(tasks));
}

// ── Render All ─────────────────────────────────────────
function renderAll() {
    renderTasks();
    renderStats();
    renderSidebarBadges();
}

// ── Render Tasks ───────────────────────────────────────
function renderTasks() {
    const list    = document.getElementById('taskList');
    const empty   = document.getElementById('emptyState');
    const search  = document.getElementById('searchInput').value.trim().toLowerCase();
    const sort    = document.getElementById('sortSelect').value;
    const today   = todayStr();

    let filtered = tasks.filter(t => {
        if (currentCategory !== 'all' && t.category !== currentCategory) return false;
        if (currentStatus === 'active'    && t.done)  return false;
        if (currentStatus === 'completed' && !t.done) return false;
        if (specialFilter === 'today'   && t.due !== today) return false;
        if (specialFilter === 'overdue' && (!t.due || t.due >= today || t.done)) return false;
        if (specialFilter === 'high'    && t.priority !== 'high') return false;
        if (search && !t.title.toLowerCase().includes(search) && !(t.notes||'').toLowerCase().includes(search)) return false;
        return true;
    });

    // Sort
    const pOrder = { high: 0, medium: 1, low: 2 };
    filtered.sort((a, b) => {
        if (sort === 'priority') return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
        if (sort === 'due') {
            if (!a.due && !b.due) return 0;
            if (!a.due) return 1;
            if (!b.due) return -1;
            return a.due.localeCompare(b.due);
        }
        if (sort === 'name') return a.title.localeCompare(b.title);
        return b.createdAt - a.createdAt; // default: newest first
    });

    list.innerHTML = '';

    if (filtered.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        filtered.forEach((t, i) => list.appendChild(buildTaskEl(t, i)));
    }

    // Page count
    document.getElementById('pageCount').textContent =
        `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`;
}

function buildTaskEl(t, i) {
    const today = todayStr();
    const isOverdue = t.due && t.due < today && !t.done;
    const isToday   = t.due === today && !t.done;

    const el = document.createElement('div');
    el.className = `task-item p-${t.priority}${t.done ? ' done' : ''}`;
    el.dataset.id = t.id;
    el.draggable = true;

    el.innerHTML = `
        <span class="drag-handle"><span class="material-symbols-rounded">drag_indicator</span></span>
        <button class="check-btn" onclick="toggleDone('${t.id}')">
            <span class="material-symbols-rounded">check</span>
        </button>
        <div class="task-body">
            <div class="task-title" ondblclick="openEditModal('${t.id}')" title="Double-click to edit">${escHtml(t.title)}</div>
            ${t.notes ? `<div class="task-notes">${escHtml(t.notes)}</div>` : ''}
            <div class="task-meta">
                <span class="chip">${t.category}</span>
                <span class="priority priority-${t.priority}">${t.priority}</span>
                ${t.due ? `<span class="due-label ${isOverdue ? 'overdue' : isToday ? 'today' : ''}">
                    <span class="material-symbols-rounded">calendar_today</span>
                    ${isOverdue ? 'Overdue · ' : isToday ? 'Today · ' : ''}${formatDate(t.due)}
                </span>` : ''}
            </div>
        </div>
        <div class="task-actions">
            <button class="act-btn edit" onclick="openEditModal('${t.id}')" title="Edit">
                <span class="material-symbols-rounded">edit</span>
            </button>
            <button class="act-btn del" onclick="deleteTask('${t.id}')" title="Delete">
                <span class="material-symbols-rounded">delete</span>
            </button>
        </div>
    `;

    // Drag events
    el.addEventListener('dragstart', () => { dragSrcIndex = tasks.findIndex(x => x.id === t.id); el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => el.classList.remove('dragging'));
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const destIndex = tasks.findIndex(x => x.id === t.id);
        if (dragSrcIndex !== null && dragSrcIndex !== destIndex) {
            const [moved] = tasks.splice(dragSrcIndex, 1);
            tasks.splice(destIndex, 0, moved);
            save();
            renderAll();
        }
    });

    return el;
}

// ── Stats ──────────────────────────────────────────────
function renderStats() {
    const today = todayStr();
    const total   = tasks.length;
    const done    = tasks.filter(t => t.done).length;
    const pending = total - done;
    const overdue = tasks.filter(t => t.due && t.due < today && !t.done).length;
    const pct     = total ? Math.round((done / total) * 100) : 0;

    document.getElementById('statTotal').textContent   = total;
    document.getElementById('statDone').textContent    = done;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statOverdue').textContent = overdue;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressPct').textContent  = pct + '%';
    document.getElementById('progressLabel').textContent =
        `${done} of ${total} task${total !== 1 ? 's' : ''} completed`;
}

// ── Sidebar Badges ─────────────────────────────────────
function renderSidebarBadges() {
    const cats = ['personal','work','shopping','health','other'];
    document.getElementById('cat-badge-all').textContent = tasks.length;
    cats.forEach(c => {
        const el = document.getElementById(`cat-badge-${c}`);
        if (el) el.textContent = tasks.filter(t => t.category === c).length;
    });
}

// ── Filters ────────────────────────────────────────────
function setCategory(cat, btn) {
    currentCategory = cat;
    specialFilter   = null;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const titles = { all:'All Tasks', personal:'Personal', work:'Work', shopping:'Shopping', health:'Health', other:'Other' };
    document.getElementById('pageTitle').textContent = titles[cat] || cat;
    renderTasks();
}

function setSpecialFilter(type, btn) {
    specialFilter   = type;
    currentCategory = 'all';
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const titles = { today:'Due Today', overdue:'Overdue', high:'High Priority' };
    document.getElementById('pageTitle').textContent = titles[type];
    renderTasks();
}

function setStatus(status, btn) {
    currentStatus = status;
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTasks();
}

// ── Search ─────────────────────────────────────────────
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClear').classList.remove('visible');
    renderTasks();
}

// ── Modal ──────────────────────────────────────────────
function openModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent     = 'New Task';
    document.getElementById('modalSaveLabel').textContent = 'Add Task';
    document.getElementById('modalTaskInput').value = '';
    document.getElementById('modalNotes').value     = '';
    document.getElementById('modalCategory').value  = 'personal';
    document.getElementById('modalPriority').value  = 'medium';
    document.getElementById('modalDueDate').value   = '';
    document.getElementById('modalOverlay').classList.add('open');
    setTimeout(() => document.getElementById('modalTaskInput').focus(), 100);
}

function openEditModal(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    editingId = id;
    document.getElementById('modalTitle').textContent     = 'Edit Task';
    document.getElementById('modalSaveLabel').textContent = 'Save Changes';
    document.getElementById('modalTaskInput').value = t.title;
    document.getElementById('modalNotes').value     = t.notes || '';
    document.getElementById('modalCategory').value  = t.category;
    document.getElementById('modalPriority').value  = t.priority;
    document.getElementById('modalDueDate').value   = t.due || '';
    document.getElementById('modalOverlay').classList.add('open');
    setTimeout(() => document.getElementById('modalTaskInput').focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function saveTask() {
    const title = document.getElementById('modalTaskInput').value.trim();
    if (!title) {
        document.getElementById('modalTaskInput').focus();
        document.getElementById('modalTaskInput').style.borderColor = 'var(--red)';
        setTimeout(() => document.getElementById('modalTaskInput').style.borderColor = '', 1200);
        return;
    }

    if (editingId) {
        const t = tasks.find(x => x.id === editingId);
        if (t) {
            t.title    = title;
            t.notes    = document.getElementById('modalNotes').value.trim();
            t.category = document.getElementById('modalCategory').value;
            t.priority = document.getElementById('modalPriority').value;
            t.due      = document.getElementById('modalDueDate').value || null;
        }
        showToast('Task updated ✓');
    } else {
        tasks.unshift({
            id:        crypto.randomUUID(),
            title,
            notes:     document.getElementById('modalNotes').value.trim(),
            category:  document.getElementById('modalCategory').value,
            priority:  document.getElementById('modalPriority').value,
            due:       document.getElementById('modalDueDate').value || null,
            done:      false,
            createdAt: Date.now()
        });
        showToast('Task added ✓');
    }

    save();
    closeModal();
    renderAll();
}

// ── Task Actions ───────────────────────────────────────
function toggleDone(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    save();
    renderAll();
    showToast(t.done ? 'Marked as complete ✓' : 'Marked as active');
}

function deleteTask(id) {
    tasks = tasks.filter(x => x.id !== id);
    save();
    renderAll();
    showToast('Task deleted');
}

function clearCompleted() {
    const count = tasks.filter(t => t.done).length;
    if (!count) return;
    tasks = tasks.filter(t => !t.done);
    save();
    renderAll();
    showToast(`${count} completed task${count > 1 ? 's' : ''} cleared`);
}

// ── Theme ──────────────────────────────────────────────
function toggleTheme() {
    const html  = document.documentElement;
    const isDark = html.dataset.theme === 'dark';
    html.dataset.theme = isDark ? 'light' : 'dark';
    document.getElementById('themeIcon').textContent = isDark ? 'dark_mode' : 'light_mode';
    localStorage.setItem('tf_theme', html.dataset.theme);
}

// Apply saved theme on load
(function () {
    const saved = localStorage.getItem('tf_theme');
    if (saved) {
        document.documentElement.dataset.theme = saved;
        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('themeIcon').textContent = saved === 'light' ? 'dark_mode' : 'light_mode';
        });
    }
})();

// ── Toast ──────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Helpers ────────────────────────────────────────────
function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(str) {
    if (!str) return '';
    const [y, m, d] = str.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
