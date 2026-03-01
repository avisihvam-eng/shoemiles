/*  ───────────────────────────────────────
    IndexedDB Data Layer — Shoe Mileage Tracker
    ─────────────────────────────────────── */

const DB_NAME = 'ShoeMilesDB';
const DB_VERSION = 1;

let _db = null;

function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shoes')) {
                const shoes = db.createObjectStore('shoes', { keyPath: 'id' });
                shoes.createIndex('name', 'name', { unique: false });
            }
            if (!db.objectStoreNames.contains('runs')) {
                const runs = db.createObjectStore('runs', { keyPath: 'id' });
                runs.createIndex('shoeId', 'shoeId', { unique: false });
                runs.createIndex('date', 'date', { unique: false });
            }
        };

        req.onsuccess = e => { _db = e.target.result; resolve(_db); };
        req.onerror = e => reject(e.target.error);
    });
}

/* ── Generic helpers ── */

function tx(storeName, mode = 'readonly') {
    return openDB().then(db => {
        const t = db.transaction(storeName, mode);
        return t.objectStore(storeName);
    });
}

function reqToPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAll(storeName) {
    return tx(storeName).then(s => reqToPromise(s.getAll()));
}

function put(storeName, item) {
    return tx(storeName, 'readwrite').then(s => reqToPromise(s.put(item)));
}

function del(storeName, id) {
    return tx(storeName, 'readwrite').then(s => reqToPromise(s.delete(id)));
}

/* ── Shoe CRUD ── */

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function addShoe({ name, brand = '', targetKm = 500 }) {
    const shoe = { id: uid(), name, brand, targetKm: Number(targetKm), createdAt: new Date().toISOString() };
    await put('shoes', shoe);
    return shoe;
}

async function updateShoe(shoe) {
    shoe.targetKm = Number(shoe.targetKm);
    await put('shoes', shoe);
    return shoe;
}

async function deleteShoe(id) {
    // Delete shoe and all associated runs
    const runs = await getRunsByShoe(id);
    for (const r of runs) await del('runs', r.id);
    await del('shoes', id);
}

async function getShoes() {
    return getAll('shoes');
}

/* ── Run CRUD ── */

async function addRun({ shoeId, distance, date, notes = '' }) {
    const run = { id: uid(), shoeId, distance: Number(distance), date, notes, createdAt: new Date().toISOString() };
    await put('runs', run);
    return run;
}

async function updateRun(run) {
    run.distance = Number(run.distance);
    await put('runs', run);
    return run;
}

async function deleteRun(id) {
    await del('runs', id);
}

async function getAllRuns() {
    return getAll('runs');
}

async function getRunsByShoe(shoeId) {
    const all = await getAll('runs');
    return all.filter(r => r.shoeId === shoeId);
}

function getRunsFiltered(runs, period) {
    const now = new Date();
    let start;
    switch (period) {
        case 'week': {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            break;
        }
        case 'month': {
            start = new Date(now);
            start.setMonth(now.getMonth() - 1);
            break;
        }
        case 'year': {
            start = new Date(now);
            start.setFullYear(now.getFullYear() - 1);
            break;
        }
        default: return runs; // 'all'
    }
    const startStr = start.toISOString().slice(0, 10);
    return runs.filter(r => r.date >= startStr);
}

/* ── Export / Import ── */

async function exportData() {
    const shoes = await getShoes();
    const runs = await getAllRuns();
    return JSON.stringify({ shoes, runs, exportedAt: new Date().toISOString() }, null, 2);
}

async function importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.shoes || !data.runs) throw new Error('Invalid backup file');
    // Clear existing data
    const existingShoes = await getShoes();
    for (const s of existingShoes) await del('shoes', s.id);
    const existingRuns = await getAllRuns();
    for (const r of existingRuns) await del('runs', r.id);
    // Write imported data
    for (const s of data.shoes) await put('shoes', s);
    for (const r of data.runs) await put('runs', r);
}

/* ── Auto-Backup ── */

let _backupTimer = null;
let _backupEnabled = true;

/**
 * Schedule an auto-backup. Debounced — waits 2s after last data change
 * so rapid edits (e.g. multiple deletes) only trigger one backup.
 */
function scheduleAutoBackup() {
    if (!_backupEnabled) return;
    clearTimeout(_backupTimer);
    _backupTimer = setTimeout(async () => {
        try {
            const json = await exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'shoemiles-backup.json';
            // Use a fixed filename so it overwrites the previous backup in Downloads
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            console.log('[ShoeMiles] Auto-backup saved to Downloads');
        } catch (err) {
            console.warn('[ShoeMiles] Auto-backup failed:', err);
        }
    }, 2000);
}

/**
 * Toggle auto-backup on/off. Returns new state.
 */
function setAutoBackup(enabled) {
    _backupEnabled = enabled;
    localStorage.setItem('shoemiles_autobackup', enabled ? '1' : '0');
    if (!enabled) clearTimeout(_backupTimer);
    return _backupEnabled;
}

function isAutoBackupEnabled() {
    const stored = localStorage.getItem('shoemiles_autobackup');
    if (stored !== null) _backupEnabled = stored === '1';
    return _backupEnabled;
}
