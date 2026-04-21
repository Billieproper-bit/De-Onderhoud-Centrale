import { supabase } from './supabase-config.js';

let currentUser = null;
let currentUserRole = 'user';
let systems = [];
let favorites = [];
let currentEditingId = null;
let allUsers = [];
let pendingImages = { add: [], edit: [] };
let auditLogs = [];

// --- INITIALISATIE ---
async function init() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        currentUser = session.user;
        const isApproved = await checkUserApproval(session.user);

        if (isApproved) {
            showApp();
            await loadData();
        } else {
            showPendingScreen(session.user.email);
        }
    } else {
        showAuth();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            location.reload(); // Ververs om alles schoon te laden
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });

    setupEventListeners();
    initTheme();
}

async function checkUserApproval(user) {
    try {
        const { data, error } = await supabase
            .from('user_roles')
            .select('is_approved, role')
            .eq('user_id', user.id)
            .maybeSingle();

        if (!data) {
            await supabase.from('user_roles').insert([{ user_id: user.id, email: user.email, is_approved: false }]);
            return false;
        }
        currentUserRole = data.role || 'user';
        return data.is_approved;
    } catch (err) {
        return false;
    }
}

// --- DATA LADEN & FILTERS ---
async function loadData() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    try {
        const { data: systemsData, error } = await supabase
            .from('systems')
            .select('*')
            .order('brand', { ascending: true });

        if (error) throw error;
        systems = systemsData;

        if (currentUser) {
            const { data: favs } = await supabase.from('favorites').select('system_id').eq('user_id', currentUser.id);
            favorites = favs ? favs.map(f => f.system_id) : [];
        }

        updateBrandFilter();
        updateModelFilter();
        filterSystems();
    } catch (error) {
        console.error('Laden mislukt:', error);
    } finally {
        document.getElementById('loadingState')?.classList.add('hidden');
    }
}

function filterSystems() {
    const type = document.getElementById('systemTypeFilter').value;
    const brand = document.getElementById('brandFilter').value;
    const model = document.getElementById('modelFilter').value;
    const favOnly = document.getElementById('favoritesFilter').value === 'favorites';

    const filtered = systems.filter(s => {
        const matchType = !type || s.systemtype === type || (type === 'mv-wtw' && (s.systemtype === 'mv-wtw' || s.systemtype === 'wtw-mv'));
        const matchBrand = brand === 'all' || s.brand === brand;
        const matchModel = model === 'all' || s.model === model;
        const matchFav = !favOnly || favorites.includes(s.id);
        return matchType && matchBrand && matchModel && matchFav;
    });

    renderSystems(filtered);
}

// --- UI RENDERING ---
function renderSystems(list) {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.innerHTML = list.map(s => createSystemCard(s)).join('');
    grid.classList.remove('hidden');
    document.getElementById('resultsCount').textContent = `${list.length} systemen gevonden`;
}

