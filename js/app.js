import { supabase } from './supabase-config.js';

let currentUser = null;
let currentUserRole = 'user';
let systems = [];
let favorites = [];
let currentEditingId = null;
let allUsers = [];
let pendingImages = { add: [], edit: [] };

// --- 1. INITIALISATIE ---
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

// --- 2. DATA & FILTERS ---
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

// --- 3. DE KAARTJES (HERSTELD MET ALLE ITEMS) ---
function createSystemCard(system) {
    const isFav = favorites.includes(system.id);
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';

    // A. Bepaal tab-naam op basis van type
    let tabLabel = (['cv-ketel', 'warmtepomp'].includes(system.systemtype)) ? 'Afstelling' : 'Info';

    // B. Materialen
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

    // C. Controlepunten
    let checksContent = '';
    if (system.checks) {
        try {
            const checks = Array.isArray(system.checks) ? system.checks : JSON.parse(system.checks);
            checksContent = checks.map(c => `
                <div class="check-card">
                    <div class="check-title">${escapeHtml(c.subject)}</div>
                    <div class="check-row"><div class="check-label">Probleem:</div><div>${escapeHtml(c.problem)}</div></div>
                    <div class="check-row"><div class="check-label">Oplossing:</div><div>${escapeHtml(c.solution)}</div></div>
                    ${c.imgUrl ? `<img src="${c.imgUrl}" class="check-img" onclick="openLightbox(this.src)">` : ''}
                </div>`).join('');
        } catch(e) { checksContent = '<p>Geen aandachtspunten.</p>'; }
    }

    // D. Storingen
    let faultsContent = '';
    if (system.faults) {
        try {
            const faults = Array.isArray(system.faults) ? system.faults : JSON.parse(system.faults);
            faultsContent = faults.map(f => `
                <div class="fault-row">
                    <div class="fault-code">${escapeHtml(f.code)}</div>
                    <div style="font-size:13px;">
                        <div><b>Oorzaak:</b> ${escapeHtml(f.cause || f.problem || '')}</div>
                        <div><b>Oplossing:</b> ${escapeHtml(f.solution || f.sol || '')}</div>
                    </div>
                </div>`).join('');
        } catch(e) { faultsContent = '<p>Geen storingen.</p>'; }
    }

    // E. Galerij
    let galleryHtml = '';
    if (system.images && system.images.length > 0) {
        galleryHtml = `<div class="image-gallery">${system.images.map(img => `<div class="gallery-item"><img src="${img}" onclick="openLightbox(this.src)"></div>`).join('')}</div>`;
    }

    // F. Waardes (O2/CO2)
    let valuesHtml = '';
    if (system.o2_low || system.o2_high || system.maxco) {
        valuesHtml = `<div class="values-grid">
            ${system.o2_low ? `<div class="value-item"><div class="value-label">O₂ Laag</div><div class="value-number">${system.o2_low}</div></div>` : ''}
            ${system.o2_high ? `<div class="value-item"><div class="value-label">O₂ Hoog</div><div class="value-number">${system.o2_high}</div></div>` : ''}
            ${system.maxco ? `<div class="value-item"><div class="value-label">Max CO</div><div class="value-number">${system.maxco} PPM</div></div>` : ''}
        </div>`;
    }

    return `
    <div class="system-card" id="card-${system.id}">
      <div class="card-header">
        <div class="card-header-with-logo">
          ${system.logo_url ? `<img src="${system.logo_url}" class="brand-logo">` : ''}
          <div class="card-header-text">
            <div class="brand-label">${system.brand}</div>
            <div class="model-label">${system.model}</div>
            ${system.handbook_date && system.handbook_date !== '1900-01-01' ? `<div class="card-meta">📅 ${new Date(system.handbook_date).toLocaleDateString('nl-NL')}</div>` : ''}
            ${system.manual_url ? `<a href="${system.manual_url}" target="_blank" class="btn-link">Open handleiding ↗</a>` : ''}
          </div>
        </div>
        <div class="card-actions">
          ${system.device_image_url ? `<button class="icon-btn" onclick="openLightbox('${system.device_image_url}')">📷</button>` : ''}
          <button class="icon-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${system.id}')">★</button>
          ${canEdit ? `<button class="icon-btn" onclick="openEditModal('${system.id}')">✎</button>` : ''}
        </div>
      </div>

      <div class="tabs-nav">
        <button class="tab-btn active" data-tab="maint" onclick="switchTab('${system.id}', 'maint')">${tabLabel}</button>
        <button class="tab-btn" data-tab="parts" onclick="switchTab('${system.id}', 'parts')">Materialen</button>
        <button class="tab-btn" data-tab="checks" onclick="switchTab('${system.id}', 'checks')">Controle</button>
        <button class="tab-btn" data-tab="faults" onclick="switchTab('${system.id}', 'faults')">Storingen</button>
      </div>

      <div id="content-maint-${system.id}" class="tab-content active">
        <pre class="procedure-text">${system.procedure}</pre>
        ${valuesHtml}
        ${galleryHtml}
        ${system.notes ? `<div class="notes-section"><b>Opmerkingen:</b><br>${system.notes}</div>` : ''}
      </div>
      <div id="content-parts-${system.id}" class="tab-content">${materialsContent || 'Geen materialen.'}</div>
      <div id="content-checks-${system.id}" class="tab-content">${checksContent || 'Geen aandachtspunten.'}</div>
      <div id="content-faults-${system.id}" class="tab-content">${faultsContent || 'Geen storingen.'}</div>
    </div>`;
}

