import { supabase } from './supabase-config.js';

let currentUser = null;
let currentUserRole = 'user';
let systems = [];
let favorites = [];
let currentEditingId = null;
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
    const screen = document.getElementById('pendingScreen');
    if (screen) screen.classList.remove('hidden');
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('pendingMessage').innerHTML = `Hoi <b>${email}</b>, je account moet nog worden goedgekeurd door de beheerder.`;
}

function updateUIForRole() {
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';
    const isAdmin = currentUserRole === 'admin';
    const addBtn = document.getElementById('addSystemBtn');
    const admBtn = document.getElementById('adminBtn');
    if(addBtn) addBtn.style.display = canEdit ? 'inline-flex' : 'none';
    if(admBtn) admBtn.style.display = isAdmin ? 'inline-flex' : 'none';
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
        filterSystems();
    } catch (error) { console.error(error); }
    finally { document.getElementById('loadingState')?.classList.add('hidden'); }
}

function updateBrandFilter() {
    const select = document.getElementById('brandFilter');
    if (!select) return;
    const brands = [...new Set(systems.map(s => s.brand))].sort();
    select.innerHTML = '<option value="all">Alle Merken</option>' + brands.map(b => `<option value="${b}">${b}</option>`).join('');
}

function filterSystems() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || "";
    const type = document.getElementById('systemTypeFilter')?.value || "";
    const brand = document.getElementById('brandFilter')?.value || "all";
    const favOnly = document.getElementById('favoritesFilter')?.value === 'favorites';

    const filtered = systems.filter(s => {
        const matchSearch = s.brand.toLowerCase().includes(term) || s.model.toLowerCase().includes(term);
        const matchType = !type || s.systemtype === type || (type === 'mv-wtw' && (s.systemtype === 'mv-wtw' || s.systemtype === 'wtw-mv'));
        const matchBrand = brand === 'all' || s.brand === brand;
        const matchFav = !favOnly || favorites.includes(s.id);
        return matchSearch && matchType && matchBrand && matchFav;
    });

    const grid = document.getElementById('cardsGrid');
    if (grid) {
        grid.innerHTML = filtered.map(s => createSystemCard(s)).join('');
        grid.classList.remove('hidden');
    }
    const countEl = document.getElementById('resultsCount');
    if(countEl) countEl.textContent = `${filtered.length} systemen gevonden`;
}