function createSystemCard(system) {
    const isFav = favorites.includes(system.id);
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';

    // Materialen Sectie (JSONB proof)
    let materialsContent = '';
    if (system.parts) {
        try {
            const parts = Array.isArray(system.parts) ? system.parts : JSON.parse(system.parts);
            if (parts.length > 0) {
                materialsContent = `<div class="parts-list"><table class="parts-table"><thead><tr><th>Artikel</th><th>Art. nr.</th><th>Lev.</th></tr></thead><tbody>`;
                materialsContent += parts.map(p => {
                    const cleanArt = p.art ? p.art.toString().replace(/[\s.]/g, '') : "";
                    let link = p.supp === 'Rensa' ? `https://rensa.nl/Product/${cleanArt}` : (p.supp === 'Wasco' ? `https://www.wasco.nl/artikel/${cleanArt}` : null);
                    return `<tr><td>${escapeHtml(p.desc)}</td><td>${link ? `<a href="${link}" target="_blank">${p.art} ↗</a>` : (p.art || '')}</td><td>${p.supp}</td></tr>`;
                }).join('');
                materialsContent += `</tbody></table></div>`;
            }
        } catch (e) { materialsContent = '<p>Fout bij laden materialen</p>'; }
    }

    return `
    <div class="system-card" id="card-${system.id}">
      <div class="card-header">
        <div class="card-header-with-logo">
          ${system.logo_url ? `<img src="${system.logo_url}" class="brand-logo" onerror="this.style.display='none'">` : ''}
          <div class="card-header-text">
            <div class="brand-label">${system.brand}</div>
            <div class="model-label">${system.model}</div>
            ${system.handbook_date && system.handbook_date !== '1900-01-01' ? `<div class="card-meta">📅 ${new Date(system.handbook_date).toLocaleDateString('nl-NL')}</div>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${system.id}')">★</button>
          ${canEdit ? `<button class="icon-btn" onclick="openEditModal('${system.id}')">✎</button>` : ''}
        </div>
      </div>
      <div class="tabs-nav">
        <button class="tab-btn active" onclick="switchTab('${system.id}', 'maint')">Info</button>
        <button class="tab-btn" onclick="switchTab('${system.id}', 'parts')">Materialen</button>
      </div>
      <div id="content-maint-${system.id}" class="tab-content active"><pre class="procedure-text">${system.procedure}</pre></div>
      <div id="content-parts-${system.id}" class="tab-content">${materialsContent || 'Geen info'}</div>
    </div>`;
}

// --- OPSLAAN & BEWERKEN ---
async function handleEditSubmit(e) {
    if (e) e.preventDefault();
    const submitBtn = document.querySelector('#editForm button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Bezig...";

        const id = document.getElementById('editId').value;
        const systemType = document.getElementById('editSystemType').value;

        // Data verzamelen (Arrays)
        const partsArray = collectPartsData('edit');
        const faultsArray = collectFaultsData('edit');
        const checksArray = await processChecksData('edit');

        const updates = {
            brand: document.getElementById('editBrand').value.trim(),
            model: document.getElementById('editModel').value.trim(),
            procedure: document.getElementById('editProcedure').value,
            parts: partsArray, // Let op: als je kolom nog TEXT is, gebruik: JSON.stringify(partsArray)
            faults: faultsArray,
            checks: checksArray,
            notes: document.getElementById('editNotes')?.value || null,
            manual_url: document.getElementById('editManualUrl')?.value || null,
            handbook_date: document.getElementById('editHandbookDate')?.value || null
        };

        if (systemType === 'cv-ketel') {
            updates.o2_low = document.getElementById('editO2Low')?.value || null;
            updates.o2_high = document.getElementById('editO2High')?.value || null;
            updates.maxco = document.getElementById('editMaxCO')?.value || null;
        }

        // De Database Update
        const { error } = await Promise.race([
            supabase.from('systems').update(updates).eq('id', id),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
        ]);

        if (error) throw error;

        alert("✅ Systeem bijgewerkt!");
        location.reload();
    } catch (error) {
        alert("Fout bij opslaan: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// --- CALCULATOR (NEN-NORM) ---
function calculateHVAC() {
    const Hs = 35.17;
    const rho = 983;
    const c = 4186;

    const gasStart = parseFloat(document.getElementById('gasStart').value) || 0;
    const gasEind = parseFloat(document.getElementById('gasEind').value) || 0;
    const flowLmin = parseFloat(document.getElementById('calcFlow').value) || 0;
    const tKoud = parseFloat(document.getElementById('calcTempKoud').value) || 0;
    const tWarm = parseFloat(document.getElementById('calcTempWarm').value) || 0;

    let belasting = 0;
    let vermogen = 0;

    if (gasEind > gasStart) {
        belasting = ((gasEind - gasStart) / 180) * Hs;
        document.getElementById('resBelastingHs').innerHTML = `Belasting (H<sub>s</sub>): ${belasting.toFixed(2)} kW`;
    }

    if (flowLmin > 0 && tWarm > tKoud) {
        vermogen = ((flowLmin / 60) / 1000 * c * rho * (tWarm - tKoud)) / 1000;
        document.getElementById('resVermogen').textContent = `Vermogen: ${vermogen.toFixed(2)} kW`;
    }

    const resRen = document.getElementById('resRendement');
    if (belasting > 0 && vermogen > 0 && resRen) {
        const rendement = (vermogen / belasting) * 100;
        resRen.textContent = `${rendement.toFixed(1)}%`;
        resRen.style.color = rendement > 90 ? 'var(--color-success)' : 'var(--color-warning)';
    }
}

// --- HELPERS ---
function collectPartsData(mode) {
    const rows = document.querySelectorAll(`#${mode}PartsContainer .part-input-row`);
    const data = [];
    rows.forEach(row => {
        const desc = row.querySelector('.part-desc')?.value.trim();
        const art = row.querySelector('.part-art')?.value.trim();
        const supp = row.querySelector('.part-supp')?.value;
        if (desc || art) data.push({ desc, art, supp });
    });
    return data;
}

