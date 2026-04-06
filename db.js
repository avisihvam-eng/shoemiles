/*  ───────────────────────────────────────
    Supabase Data Layer — Shoe Mileage Tracker
    ─────────────────────────────────────── */

const SUPABASE_URL = 'https://ovsoyipkwtbzvjfhsrrk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92c295aXBrd3RienZqZmhzcnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTc0MDgsImV4cCI6MjA5MDk5MzQwOH0.R0R9NT-B_58c_iFrYxB1hRdbXSbWoP7jTTId6w9oL7A';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Shoe CRUD ── */

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function mapShoe(d) {
    return { id: d.id, name: d.name, brand: d.brand, targetKm: Number(d.target_km), createdAt: d.created_at };
}

function mapRun(d) {
    return { id: d.id, shoeId: d.shoe_id, distance: Number(d.distance), date: d.date, notes: d.notes, createdAt: d.created_at };
}

async function addShoe({ id, name, brand = '', targetKm = 500, createdAt }) {
    id = id || uid();
    const payload = { id, name, brand, target_km: Number(targetKm) };
    if (createdAt) payload.created_at = createdAt;
    
    // Upsert to handle imports/migrations seamlessly
    const { data, error } = await supabase.from('shoes').upsert([payload]).select().single();
    if (error) throw error;
    return mapShoe(data);
}

async function updateShoe(shoe) {
    const { data, error } = await supabase.from('shoes').update({
        name: shoe.name,
        brand: shoe.brand,
        target_km: Number(shoe.targetKm)
    }).eq('id', shoe.id).select().single();
    if (error) throw error;
    return mapShoe(data);
}

async function deleteShoe(id) {
    const { error } = await supabase.from('shoes').delete().eq('id', id);
    if (error) throw error;
}

async function getShoes() {
    const { data, error } = await supabase.from('shoes').select('*');
    if (error) throw error;
    return data.map(mapShoe);
}

/* ── Run CRUD ── */

async function addRun({ id, shoeId, distance, date, notes = '', createdAt }) {
    id = id || uid();
    const payload = { id, shoe_id: shoeId, distance: Number(distance), date, notes };
    if (createdAt) payload.created_at = createdAt;
    
    const { data, error } = await supabase.from('runs').upsert([payload]).select().single();
    if (error) throw error;
    return mapRun(data);
}

async function updateRun(run) {
    const { data, error } = await supabase.from('runs').update({
        shoe_id: run.shoeId,
        distance: Number(run.distance),
        date: run.date,
        notes: run.notes
    }).eq('id', run.id).select().single();
    if (error) throw error;
    return mapRun(data);
}

async function deleteRun(id) {
    const { error } = await supabase.from('runs').delete().eq('id', id);
    if (error) throw error;
}

async function getAllRuns() {
    const { data, error } = await supabase.from('runs').select('*');
    if (error) throw error;
    return data.map(mapRun);
}

async function getRunsByShoe(shoeId) {
    const { data, error } = await supabase.from('runs').select('*').eq('shoe_id', shoeId);
    if (error) throw error;
    return data.map(mapRun);
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
    
    // Check what exists so we don't duplicate
    const currentShoes = await getShoes();
    const currentShoeIds = new Set(currentShoes.map(s => s.id));
    
    for (const s of data.shoes) {
        if (!currentShoeIds.has(s.id)) {
            await addShoe({ id: s.id, name: s.name, brand: s.brand, targetKm: s.targetKm, createdAt: s.createdAt });
        }
    }
    
    // Now same for runs
    const currentRuns = await getAllRuns();
    const currentRunIds = new Set(currentRuns.map(r => r.id));
    
    for (const r of data.runs) {
        if (!currentRunIds.has(r.id)) {
             await addRun({ id: r.id, shoeId: r.shoeId, distance: r.distance, date: r.date, notes: r.notes, createdAt: r.createdAt });
        }
    }
}

/* ── Auto-Backup ── */

let _backupTimer = null;
let _backupEnabled = true;

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

/* ── Migration from IndexedDB ── */
async function migrateFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ShoeMilesDB', 1);
        req.onerror = e => reject(e.target.error);
        req.onsuccess = async e => {
            try {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('shoes') || !db.objectStoreNames.contains('runs')) {
                    resolve(0); // Nothing to migrate
                    return;
                }
                
                const t = db.transaction(['shoes', 'runs'], 'readonly');
                
                const getStoreData = (storeName) => new Promise((res, rej) => {
                    const store = t.objectStore(storeName);
                    const allReq = store.getAll();
                    allReq.onsuccess = () => res(allReq.result);
                    allReq.onerror = () => rej(allReq.error);
                });
                
                const localShoes = await getStoreData('shoes');
                const localRuns = await getStoreData('runs');
                
                let migratedCount = 0;
                
                // Fetch current supabase data to prevent duplicates
                const currentShoes = await getShoes();
                const currentShoeIds = new Set(currentShoes.map(s => s.id));
                const currentRuns = await getAllRuns();
                const currentRunIds = new Set(currentRuns.map(r => r.id));
                
                for (const s of localShoes) {
                    if (!currentShoeIds.has(s.id)) {
                        await addShoe({ id: s.id, name: s.name, brand: s.brand, targetKm: s.targetKm, createdAt: s.createdAt });
                        migratedCount++;
                    }
                }
                
                for (const r of localRuns) {
                    if (!currentRunIds.has(r.id)) {
                        await addRun({ id: r.id, shoeId: r.shoeId, distance: r.distance, date: r.date, notes: r.notes, createdAt: r.createdAt });
                        migratedCount++;
                    }
                }
                
                resolve(migratedCount);
            } catch (err) {
                reject(err);
            }
        };
    });
}