// --- 3. DE KAARTJES (HERSTELD MET ALLE 4 TABS) ---
function createSystemCard(s) {
    const isFav = favorites.includes(s.id);
    const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';

    // A. Materialen (JSONB & Links)
    let partsHtml = '';
    if (s.parts) {
        try {
            const parts = Array.isArray(s.parts) ? s.parts : JSON.parse(s.parts || '[]');
            if (parts.length > 0) {
                partsHtml = `<div class="parts-list"><table class="parts-table"><thead><tr><th>Artikel</th><th>Nr.</th><th>Lev.</th></tr></thead><tbody>`;
                partsHtml += parts.map(p => {
                    const cleanArt = p.art ? p.art.toString().replace(/[\s.]/g, '') : "";
                    let link = p.supp === 'Rensa' ? `https://rensa.nl/Product/${cleanArt}` : (p.supp === 'Wasco' ? `https://www.wasco.nl/artikel/${cleanArt}` : null);
                    return `<tr><td>${escapeHtml(p.desc)}</td><td>${link ? `<a href="${link}" target="_blank">${p.art} ↗</a>` : (p.art || '')}</td><td>${p.supp}</td></tr>`;
                }).join('');
                partsHtml += `</tbody></table></div>`;
            }
        } catch (e) { partsHtml = '<p>Geen materialen beschikbaar.</p>'; }
    }

    // B. Controlepunten (Controle Tab)
    let checksHtml = '';
    if (s.checks) {
        try {
            const checks = Array.isArray(s.checks) ? s.checks : JSON.parse(s.checks || '[]');
            checksHtml = checks.map(c => `
                <div class="check-card">
                    <div class="check-title">${escapeHtml(c.subject)}</div>
                    <div class="check-row"><b>Probleem:</b> ${escapeHtml(c.problem)}</div>
                    <div class="check-row"><b>Oplossing:</b> ${escapeHtml(c.solution)}</div>
                    ${c.imgUrl ? `<img src="${c.imgUrl}" class="check-img" onclick="openLightbox(this.src)">` : ''}
                </div>`).join('');
        } catch(e) { checksHtml = '<p>Geen controlepunten.</p>'; }
    }

    // C. Storingen (Storingen Tab)
    let faultsHtml = '';
    if (s.faults) {
        try {
            const faults = Array.isArray(s.faults) ? s.faults : JSON.parse(s.faults || '[]');
            faultsHtml = faults.map(f => `
                <div class="fault-row">
                    <div class="fault-code">${escapeHtml(f.code)}</div>
                    <div style="font-size:13px;"><b>Oorzaak:</b> ${escapeHtml(f.cause || f.problem || '')}<br><b>Oplossing:</b> ${escapeHtml(f.solution || f.sol || '')}</div>
                </div>`).join('');
        } catch(e) { faultsHtml = '<p>Geen storingen.</p>'; }
    }

    // D. O2 / CO2 Waarden
    let valuesHtml = '';
    if (s.o2_low || s.o2_high || s.maxco) {
        valuesHtml = `<div class="values-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0; background:rgba(33,141,141,0.05); padding:10px; border-radius:8px;">
            ${s.o2_low ? `<div><small>O₂ Laag</small><br><b>${s.o2_low}</b></div>` : ''}
            ${s.o2_high ? `<div><small>O₂ Hoog</small><br><b>${s.o2_high}</b></div>` : ''}
            ${s.maxco ? `<div><small>Max CO</small><br><b>${s.maxco} PPM</b></div>` : ''}
        </div>`;
    }

    // E. Galerij Foto's
    let galleryHtml = '';
    if (s.images && s.images.length > 0) {
        galleryHtml = `<div class="image-gallery">${s.images.map(img => `<div class="gallery-item"><img src="${img}" onclick="openLightbox(this.src)"></div>`).join('')}</div>`;
    }

    return `
    <div class="system-card" id="card-${s.id}">
      <div class="card-header">
        <div class="card-header-with-logo">
          ${s.logo_url ? `<img src="${s.logo_url}" class="brand-logo">` : ''}
          <div class="card-header-text">
            <div class="brand-label">${s.brand}</div>
            <div class="model-label">${s.model}</div>
            ${s.handbook_date && s.handbook_date !== '1900-01-01' ? `<div style="font-size:11px; color:orange;">📅 ${new Date(s.handbook_date).toLocaleDateString('nl-NL')}</div>` : ''}
          </div>
        </div>
        <div class="card-actions">
          ${s.device_image_url ? `<button class="icon-btn" onclick="openLightbox('${s.device_image_url}')">📷</button>` : ''}
          <button class="icon-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${s.id}')">★</button>
          ${canEdit ? `<button class="icon-btn" onclick="openEditModal('${s.id}')">✎</button>` : ''}
        </div>
      </div>

      <div class="tabs-nav">
        <button class="tab-btn active" onclick="switchTab('${s.id}', 'maint', this)">Info</button>
        <button class="tab-btn" onclick="switchTab('${s.id}', 'parts', this)">Materialen</button>
        <button class="tab-btn" onclick="switchTab('${s.id}', 'checks', this)">Controle</button>
        <button class="tab-btn" onclick="switchTab('${s.id}', 'faults', this)">Storingen</button>
      </div>

      <div id="content-maint-${s.id}" class="tab-content active">
        ${valuesHtml}
        <pre class="procedure-text">${s.procedure || 'Geen procedure.'}</pre>
        ${galleryHtml}
      </div>
      <div id="content-parts-${s.id}" class="tab-content">${partsHtml || '<p>Geen materialen.</p>'}</div>
      <div id="content-checks-${s.id}" class="tab-content">${checksHtml || '<p>Geen controlepunten.</p>'}</div>
      <div id="content-faults-${s.id}" class="tab-content">${faultsHtml || '<p>Geen storingen.</p>'}</div>
    </div>`;
}