async function processChecksData(mode) {
    const rows = document.querySelectorAll(`#${mode}ChecksContainer .part-input-row`);
    const data = [];
    for (const row of rows) {
        const subject = row.querySelector('.check-subject')?.value.trim();
        if (subject) {
            data.push({
                subject,
                problem: row.querySelector('.check-problem')?.value.trim(),
                solution: row.querySelector('.check-solution')?.value.trim(),
                imgUrl: row.querySelector('.check-existing-url')?.value || null
            });
        }
    }
    return data;
}

// --- AUTH & ADMIN ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) alert("Login fout: " + error.message);
}

async function deleteUser(userId, email) {
    if (!confirm(`Gebruiker ${email} verwijderen?`)) return;
    const { error } = await supabase.rpc('delete_user_by_id', { user_id: userId });
    if (error) alert(error.message);
    else location.reload();
}

// --- BOILERPLATE / UI ---
function switchTab(id, tab) {
    const card = document.getElementById(`card-${id}`);
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    card.querySelector(`[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`content-${tab}-${id}`).classList.add('active');
}

function openEditModal(id) {
    const s = systems.find(x => x.id === id);
    if (!s) return;
    currentEditingId = id;
    document.getElementById('editId').value = id;
    document.getElementById('editBrand').value = s.brand;
    document.getElementById('editModel').value = s.model;
    document.getElementById('editProcedure').value = s.procedure;
    document.getElementById('editSystemType').value = s.systemtype;
    populatePartsForm('edit', s.parts);
    document.getElementById('editModal').classList.add('active');
}

function populatePartsForm(mode, data) {
    const container = document.getElementById(mode + 'PartsContainer');
    container.innerHTML = '';
    const parts = Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data || '[]') : []);
    parts.forEach(p => addPartRow(mode, p.desc, p.art, p.supp));
}

function addPartRow(mode, desc = '', art = '', supp = 'Overig') {
    const div = document.createElement('div');
    div.className = 'part-input-row';
    div.innerHTML = `
        <input type="text" class="form-control part-desc" value="${desc}" placeholder="Omschrijving">
        <input type="text" class="form-control part-art" value="${art}" placeholder="Art. nr.">
        <select class="form-control part-supp">
            <option value="Overig" ${supp === 'Overig' ? 'selected' : ''}>Overig</option>
            <option value="Wasco" ${supp === 'Wasco' ? 'selected' : ''}>Wasco</option>
            <option value="Rensa" ${supp === 'Rensa' ? 'selected' : ''}>Rensa</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById(mode + 'PartsContainer').appendChild(div);
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

// --- START ---
init();

// --- WINDOW EXPORTS ---
window.handleLogin = handleLogin;
window.handleEditSubmit = handleEditSubmit;
window.openCalcModal = () => document.getElementById('calcModal').classList.add('active');
window.closeCalcModal = () => document.getElementById('calcModal').classList.remove('active');
window.calculateHVAC = calculateHVAC;
window.openEditModal = openEditModal;
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    if (isFav) await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('system_id', id);
    else await supabase.from('favorites').insert({ user_id: currentUser.id, system_id: id });
    location.reload();
};
window.deleteUser = deleteUser;
window.addPartRow = addPartRow;
window.switchTab = switchTab;
window.toggleTheme = () => {
    const t = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
};