// --- 4. FUNCTIES & EVENTS ---
function switchTab(id, tabName) {
    const card = document.getElementById(`card-${id}`);
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    card.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`content-${tabName}-${id}`).classList.add('active');
}

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
            faults: collectFaultsData('edit'),
            checks: await processChecksData('edit'),
            notes: document.getElementById('editNotes')?.value || null,
            o2_low: document.getElementById('editO2Low')?.value || null,
            o2_high: document.getElementById('editO2High')?.value || null,
            maxco: document.getElementById('editMaxCO')?.value || null
        };

        const { error } = await supabase.from('systems').update(updates).eq('id', id);
        if (error) throw error;
        alert("✅ Bijgewerkt!");
        location.reload();
    } catch (err) { alert(err.message); submitBtn.disabled = false; }
}

function initTheme() {
    const saved = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.body.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// --- 5. HELPERS ---
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

function collectFaultsData(mode) {
    const rows = document.querySelectorAll(`#${mode}FaultsContainer .part-input-row`);
    return Array.from(rows).map(row => ({
        code: row.querySelector('.fault-code-input')?.value.trim(),
        cause: row.querySelector('.fault-cause-input')?.value.trim(),
        solution: row.querySelector('.fault-sol-input')?.value.trim()
    })).filter(f => f.code);
}

// --- 6. EXPORTS & START ---
window.toggleTheme = toggleTheme;
window.handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    });
    if (error) alert(error.message); else location.reload();
};
window.openCalcModal = () => document.getElementById('calcModal').classList.add('active');
window.closeCalcModal = () => document.getElementById('calcModal').classList.remove('active');
window.openLightbox = (src) => { 
    document.getElementById('lightboxImg').src = src; 
    document.getElementById('lightbox').classList.add('active'); 
};
window.closeLightbox = () => document.getElementById('lightbox').classList.remove('active');
window.toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    if (isFav) await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('system_id', id);
    else await supabase.from('favorites').insert({ user_id: currentUser.id, system_id: id });
    location.reload();
};
window.switchTab = switchTab;
window.openEditModal = (id) => {
    const s = systems.find(x => x.id === id);
    if (!s) return;
    document.getElementById('editId').value = id;
    document.getElementById('editBrand').value = s.brand;
    document.getElementById('editModel').value = s.model;
    document.getElementById('editProcedure').value = s.procedure;
    document.getElementById('editSystemType').value = s.systemtype;
    
    // Herstel parts
    const cont = document.getElementById('editPartsContainer');
    cont.innerHTML = '';
    const parts = Array.isArray(s.parts) ? s.parts : JSON.parse(s.parts || '[]');
    parts.forEach(p => addPartRow('edit', p.desc, p.art, p.supp));

    document.getElementById('editModal').classList.add('active');
};
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.addPartRow = (mode, desc='', art='', supp='Overig') => {
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
    document.getElementById(`${mode}PartsContainer`).appendChild(div);
};

// UI helpers
function showAuth() { document.getElementById('authContainer').classList.remove('hidden'); document.getElementById('appContainer').classList.add('hidden'); }
function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', window.handleLogin);
    document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
    document.getElementById('brandFilter')?.addEventListener('change', () => { updateModelFilter(); filterSystems(); });
    document.getElementById('modelFilter')?.addEventListener('change', filterSystems);
    document.getElementById('systemTypeFilter')?.addEventListener('change', filterSystems);
    document.getElementById('favoritesFilter')?.addEventListener('change', filterSystems);
}
function updateBrandFilter() {
    const select = document.getElementById('brandFilter');
    const brands = [...new Set(systems.map(s => s.brand))].sort();
    select.innerHTML = '<option value="all">Alle Merken</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
}
function updateModelFilter() {
    const brand = document.getElementById('brandFilter').value;
    const select = document.getElementById('modelFilter');
    const filtered = brand === 'all' ? systems : systems.filter(s => s.brand === brand);
    const models = [...new Set(filtered.map(s => s.model))].sort();
    select.innerHTML = '<option value="all">Alle Modellen</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
}
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

init();
