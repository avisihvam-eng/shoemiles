/*  ───────────────────────────────────────
    Shoe Mileage Tracker — Application Logic
    ─────────────────────────────────────── */

/* ════ State ════ */
let shoes = [];
let allRuns = [];
let currentFilter = 'all';
let openCardId = null;
let deferredInstallPrompt = null;

/* ════ DOM Refs ════ */
const $ = id => document.getElementById(id);
const shoeListEl = $('shoeList');
const historyListEl = $('historyList');
const toastEl = $('toast');

/* ════ Initialization ════ */
document.addEventListener('DOMContentLoaded', async () => {
    await refresh();
    initNav();
    initModals();
    initFilters();
    initSettings();
    initInstall();
    registerSW();
    initAutoBackupUI();

    // Auto-select target KM input on focus so default value is easy to replace
    $('shoeTarget').addEventListener('focus', function () { this.select(); });
});

async function refresh() {
    shoes = await getShoes();
    allRuns = await getAllRuns();
    renderStats();
    renderShoeList();
    renderHistory();
}

/* ════ Service Worker ════ */
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => { });
    }
}

/* ════ Navigation ════ */
function initNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            $(viewId).classList.add('active');
            btn.classList.add('active');

            // Update header actions visibility
            const isSettings = viewId === 'viewSettings';
            $('btnAddShoe').style.display = isSettings ? 'none' : '';
            $('btnSettings').style.display = isSettings ? 'none' : '';
        });
    });

    $('btnSettings').addEventListener('click', () => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        $('viewSettings').classList.add('active');
        document.querySelector('[data-view="viewSettings"]').classList.add('active');
    });
}

/* ════ Stats ════ */
function renderStats() {
    const totalKm = allRuns.reduce((s, r) => s + r.distance, 0);
    const totalRuns = allRuns.length;
    const avgRun = totalRuns ? (totalKm / totalRuns) : 0;

    $('statTotalKm').textContent = totalKm.toFixed(1);
    $('statTotalRuns').textContent = totalRuns;
    $('statAvgRun').textContent = avgRun.toFixed(1);
}

/* ════ Shoe List ════ */
function renderShoeList() {
    if (shoes.length === 0) {
        shoeListEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">👟</div>
        <h3>No shoes yet</h3>
        <p>Tap the ＋ button to add your first pair and start tracking mileage.</p>
      </div>`;
        return;
    }

    shoeListEl.innerHTML = shoes.map(shoe => {
        const shoeRuns = allRuns.filter(r => r.shoeId === shoe.id).sort((a, b) => b.date.localeCompare(a.date));
        const totalKm = shoeRuns.reduce((s, r) => s + r.distance, 0);
        const pct = Math.min((totalKm / shoe.targetKm) * 100, 100);
        const isWarning = pct >= 80 && pct < 95;
        const isDanger = pct >= 95;
        const cardClass = isDanger ? 'danger' : isWarning ? 'warning' : '';
        const isOpen = openCardId === shoe.id;

        let badge = '';
        if (isDanger) badge = `<span class="replace-badge critical">⚠ Replace soon</span>`;
        else if (isWarning) badge = `<span class="replace-badge warn">⚡ Getting worn</span>`;

        const runsHtml = shoeRuns.length ? shoeRuns.slice(0, 20).map(r => `
      <div class="run-item">
        <div>
          <div class="run-distance">${r.distance.toFixed(1)} km</div>
          <div class="run-date">${formatDate(r.date)}</div>
          ${r.notes ? `<div class="run-notes">${escHtml(r.notes)}</div>` : ''}
        </div>
        <div class="run-actions">
          <button onclick="editRun('${r.id}')" aria-label="Edit run">✏️</button>
          <button onclick="confirmDeleteRun('${r.id}')" aria-label="Delete run">🗑</button>
        </div>
      </div>
    `).join('') : '<div class="no-runs-msg">No runs logged yet</div>';

        return `
    <div class="shoe-card ${cardClass} ${isOpen ? 'open' : ''}" data-id="${shoe.id}">
      <div class="shoe-card-header" onclick="toggleCard('${shoe.id}')">
        <div class="shoe-top-row">
          <div class="shoe-info">
            <h3>${escHtml(shoe.name)}</h3>
            ${shoe.brand ? `<div class="shoe-brand">${escHtml(shoe.brand)}</div>` : ''}
            ${badge}
          </div>
          <div class="shoe-km">
            <div class="value">${totalKm.toFixed(1)}</div>
            <div class="target">/ ${shoe.targetKm} km</div>
          </div>
        </div>
        <span class="expand-icon">▾</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="progress-label">
          <span>${totalKm.toFixed(1)} km logged</span>
          <span class="pct">${pct.toFixed(0)}%</span>
        </div>
      </div>
      <div class="shoe-runs ${isOpen ? 'expanded' : ''}">
        <div class="shoe-runs-inner">
          <div class="runs-header"><h4>Run History</h4></div>
          ${runsHtml}
        </div>
      </div>
      <div class="shoe-actions">
        <button class="btn-log" onclick="openLogRun('${shoe.id}')">▶ Log Run</button>
        <button class="btn-edit" onclick="editShoe('${shoe.id}')">✏ Edit</button>
        <button class="btn-delete" onclick="confirmDeleteShoe('${shoe.id}')">✕ Delete</button>
      </div>
    </div>`;
    }).join('');
}

function toggleCard(id) {
    openCardId = openCardId === id ? null : id;
    renderShoeList();
}

/* ════ History ════ */
function renderHistory() {
    const filtered = getRunsFiltered([...allRuns], currentFilter).sort((a, b) => b.date.localeCompare(a.date));

    if (filtered.length === 0) {
        historyListEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📋</div>
        <h3>No runs found</h3>
        <p>Log a run from the dashboard to see it here.</p>
      </div>`;
        return;
    }

    const shoeMap = {};
    shoes.forEach(s => shoeMap[s.id] = s.name);

    historyListEl.innerHTML = filtered.map(r => `
    <div class="history-item">
      <span class="history-shoe-badge" title="${escHtml(shoeMap[r.shoeId] || 'Unknown')}">${escHtml(shoeMap[r.shoeId] || '?')}</span>
      <div class="history-details">
        <div class="history-distance">${r.distance.toFixed(1)} km</div>
        <div class="history-date">${formatDate(r.date)}${r.notes ? ' · ' + escHtml(r.notes) : ''}</div>
      </div>
      <div class="history-actions">
        <button onclick="editRun('${r.id}')" aria-label="Edit">✏️</button>
        <button onclick="confirmDeleteRun('${r.id}')" aria-label="Delete">🗑</button>
      </div>
    </div>
  `).join('');
}

