import { supabase } from './supabase-config.js';

let currentUser = null;
let currentUserRole = 'user';
let systems = [];
let favorites = [];
let currentEditingId = null;
let pendingImages = { add: [], edit: [] };

// --- 1. UI SCHERMEN (DE FIX VOOR JOUW ERROR) ---
function showApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser?.email;
    updateUIForRole();
}

function showAuth() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('pendingScreen').classList.add('hidden');
}

function showPendingScreen(email) {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    const screen = document.getElementById('pendingScreen');
    screen.classList.remove('hidden');
    document.getElementById('pendingMessage').innerHTML = `Hoi <b>${email}</b>, je account moet nog worden goedgekeurd door de beheerder.`;
}

// --- 2. INITIALISATIE & AUTH ---
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
            if (!currentUser) location.reload(); 
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
    } catch (err) { return false; }
}

function updateUIForRole() {
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';
    const isAdmin = currentUserRole === 'admin';
    document.getElementById('addSystemBtn').style.display = canEdit ? 'inline-flex' : 'none';
    document.getElementById('adminBtn').style.display = isAdmin ? 'inline-flex' : 'none';
}

// --- 3. DATA & FILTERS ---
async function loadData() {
    document.getElementById('loadingState')?.classList.remove('hidden');
    try {
        const { data: systemsData, error } = await supabase.from('systems').select('*').order('brand', { ascending: true });
        if (error) throw error;
        systems = systemsData;

        if (currentUser) {
            const { data: favs } = await supabase.from('favorites').select('system_id').eq('user_id', currentUser.id);
            favorites = favs ? favs.map(f => f.system_id) : [];
        }

        updateBrandFilter();
        updateModelFilter();
        filterSystems();
    } catch (error) { console.error(error); }
    finally { document.getElementById('loadingState')?.classList.add('hidden'); }
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
    if (grid) {
        grid.innerHTML = filtered.map(s => createSystemCard(s)).join('');
        grid.classList.remove('hidden');
    }
    document.getElementById('resultsCount').textContent = `${filtered.length} systemen gevonden`;
}

