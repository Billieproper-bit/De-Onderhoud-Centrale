import { supabase } from './supabase-config.js';

let currentUser = null;
let currentUserRole = 'user';
let systems = [];
let favorites = [];
let currentEditingId = null;
let allUsers = [];
let pendingImages = { add: [], edit: [] };

// --- 1. INITIALISATIE & AUTH ---
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
            location.reload(); 
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

function showApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser?.email;
    updateUIForRole();
}

function showAuth() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
}

function showPendingScreen(email) {
    const container = document.getElementById('pendingScreen');
    container.classList.remove('hidden');
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('pendingMessage').innerHTML = `Hoi <b>${email}</b>, je account moet nog worden goedgekeurd door de beheerder.`;
}

function updateUIForRole() {
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';
    const isAdmin = currentUserRole === 'admin';
    document.getElementById('addSystemBtn').style.display = canEdit ? 'inline-flex' : 'none';
    document.getElementById('adminBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    checkPendingNotifications();
}

// --- 2. DATA LADEN & FILTERS ---
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

function updateBrandFilter() {
    const select = document.getElementById('brandFilter');
    const brands = [...new Set(systems.map(s => s.brand))].sort();
    select.innerHTML = '<option value="all">Alle Merken</option>';
    brands.forEach(b => select.innerHTML += `<option value="${b}">${b}</option>`);
}

function updateModelFilter() {
    const select = document.getElementById('modelFilter');
    const brand = document.getElementById('brandFilter').value;
    const filtered = brand === 'all' ? systems : systems.filter(s => s.brand === brand);
    const models = [...new Set(filtered.map(s => s.model))].sort();
    select.innerHTML = '<option value="all">Alle Modellen</option>';
    models.forEach(m => select.innerHTML += `<option value="${m}">${m}</option>`);
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

    const grid = document.getElementById('cardsGrid');
    grid.innerHTML = filtered.map(s => createSystemCard(s)).join('');
    document.getElementById('resultsCount').textContent = `${filtered.length} systemen gevonden`;
}

// --- 3. UI RENDERING (KAARTJES) ---
function createSystemCard(system) {
    const isFav = favorites.includes(system.id);
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';

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
        } catch (e) { materialsContent = '<p>Geen materialen beschikbaar.</p>'; }
    }

    return `
    <div class="system-card" id="card-${system.id}">
      <div class="card-header">
        <div class="card-header-with-logo">
          ${system.logo_url ? `<img src="${system.logo_url}" class="brand-logo" onerror="this.style.display='none'">` : ''}
          <div class="card-header-text">
            <div class="brand-label">${system.brand}</div>
            <div class="model-label">${system.model}</div>
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${system.id}')">★</button>
          ${canEdit ? `<button class="icon-btn" onclick="openEditModal('${system.id}')">✎</button>` : ''}
        </div>
      </div>
      <div class="tabs-nav">
        <button class="tab-btn active" data-tab="maint" onclick="switchTab('${system.id}', 'maint')">Info</button>
        <button class="tab-btn" data-tab="parts" onclick="switchTab('${system.id}', 'parts')">Materialen</button>
      </div>
      <div id="content-maint-${system.id}" class="tab-content active"><pre class="procedure-text">${system.procedure}</pre></div>
      <div id="content-parts-${system.id}" class="tab-content">${materialsContent || 'Geen extra info'}</div>
    </div>`;
}

// --- 4. BEWERKEN & OPSLAAN ---
async function handleEditSubmit(e) {
    if (e) e.preventDefault();
    const submitBtn = document.querySelector('#editForm button[type="submit"]');
    try {
        submitBtn.disabled = true;
        const id = document.getElementById('editId').value;
        const updates = {
            brand: document.getElementById('editBrand').value.trim(),
            model: document.getElementById('editModel').value.trim(),
            procedure: document.getElementById('editProcedure').value,
            parts: collectPartsData('edit'), // Stuurt Array naar jsonb kolom
            notes: document.getElementById('editNotes')?.value || null
        };

        const { error } = await supabase.from('systems').update(updates).eq('id', id);
        if (error) throw error;
        alert("✅ Bijgewerkt!");
        location.reload();
    } catch (err) {
        alert("Fout: " + err.message);
        submitBtn.disabled = false;
    }
}

// --- 5. HELPERS & CALCULATOR ---
function calculateHVAC() {
    const Hs = 35.17;
    const gasStart = parseFloat(document.getElementById('gasStart').value) || 0;
    const gasEind = parseFloat(document.getElementById('gasEind').value) || 0;
    const flow = parseFloat(document.getElementById('calcFlow').value) || 0;
    const tKoud = parseFloat(document.getElementById('calcTempKoud').value) || 0;
    const tWarm = parseFloat(document.getElementById('calcTempWarm').value) || 0;

    let belasting = 0;
    if (gasEind > gasStart) {
        belasting = ((gasEind - gasStart) / 180) * Hs;
        document.getElementById('resBelastingHs').innerHTML = `Belasting (H<sub>s</sub>): ${belasting.toFixed(2)} kW`;
    }

    if (flow > 0 && tWarm > tKoud) {
        const vermogen = ((flow / 60) / 1000 * 4186 * 983 * (tWarm - tKoud)) / 1000;
        document.getElementById('resVermogen').textContent = `Vermogen: ${vermogen.toFixed(2)} kW`;
        if (belasting > 0) {
            const rendement = (vermogen / belasting) * 100;
            document.getElementById('resRendement').textContent = `${rendement.toFixed(1)}%`;
        }
    }
}

function collectPartsData(mode) {
    const rows = document.querySelectorAll(`#${mode}PartsContainer .part-input-row`);
    return Array.from(rows).map(row => ({
        desc: row.querySelector('.part-desc')?.value.trim(),
        art: row.querySelector('.part-art')?.value.trim(),
        supp: row.querySelector('.part-supp')?.value
    })).filter(p => p.desc || p.art);
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

// --- 6. EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
    document.getElementById('brandFilter')?.addEventListener('change', () => { updateModelFilter(); filterSystems(); });
    document.getElementById('modelFilter')?.addEventListener('change', filterSystems);
    document.getElementById('systemTypeFilter')?.addEventListener('change', filterSystems);
    document.getElementById('favoritesFilter')?.addEventListener('change', filterSystems);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
}

// --- 7. OVERIGE UI ---
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
    
    const container = document.getElementById('editPartsContainer');
    container.innerHTML = '';
    const parts = Array.isArray(s.parts) ? s.parts : (typeof s.parts === 'string' ? JSON.parse(s.parts || '[]') : []);
    parts.forEach(p => addPartRow('edit', p.desc, p.art, p.supp));
    
    document.getElementById('editModal').classList.add('active');
}

async function checkPendingNotifications() {
    if (currentUserRole !== 'admin') return;
    const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('is_approved', false);
    if (count > 0) document.getElementById('adminBadge').classList.remove('hidden');
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function initTheme() {
    const t = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', t);
}

// --- START ---
init();

// --- EXPORTS ---
window.handleLogin = handleLogin;
window.handleEditSubmit = handleEditSubmit;
window.calculateHVAC = calculateHVAC;
window.openCalcModal = () => document.getElementById('calcModal').classList.add('active');
window.closeCalcModal = () => document.getElementById('calcModal').classList.remove('active');
window.openEditModal = openEditModal;
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.addPartRow = addPartRow;
window.switchTab = switchTab;
window.toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    if (isFav) await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('system_id', id);
    else await supabase.from('favorites').insert({ user_id: currentUser.id, system_id: id });
    location.reload();
};
window.toggleTheme = () => {
    const t = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
};
window.supabase = supabase;