// --- 4. CALCULATOR (NEN-NORM) ---
function calculateHVAC() {
    const Hs = 35.17;
    const rho = 983;
    const c = 4186;

    const start = parseFloat(document.getElementById('gasStart')?.value) || 0;
    const eind = parseFloat(document.getElementById('gasEind')?.value) || 0;
    const flow = parseFloat(document.getElementById('calcFlow')?.value) || 0;
    const tk = parseFloat(document.getElementById('calcTempKoud')?.value) || 0;
    const tw = parseFloat(document.getElementById('calcTempWarm')?.value) || 0;

    if (eind > start) {
        const belasting = ((eind - start) / 180) * Hs;
        document.getElementById('resBelastingHs').innerHTML = `Belasting (H<sub>s</sub>): <b>${belasting.toFixed(2)} kW</b>`;
        
        if (flow > 0 && tw > tk) {
            const vermogen = ((flow / 60) / 1000 * c * rho * (tw - tk)) / 1000;
            document.getElementById('resVermogen').innerHTML = `Vermogen (P): <b>${vermogen.toFixed(2)} kW</b>`;
            const rendement = (vermogen / belasting) * 100;
            const rEl = document.getElementById('resRendement');
            if (rEl) {
                rEl.textContent = rendement.toFixed(1) + '%';
                rEl.style.color = rendement > 90 ? 'var(--color-success)' : 'orange';
            }
        }
    }
}

// --- 5. OPSLAAN & BEWERKEN ---
async function handleEditSubmit(e) {
    if (e) e.preventDefault();
    const submitBtn = document.querySelector('#editForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Bezig...";
        const id = document.getElementById('editId').value;
        const partsArray = collectPartsData('edit');

        const updates = {
            brand: document.getElementById('editBrand').value.trim(),
            model: document.getElementById('editModel').value.trim(),
            procedure: document.getElementById('editProcedure').value,
            o2_low: document.getElementById('editO2Low')?.value || null,
            o2_high: document.getElementById('editO2High')?.value || null,
            parts: JSON.stringify(partsArray), // Voor TEXT kolom
            notes: document.getElementById('editNotes')?.value || null
        };

        const { error } = await supabase.from('systems').update(updates).eq('id', id);
        if (error) throw error;
        alert("✅ Bijgewerkt!");
        location.reload();
    } catch (err) { 
        alert("Fout: " + err.message); 
        submitBtn.disabled = false; 
        submitBtn.textContent = originalText;
    }
}

// --- 6. HELPERS ---
function switchTab(id, tab, btn) {
    const card = document.getElementById(`card-${id}`);
    if(!card) return;
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`content-${tab}-${id}`).classList.add('active');
    btn.classList.add('active');
}

function openEditModal(id) {
    const s = systems.find(x => x.id === id);
    if (!s) return;
    document.getElementById('editId').value = id;
    document.getElementById('editBrand').value = s.brand;
    document.getElementById('editModel').value = s.model;
    document.getElementById('editProcedure').value = s.procedure || '';
    document.getElementById('editO2Low').value = s.o2_low || '';
    document.getElementById('editO2High').value = s.o2_high || '';
    
    const cont = document.getElementById('editPartsContainer');
    cont.innerHTML = '';
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
            <option value="Overig" ${supp === 'Overig' ? 'selected' : ''}>Overig</option>
            <option value="Wasco" ${supp === 'Wasco' ? 'selected' : ''}>Wasco</option>
            <option value="Rensa" ${supp === 'Rensa' ? 'selected' : ''}>Rensa</option>
        </select>
        <button type="button" class="btn" style="padding: 5px 10px;" onclick="this.parentElement.remove()">×</button>`;
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

function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', window.handleLogin);
    document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
    document.getElementById('brandFilter')?.addEventListener('change', filterSystems);
    document.getElementById('systemTypeFilter')?.addEventListener('change', filterSystems);
    document.getElementById('favoritesFilter')?.addEventListener('change', filterSystems);
}

function initTheme() {
    const t = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', t);
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// --- START ---
init();

// --- EXPORTS NAAR WINDOW ---
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
window.calculateHVAC = calculateHVAC;
window.openLightbox = (src) => { document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('active'); };
window.closeLightbox = () => document.getElementById('lightbox').classList.remove('active');
window.switchTab = switchTab;
window.openEditModal = openEditModal;
window.closeEditModal = () => document.getElementById('editModal').classList.remove('active');
window.addPartRow = addPartRow;
window.toggleTheme = () => {
    const t = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
};
window.toggleFavorite = async (id) => {
    const isFav = favorites.includes(id);
    if (isFav) await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('system_id', id);
    else await supabase.from('favorites').insert({ user_id: currentUser.id, system_id: id });
    location.reload();
};
window.supabase = supabase;