// --- 4. DE KAARTJES (MET ALLE 4 TABBLADEN) ---
function createSystemCard(system) {
    const isFav = favorites.includes(system.id);
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';

    // A. Materialen (JSONB proof)
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
        } catch (e) { materialsContent = '<p>Geen materialen.</p>'; }
    }

    // B. Controlepunten
    let checksContent = '';
    if (system.checks) {
        try {
            const checks = Array.isArray(system.checks) ? system.checks : JSON.parse(system.checks);
            checksContent = checks.map(c => `
                <div class="check-card" style="border:1px solid var(--color-border); padding:10px; margin-bottom:10px; border-radius:8px;">
                    <div style="font-weight:bold; color:var(--color-primary);">${escapeHtml(c.subject)}</div>
                    <div style="font-size:13px;"><b>Probleem:</b> ${escapeHtml(c.problem)}</div>
                    <div style="font-size:13px;"><b>Oplossing:</b> ${escapeHtml(c.solution)}</div>
                    ${c.imgUrl ? `<img src="${c.imgUrl}" class="check-img" style="max-width:100%; margin-top:5px; border-radius:4px; cursor:pointer;" onclick="openLightbox(this.src)">` : ''}
                </div>`).join('');
        } catch(e) { checksContent = '<p>Geen aandachtspunten.</p>'; }
    }

    // C. Storingen
    let faultsContent = '';
    if (system.faults) {
        try {
            const faults = Array.isArray(system.faults) ? system.faults : JSON.parse(system.faults);
            faultsContent = faults.map(f => `
                <div class="fault-row" style="border-bottom:1px solid var(--color-border); padding:5px 0;">
                    <div class="fault-code" style="color:var(--color-error); font-weight:bold;">${escapeHtml(f.code)}</div>
                    <div style="font-size:13px;"><b>O:</b> ${escapeHtml(f.cause || f.problem || '')} | <b>S:</b> ${escapeHtml(f.solution || f.sol || '')}</div>
                </div>`).join('');
        } catch(e) { faultsContent = '<p>Geen storingen.</p>'; }
    }

    // D. Waardes & Foto's
    let valuesHtml = '';
    if (system.o2_low || system.o2_high || system.maxco) {
        valuesHtml = `<div class="values-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0;">
            ${system.o2_low ? `<div class="value-item">O₂ Laag: <b>${system.o2_low}</b></div>` : ''}
            ${system.o2_high ? `<div class="value-item">O₂ Hoog: <b>${system.o2_high}</b></div>` : ''}
        </div>`;
    }

    return `
    <div class="system-card" id="card-${system.id}">
      <div class="card-header">
        <div class="card-header-with-logo">
          ${system.logo_url ? `<img src="${system.logo_url}" class="brand-logo" style="width:40px;">` : ''}
          <div class="card-header-text">
            <div class="brand-label">${system.brand}</div>
            <div class="model-label">${system.model}</div>
          </div>
        </div>
        <div class="card-actions">
          ${system.device_image_url ? `<button class="icon-btn" onclick="openLightbox('${system.device_image_url}')">📷</button>` : ''}
          <button class="icon-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${system.id}')">★</button>
          ${canEdit ? `<button class="icon-btn" onclick="openEditModal('${system.id}')">✎</button>` : ''}
        </div>
      </div>

      <div class="tabs-nav">
        <button class="tab-btn active" onclick="switchTab('${system.id}', 'maint')">Afstelling</button>
        <button class="tab-btn" onclick="switchTab('${system.id}', 'parts')">Materialen</button>
        <button class="tab-btn" onclick="switchTab('${system.id}', 'checks')">Controle</button>
        <button class="tab-btn" onclick="switchTab('${system.id}', 'faults')">Storingen</button>
      </div>

      <div id="content-maint-${system.id}" class="tab-content active">
        <pre class="procedure-text">${system.procedure}</pre>
        ${valuesHtml}
      </div>
      <div id="content-parts-${system.id}" class="tab-content">${materialsContent || 'Geen info'}</div>
      <div id="content-checks-${system.id}" class="tab-content">${checksContent || 'Geen info'}</div>
      <div id="content-faults-${system.id}" class="tab-content">${faultsContent || 'Geen info'}</div>
    </div>`;
}

// --- 5. CALCULATOR (NEN-NORM) ---
function calculateHVAC() {
    const Hs = 35.17;
    const rho = 983;
    const c = 4186;

    const gasStart = parseFloat(document.getElementById('gasStart')?.value) || 0;
    const gasEind = parseFloat(document.getElementById('gasEind')?.value) || 0;
    const flowLmin = parseFloat(document.getElementById('calcFlow')?.value) || 0;
    const tKoud = parseFloat(document.getElementById('calcTempKoud')?.value) || 0;
    const tWarm = parseFloat(document.getElementById('calcTempWarm')?.value) || 0;

    if (gasEind > gasStart) {
        const belasting = ((gasEind - gasStart) / 180) * Hs;
        document.getElementById('resBelastingHs').innerHTML = `Belasting (H<sub>s</sub>): ${belasting.toFixed(2)} kW`;
        
        if (flowLmin > 0 && tWarm > tKoud) {
            const vermogen = ((flowLmin / 60) / 1000 * c * rho * (tWarm - tKoud)) / 1000;
            document.getElementById('resVermogen').textContent = `Vermogen: ${vermogen.toFixed(2)} kW`;
            const rendement = (vermogen / belasting) * 100;
            const resRen = document.getElementById('resRendement');
            if (resRen) {
                resRen.textContent = `${rendement.toFixed(1)}%`;
                resRen.style.color = rendement > 90 ? 'var(--color-success)' : 'var(--color-warning)';
            }
        }
    }
}

// --- 6. OPSLAAN & BEWERKEN ---
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
            parts: collectPartsData('edit'),
            notes: document.getElementById('editNotes')?.value || null
        };

        const { error } = await supabase.from('systems').update(updates).eq('id', id);
        if (error) throw error;
        alert("✅ Bijgewerkt!");
        location.reload();
    } catch (err) { alert(err.message); submitBtn.disabled = false; }
}