function initFilters() {
    $('filterRow').addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        currentFilter = chip.dataset.period;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderHistory();
    });
}

/* ════ Modals ════ */
function initModals() {
    // Add shoe button
    $('btnAddShoe').addEventListener('click', () => {
        resetShoeForm();
        $('modalShoeTitle').textContent = 'Add Shoe';
        $('btnShoeSubmit').textContent = 'Add Shoe';
        openModal('modalShoe');
    });

    // Shoe form submit
    $('formShoe').addEventListener('submit', async e => {
        e.preventDefault();
        const editId = $('shoeEditId').value;
        const name = $('shoeName').value.trim();
        const brand = $('shoeBrand').value.trim();
        const targetKm = parseInt($('shoeTarget').value) || 500;

        if (!name) return;

        if (editId) {
            const shoe = shoes.find(s => s.id === editId);
            if (shoe) {
                shoe.name = name;
                shoe.brand = brand;
                shoe.targetKm = targetKm;
                await updateShoe(shoe);
                toast('Shoe updated', 'success');
            }
        } else {
            await addShoe({ name, brand, targetKm });
            toast('Shoe added!', 'success');
        }

        closeModal('modalShoe');
        await refresh();
        scheduleAutoBackup();
    });

    // Run form submit
    $('formRun').addEventListener('submit', async e => {
        e.preventDefault();
        const editId = $('runEditId').value;
        const shoeId = $('runShoeSelect').value;
        const distance = parseFloat($('runDistance').value);
        const date = $('runDate').value;
        const notes = $('runNotes').value.trim();

        if (!shoeId || !distance || distance <= 0 || !date) {
            toast('Please fill all required fields', 'error');
            return;
        }

        if (editId) {
            const run = allRuns.find(r => r.id === editId);
            if (run) {
                run.shoeId = shoeId;
                run.distance = distance;
                run.date = date;
                run.notes = notes;
                await updateRun(run);
                toast('Run updated', 'success');
            }
        } else {
            await addRun({ shoeId, distance, date, notes });
            toast('Run logged! 🏃', 'success');
        }

        closeModal('modalRun');
        await refresh();
        scheduleAutoBackup();
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
}

function openModal(id) {
    $(id).classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    $(id).classList.remove('visible');
    document.body.style.overflow = '';
}

function resetShoeForm() {
    $('shoeEditId').value = '';
    $('shoeName').value = '';
    $('shoeBrand').value = '';
    $('shoeTarget').value = '500';
}

/* ════ Shoe CRUD UI ════ */
window.editShoe = function (id) {
    const shoe = shoes.find(s => s.id === id);
    if (!shoe) return;
    $('shoeEditId').value = shoe.id;
    $('shoeName').value = shoe.name;
    $('shoeBrand').value = shoe.brand || '';
    $('shoeTarget').value = shoe.targetKm;
    $('modalShoeTitle').textContent = 'Edit Shoe';
    $('btnShoeSubmit').textContent = 'Save Changes';
    openModal('modalShoe');
};

window.confirmDeleteShoe = function (id) {
    const shoe = shoes.find(s => s.id === id);
    if (!shoe) return;
    $('confirmTitle').textContent = 'Delete Shoe?';
    $('confirmMsg').innerHTML = `This will delete <span class="name">${escHtml(shoe.name)}</span> and all its runs. This cannot be undone.`;
    $('btnConfirmYes').onclick = async () => {
        await deleteShoe(id);
        closeModal('modalConfirm');
        toast('Shoe deleted', 'success');
        if (openCardId === id) openCardId = null;
        await refresh();
        scheduleAutoBackup();
    };
    openModal('modalConfirm');
};

/* ════ Run CRUD UI ════ */
function populateShoeSelect(selectedId) {
    const sel = $('runShoeSelect');
    sel.innerHTML = '<option value="">Select Shoe</option>' +
        shoes.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');
}

window.openLogRun = function (shoeId) {
    $('runEditId').value = '';
    $('runShoeId').value = '';
    $('runDistance').value = '';
    $('runDate').value = todayStr();
    $('runNotes').value = '';
    populateShoeSelect(shoeId || '');
    $('modalRunTitle').textContent = 'Log Run';
    $('btnRunSubmit').textContent = 'Log Run';
    openModal('modalRun');
};

window.editRun = function (id) {
    const run = allRuns.find(r => r.id === id);
    if (!run) return;
    $('runEditId').value = run.id;
    $('runDistance').value = run.distance;
    $('runDate').value = run.date;
    $('runNotes').value = run.notes || '';
    populateShoeSelect(run.shoeId);
    $('modalRunTitle').textContent = 'Edit Run';
    $('btnRunSubmit').textContent = 'Save Changes';
    openModal('modalRun');
};

window.confirmDeleteRun = function (id) {
    const run = allRuns.find(r => r.id === id);
    if (!run) return;
    $('confirmTitle').textContent = 'Delete Run?';
    $('confirmMsg').innerHTML = `Delete the <span class="name">${run.distance.toFixed(1)} km</span> run on <span class="name">${formatDate(run.date)}</span>?`;
    $('btnConfirmYes').onclick = async () => {
        await deleteRun(id);
        closeModal('modalConfirm');
        toast('Run deleted', 'success');
        await refresh();
        scheduleAutoBackup();
    };
    openModal('modalConfirm');
};

/* ════ Settings / Export / Import ════ */
function initSettings() {
    $('btnExport').addEventListener('click', async () => {
        try {
            const json = await exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shoemiles-backup-${todayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Backup exported!', 'success');
        } catch (err) {
            toast('Export failed', 'error');
        }
    });

    $('btnImport').addEventListener('click', () => {
        $('importInput').click();
    });

    $('importInput').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            await importData(text);
            toast('Data imported!', 'success');
            await refresh();
            scheduleAutoBackup();
        } catch (err) {
            toast('Import failed — invalid file', 'error');
        }
        e.target.value = '';
    });

    // Share / Google Drive backup
    $('btnShareDrive').addEventListener('click', async () => {
        try {
            const json = await exportData();
            const filename = `shoemiles-backup-${todayStr()}.txt`;

            // Try 1: Share as .txt file (more compatible than .json across share targets)
            if (navigator.share) {
                try {
                    const file = new File([json], filename, { type: 'text/plain' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            title: 'ShoeMiles Backup',
                            files: [file]
                        });
                        toast('Backup shared!', 'success');
                        return;
                    }
                } catch (fileErr) {
                    if (fileErr.name === 'AbortError') return; // user cancelled
                    // File share failed, try text-only share below
                }

                // Try 2: Share as plain text (works on almost everything)
                try {
                    await navigator.share({
                        title: 'ShoeMiles Backup',
                        text: json
                    });
                    toast('Backup shared as text!', 'success');
                    return;
                } catch (textErr) {
                    if (textErr.name === 'AbortError') return;
                }
            }

            // Try 3: Fallback — download the file directly
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shoemiles-backup-${todayStr()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Backup saved to Downloads!', 'success');
        } catch (err) {
            toast('Backup failed — try Export instead', 'error');
        }
    });
}

/* ════ Auto-Backup UI ════ */
function initAutoBackupUI() {
    const enabled = isAutoBackupEnabled();
    const toggle = $('autoBackupToggle');
    if (toggle) {
        toggle.checked = enabled;
        toggle.addEventListener('change', () => {
            const newState = setAutoBackup(toggle.checked);
            toast(newState ? 'Auto-backup enabled' : 'Auto-backup disabled', 'success');
        });
    }
}

/* ════ Install Prompt ════ */
function initInstall() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredInstallPrompt = e;
        setTimeout(() => {
            $('installBanner').classList.add('visible');
        }, 2000);
    });

    $('btnInstall').addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === 'accepted') {
            toast('App installed! 🎉', 'success');
        }
        deferredInstallPrompt = null;
        $('installBanner').classList.remove('visible');
    });

    $('btnInstallClose').addEventListener('click', () => {
        $('installBanner').classList.remove('visible');
    });

    window.addEventListener('appinstalled', () => {
        $('installBanner').classList.remove('visible');
        deferredInstallPrompt = null;
    });
}

/* ════ Toast ════ */
function toast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = `toast ${type} visible`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toastEl.classList.remove('visible');
    }, 2500);
}

/* ════ Helpers ════ */
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

function escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}