// --- 7. HELPERS & UI ---
function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', window.handleLogin);
    document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
    document.getElementById('brandFilter')?.addEventListener('change', () => { updateModelFilter(); filterSystems(); });
    document.getElementById('modelFilter')?.addEventListener('change', filterSystems);
    document.getElementById('systemTypeFilter')?.addEventListener('change', filterSystems);
    document.getElementById('favoritesFilter')?.addEventListener('change', filterSystems);
}

function updateBrandFilter() {
    const brands = [...new Set(systems.map(s => s.brand))].sort();
    document.getElementById('brandFilter').innerHTML = '<option value="all">Alle Merken</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
}

function updateModelFilter() {
    const brand = document.getElementById('brandFilter').value;
    const filtered = brand === 'all' ? systems : systems.filter(s => s.brand === brand);
    const models = [...new Set(filtered.map(s => s.model))].sort();
    document.getElementById('modelFilter').innerHTML = '<option value="all">Alle Modellen</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
}

function switchTab(id, tab) {
    const card = document.getElementById(`card-${id}`);
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`content-${tab}-${id}`).classList.add('active');
    // Zet het knopje op active
    const clickedBtn = Array.from(card.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tab) || b.getAttribute('onclick').includes(tab));
    if(clickedBtn) clickedBtn.classList.add('active');
}

function openEditModal(id) {
    const s = systems.find(x => x.id === id);
    if (!s) return;
    document.getElementById('editId').value = id;
    document.getElementById('editBrand').value = s.brand;
    document.getElementById('editModel').value = s.model;
    document.getElementById('editProcedure').value = s.procedure;
    document.getElementById('editSystemType').value = s.systemtype;
    
    const container = document.getElementById('editPartsContainer');
    container.innerHTML = '';
    const parts = Array.isArray(s.parts) ? s.parts : JSON.parse(s.parts || '[]');
    parts.forEach(p => addPartRow('edit', p.desc, p.art, p.supp));
    
    document.getElementById('editModal').classList.add('active');
}

function addPartRow(mode, desc = '', art = '', supp = 'Overig') {
    const div = document.createElement('div');
    div.className = 'part-input-row';
    div.innerHTML = `
        <input type="text" class="form-control part-desc" value="${desc}" placeholder="Omschrijving">
        <input type="text" class="form-control part-art" value="${art}" placeholder="Art. nr.">
        <select class="form-control part-supp">
            <option value="Overig" ${supp==='Overig'?'selected':''}>Overig</option>
            <option value="Wasco" ${supp==='Wasco'?'selected':''}>Wasco</option>
            <option value="Rensa" ${supp==='Rensa'?'selected':''}>Rensa</option>
        </select>
        <button type="button" onclick="this.parentElement.remove()">×</button>`;
    document.getElementById(mode + 'PartsContainer').appendChild(div);
}

function collectPartsData(mode) {
    const rows = document.querySelectorAll(`#${mode}PartsContainer .part-input-row`);
    return Array.from(rows).map(row => ({
        desc: row.querySelector('.part-desc')?.value.trim(),
        art: row.querySelector('.part-art')?.value.trim(),
        supp: row.querySelector('.part-supp')?.value
    })).filter(p => p.desc || p.art);
}

async function processChecksData(mode) {
    const rows = document.querySelectorAll(`#${mode}ChecksContainer .part-input-row`);
    return Array.from(rows).map(r => ({ subject: r.querySelector('.check-subject')?.value })).filter(c => c.subject);
}

function collectFaultsData(mode) { return []; }

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function initTheme() {
    const t = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', t);
}

// --- START ---
init();

// --- EXPORTS NAAR WINDOW (VOOR HTML ONCLICK) ---
window.handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    });
    if (error) alert(error.message); else location.reload();
};
window.calculateHVAC = calculateHVAC;
window.openCalcModal = () => document.getElementById('calcModal').classList.add('active');
window.closeCalcModal = () => document.getElementById('calcModal').classList.remove('active');
window.openLightbox = (src) => { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('active'); };
window.closeLightbox = () => document.getElementById('lightbox').classList.remove('active');
window.switchTab = switchTab;
window.openEditModal = openEditModal;
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.addPartRow = addPartRow;
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
