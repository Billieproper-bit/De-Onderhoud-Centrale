import { supabase } from './supabase-config.js';
// Als je de upload-functies ook apart hebt gezet:
// import { uploadImages } from './storage-service.js';

    let currentUser = null;
    let currentUserRole = 'user';
    let systems = [];
    let favorites = [];
    let currentEditingId = null;
    let allUsers = [];
    let pendingImages = { add: [], edit: [] };
    let auditLogs = [];
    let auditFilterTerm = '';

    function activateEasterEgg() {
      
      const themes = [
        { bg: '#6C10F3', text: '#43EDC2' }, // Paars & Teal
        { bg: '#163C64', text: '#F76648' }, // Donkerblauw & Oranje
        { bg: '#DFDE2F', text: '#1E1D1C' },  // Geel & Donkergrijs
        { bg: '#FAD0C9', text: '#6E6E6D' } // Roze & Grijs
      ];
      
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
            
      const target = document.documentElement;
      
      const props = {
        '--color-bg-primary': randomTheme.bg,
        '--color-surface': randomTheme.bg,
        '--color-text': randomTheme.text,
        '--color-text-secondary': randomTheme.text,
        '--color-primary': randomTheme.text,
        '--color-border': randomTheme.text,
        '--color-card-border': randomTheme.text,
        '--color-warning': randomTheme.text,
        '--color-success': randomTheme.text,
        '--color-error': randomTheme.text
      };
      
      for (const [key, value] of Object.entries(props)) {
        target.style.setProperty(key, value, 'important');
      }

      console.log('🐣 Easter Egg geactiveerd!');
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        currentUser = session.user;
        // Check of de gebruiker is goedgekeurd
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
          currentUser = session.user;
          const isApproved = await checkUserApproval(session.user);
          if (isApproved) {
            showApp();
            loadData();
          } else {
            showPendingScreen(session.user.email);
          }
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          showAuth();
        }
      });

      setupEventListeners();
      initTheme();
    }

    // NIEUW: Deze functie checkt de database
    async function checkUserApproval(user) {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_approved')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        // Als er geen rij is, maken we er eentje aan (standaard niet goedgekeurd)
        if (!data) {
          await supabase.from('user_roles').insert([
            { user_id: user.id, email: user.email, is_approved: false }
          ]);
          return false;
        }
        
        return data.is_approved;
      } catch (err) {
        console.error("Fout bij checken goedkeuring:", err);
        return false;
      }
    }

    // NIEUW: Deze functie toont het 'Wacht' scherm
    function showPendingScreen(email) {
      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('appContainer').classList.add('hidden');
      
      let pendingDiv = document.getElementById('pendingScreen');
      if (!pendingDiv) {
        pendingDiv = document.createElement('div');
        pendingDiv.id = 'pendingScreen';
        pendingDiv.style = "display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px; font-family:sans-serif; color:#134252;";
        document.body.appendChild(pendingDiv);
      }
      
      pendingDiv.innerHTML = `
        <h1 style="font-size: 24px; margin-bottom: 10px;">Toegang in afwachting ⏳</h1>
        <p style="margin-bottom: 20px;">Hoi <b>${email}</b>, je account moet nog worden goedgekeurd door de beheerder.</p>
        <button onclick="location.reload()" style="background:#218D8D; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; margin-bottom:10px;">Check opnieuw</button>
        <br>
        <button onclick="supabase.auth.signOut()" style="background:none; border:none; color:#c0152f; cursor:pointer; text-decoration:underline;">Uitloggen</button>
      `;
      pendingDiv.classList.remove('hidden');
    }

    function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('adminBtn').addEventListener('click', openAdminModal);
    document.getElementById('addSystemBtn').addEventListener('click', openAddModal);
    document.getElementById('auditBtn').addEventListener('click', openAuditModal);
    document.getElementById('auditSearchInput')?.addEventListener('input', filterAuditLogs);
    document.getElementById('copyrightName').addEventListener('click', activateEasterEgg);
    
    document.getElementById('systemTypeFilter').addEventListener('change', () => {
        updateBrandFilter(); 
        updateModelFilter(); 
        filterSystems();     
    });

    document.getElementById('brandFilter').addEventListener('change', () => {
        updateModelFilter(); 
        filterSystems();     
    });

    document.getElementById('modelFilter').addEventListener('change', filterSystems);
    document.getElementById('favoritesFilter').addEventListener('change', filterSystems);
    document.getElementById('addForm').addEventListener('submit', handleAddSubmit);
    document.getElementById('editForm').addEventListener('submit', handleEditSubmit);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
      
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    const adminActions = document.getElementById('adminActions');
    if (adminToggleBtn) { 
        adminToggleBtn.addEventListener('click', () => adminActions.classList.toggle('open'));
    } 
    const scrollBtn = document.getElementById('scrollTopBtn');
      if (scrollBtn) {
        window.addEventListener('scroll', () => {
            if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
                scrollBtn.style.display = "flex";
            } else {
                scrollBtn.style.display = "none";
            }
        });

        scrollBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

    function showAuth() {
      document.getElementById('authContainer').classList.remove('hidden');
      document.getElementById('appContainer').classList.add('hidden');
    }

    async function showApp() {
      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
      document.getElementById('userEmail').textContent = currentUser?.email;
      await loadUserRole();
      updateUIForRole();
    }

    async function loadUserRole() {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id)
          .single();
        if (!error && data) currentUserRole = data.role;
        else currentUserRole = 'user';
      } catch {
        currentUserRole = 'user';
      }
    }

    function updateUIForRole() {
      const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';
      const isAdmin = currentUserRole === 'admin';
      document.getElementById('addSystemBtn').style.display = canEdit ? 'inline-flex' : 'none';
      document.getElementById('adminBtn').style.display = isAdmin ? 'inline-flex' : 'none';
      document.getElementById('auditBtn').style.display = isAdmin ? 'inline-flex' : 'none';
      document.getElementById('adminToggleBtn').style.display = canEdit ? 'inline-flex' : 'none';
      document.querySelectorAll('.icon-btn[onclick*="openEditModal"]').forEach(btn => {
        btn.style.display = canEdit ? 'block' : 'none';
      });
      
      checkPendingNotifications();
    }

    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;

      const password = document.getElementById('loginPassword').value;
      
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('Login mislukt: ' + error.message);
      document.getElementById('loginForm').reset();
    }

    async function handleLogout() {
      await supabase.auth.signOut();
    }

    async function loadData() {
      document.getElementById('loadingState').classList.remove('hidden');
      document.getElementById('cardsGrid').classList.add('hidden');
      try {
        const { data: systemsData, error: systemsError } = await supabase
          .from('systems')
          .select('*')
          .order('brand', { ascending: true })
          .order('model', { ascending: true });
        if (systemsError) throw systemsError;
        systems = systemsData;

        if (currentUser) {
          const { data: favsData } = await supabase
            .from('favorites')
            .select('system_id')
            .eq('user_id', currentUser.id);
          favorites = favsData ? favsData.map(f => f.system_id) : [];
        }
        updateBrandFilter();
        // Model filter updaten we pas als er een merk gekozen is, of initieel op 'alles'
        updateModelFilter(); 
        filterSystems();
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Fout bij laden van gegevens: ' + error.message);
      } finally {
        document.getElementById('loadingState').classList.add('hidden');
      }
    }

    function updateBrandFilter() {
      const selectedType = document.getElementById('systemTypeFilter').value;
      const select = document.getElementById('brandFilter');
      const currentVal = select.value; // Onthoud wat er gekozen was
      
      // Stap 1: Filter alles op basis van categorie
      let availableSystems = systems;
      if (selectedType) {
          if (selectedType === 'mv-wtw') {
              availableSystems = systems.filter(s => s.systemtype === 'mv-wtw' || s.systemtype === 'wtw-mv');
          } else {
              availableSystems = systems.filter(s => s.systemtype === selectedType);
          }
      }

      // Stap 2: Maak de lijst met merken
      const brands = [...new Set(availableSystems.map(s => s.brand))].sort();
      
      select.innerHTML = '<option value="all">Alle Merken</option>';
      brands.forEach(brand => {
        const option = document.createElement('option');
        option.value = brand;
        option.textContent = brand;
        select.appendChild(option);
      });

      // Stap 3: Probeer de oude keuze te herstellen, anders reset naar 'all'
      if(brands.includes(currentVal)) {
          select.value = currentVal;
      } else {
          select.value = 'all';
      }
    }

    function updateModelFilter() {
        const selectedType = document.getElementById('systemTypeFilter').value;
        const selectedBrand = document.getElementById('brandFilter').value;
        const modelSelect = document.getElementById('modelFilter');
        
        // Reset de lijst
        modelSelect.innerHTML = '<option value="all">Alle Modellen</option>';

        // Stap 1: Begin met alle systemen
        let availableSystems = systems;

        // Stap 2: Filter eerst op Categorie (indien gekozen)
        if (selectedType) {
            if (selectedType === 'mv-wtw') {
                availableSystems = availableSystems.filter(s => s.systemtype === 'mv-wtw' || s.systemtype === 'wtw-mv');
            } else {
                availableSystems = availableSystems.filter(s => s.systemtype === selectedType);
            }
        }

        // Stap 3: Filter daarna op Merk (DIT IS CRUCIAAL)
        if (selectedBrand !== 'all') {
            availableSystems = availableSystems.filter(s => s.brand === selectedBrand);
        }

        // Stap 4: Vul de dropdown met de overgebleven modellen
        const models = [...new Set(availableSystems.map(s => s.model))].sort();
        
        if (models.length > 0) {
            modelSelect.disabled = false;
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        } else {
            modelSelect.disabled = false; 
        }
    }

    function filterSystems() {
      const selectedType = document.getElementById('systemTypeFilter').value; 
      const selectedBrand = document.getElementById('brandFilter').value;
      const selectedModel = document.getElementById('modelFilter').value;
      const showFavoritesOnly = document.getElementById('favoritesFilter').value === 'favorites';

      const filtered = systems.filter(system => {
        
        // 1. Type filter
        let matchesType = true;
        if (selectedType) { 
            if (selectedType === 'mv-wtw') {
                matchesType = system.systemtype === 'mv-wtw' || system.systemtype === 'wtw-mv';
            } else {
                // Werkt nu ook voor waterzijdig en overig
                matchesType = system.systemtype === selectedType;
            }
        }

        // 2. Merk filter
        const matchesBrand = selectedBrand === 'all' || system.brand === selectedBrand;
        
        // 3. Model filter
        const matchesModel = selectedModel === 'all' || system.model === selectedModel;

        // 4. Favorieten filter
        const matchesFavorites = !showFavoritesOnly || favorites.includes(system.id);

        return matchesType && matchesBrand && matchesModel && matchesFavorites;
      });

      renderSystems(filtered);
      updateResultsCount(filtered.length);
    }

    function updateResultsCount(count) {
      const text = count === 1 ? 'systeem gevonden' : 'systemen gevonden';
      const favText = favorites.length === 0 ? '' : ' | ' + favorites.length + ' favorieten totaal';
      document.getElementById('resultsCount').textContent = count + ' ' + text + favText;
    }

    function renderSystems(systemsList) {
      const grid = document.getElementById('cardsGrid');
      const emptyState = document.getElementById('emptyState');
      if (systemsList.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
      }
      grid.classList.remove('hidden');
      emptyState.classList.add('hidden');
      grid.innerHTML = systemsList.map(system => createSystemCard(system)).join('');
    }

    // 1. Invulregel toevoegen (Met foto upload mogelijkheid)
    function addCheckRow(mode, subject = '', problem = '', solution = '', imgUrl = '') {
      const container = document.getElementById(mode + 'ChecksContainer');
      const div = document.createElement('div');
      div.className = 'part-input-row';
      div.style.display = 'block'; // Overschrijf grid voor meer ruimte
      div.style.border = '1px solid var(--color-border)';
      div.style.padding = '8px';
      div.style.borderRadius = '8px';
      
      div.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
            <input type="text" placeholder="Onderwerp (bijv. Sifon)" class="form-control check-subject" value="${escapeInput(subject)}">
            <input type="file" class="form-control check-file" accept="image/*">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
            <textarea placeholder="Wat kan er mis zijn?" class="form-control check-problem" rows="2">${escapeInput(problem)}</textarea>
            <textarea placeholder="Oplossing" class="form-control check-solution" rows="2">${escapeInput(solution)}</textarea>
        </div>
        
        <!-- Verborgen veld om oude URL te onthouden bij bewerken -->
        <input type="hidden" class="check-existing-url" value="${imgUrl}">
        ${imgUrl ? `<div style="font-size:12px; color:green;">✓ Huidige foto: <a href="${imgUrl}" target="_blank">Bekijk</a></div>` : ''}
        
        <button type="button" class="btn" style="width:100%; margin-top:4px; color:var(--color-error); border-color:var(--color-error);" onclick="this.parentElement.remove()">Verwijder dit controlepunt</button>
      `;
      container.appendChild(div);
    }

    // 2. Formulier vullen (bij bewerken)
    function populateChecksForm(mode, jsonString) {
      const container = document.getElementById(mode + 'ChecksContainer');
      container.innerHTML = '';
      if (!jsonString) return;
      try {
        const checks = JSON.parse(jsonString);
        if (Array.isArray(checks)) {
          checks.forEach(c => addCheckRow(mode, c.subject, c.problem, c.solution, c.imgUrl));
        }
      } catch (e) { console.error('Fout bij laden checks', e); }
    }

     // Deze functie is 'async' omdat hij moet wachten op uploads
    async function processChecksData(mode) {
      const container = document.getElementById(mode + 'ChecksContainer');
      const rows = Array.from(container.children); // Maak er een array van
      const checks = [];

      for (const row of rows) {
        const subject = row.querySelector('.check-subject').value.trim();
        const problem = row.querySelector('.check-problem').value.trim();
        const solution = row.querySelector('.check-solution').value.trim();
        const fileInput = row.querySelector('.check-file');
        const existingUrl = row.querySelector('.check-existing-url').value;

        if (!subject && !problem) continue; // Lege regels overslaan

        let finalImageUrl = existingUrl;

        // Als er een nieuwe foto is gekozen, uploaden we die nu direct
        if (fileInput.files.length > 0) {
           const file = fileInput.files[0];
           const fileExt = file.name.split('.').pop();
           const fileName = 'check-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.' + fileExt;
           
           try {
             const { data, error } = await supabase.storage
               .from('system-images')
               .upload(fileName, file, { upsert: true });
               
             if (!error) {
               finalImageUrl = 'https://srsnjifezttivawxnndu.supabase.co/storage/v1/object/public/system-images/' + fileName;
             }
           } catch(err) {
             console.error('Foto upload fout bij controlepunt', err);
           }
        }

        checks.push({ subject, problem, solution, imgUrl: finalImageUrl });
      }

      return checks.length > 0 ? JSON.stringify(checks) : null;
    }
    
    function createSystemCard(system) {
      const isFavorite = favorites.includes(system.id);
      const canEdit = currentUserRole === 'admin' || currentUserRole === 'moderator';
      
      // --- TAB NAAM LOGICA ---
      let tabLabel = 'Afstelling';
      let procedureTitle = 'Afstelprocedure';

      if (['rookgasafvoer', 'appendages', 'waterzijdig', 'collectief', 'overig', 'thermostaten'].includes(system.systemtype)) {
          tabLabel = 'Inspectie';
          procedureTitle = 'Inspectieprocedure';
      } else if (system.systemtype === 'mv-wtw' || system.systemtype === 'wtw-mv') {
          tabLabel = 'Onderhoud';
          procedureTitle = 'Onderhoudsprocedure';
      }

      // 1. Content: EERSTE TABBLAD (Onderhoud/Afstelling/Inspectie)
      let maintenanceContent = `
          <div class="card-section">
            <div class="card-section-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              ${procedureTitle}
            </div>
            <div class="procedure-text">${escapeHtml(system.procedure) || 'Geen procedure opgegeven'}</div>
          </div>
      `;

      // Waardes
      if (system.o2_low || system.o2_high || system.co2_low || system.co2_high || system.maxco) {
        maintenanceContent += '<div class="card-section"><div class="card-section-title">Doelwaarden</div><div class="values-grid">' +
          (system.o2_low ? '<div class="value-item"><span class="value-icon" style="color: var(--color-success);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span><div class="value-content"><div class="value-label">O₂ Laaglast</div><div class="value-number">' + escapeHtml(system.o2_low) + '</div></div></div>' : '') +
          (system.o2_high ? '<div class="value-item"><span class="value-icon" style="color: var(--color-success);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span><div class="value-content"><div class="value-label">O₂ Hooglast</div><div class="value-number">' + escapeHtml(system.o2_high) + '</div></div></div>' : '') +
          (system.co2_low ? '<div class="value-item"><span class="value-icon" style="color: var(--color-text-secondary);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg></span><div class="value-content"><div class="value-label">CO₂ Laaglast</div><div class="value-number">' + escapeHtml(system.co2_low) + '</div></div></div>' : '') +
          (system.co2_high ? '<div class="value-item"><span class="value-icon" style="color: var(--color-text-secondary);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg></span><div class="value-content"><div class="value-label">CO₂ Hooglast</div><div class="value-number">' + escapeHtml(system.co2_high) + '</div></div></div>' : '') +
          (system.maxco ? '<div class="value-item"><span class="value-icon" style="color: var(--color-warning);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></span><div class="value-content"><div class="value-label">Max PPM CO</div><div class="value-number">' + escapeHtml(system.maxco) + '</div></div></div>' : '') +
          '</div></div>';
      }

      // Fotos
      if (system.images && system.images.length > 0) {
        const imagesList = system.images.map((img, idx) => 
          `<div class="gallery-item" onclick="openLightbox(this.querySelector('img').src)">
             <img src="${escapeHtml(img)}" alt="Foto ${idx + 1}" loading="lazy">
           </div>`
        ).join('');
        maintenanceContent += `<div class="card-section"><div class="card-section-title">Fotos</div><div class="image-gallery">${imagesList}</div></div>`;
      }

      // Opmerkingen
      if (system.notes) {
        maintenanceContent += `<div class="notes-section"><div class="notes-title">Opmerkingen</div><div class="notes-text">${escapeHtml(system.notes)}</div></div>`;
      }

      // 2. Content: MATERIALEN
      let materialsContent = '';
      if (system.parts) {
         try {
           const parts = JSON.parse(system.parts);
           if (Array.isArray(parts) && parts.length > 0) {
             materialsContent = '<div class="parts-list"><div class="parts-title" style="display:flex; align-items:center; gap:8px;"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>Benodigde pakkingen/artikelen</div><table class="parts-table"><thead><tr><th>Artikel</th><th>Art. nr.</th><th>Lev.</th></tr></thead><tbody>';
             
             materialsContent += parts.map(p => {
               const badgeClass = p.supp === 'Rensa' ? 'supplier-rensa' : (p.supp === 'Wasco' ? 'supplier-wasco' : 'supplier-other');
               
               // Haal het artikelnummer op en haal spaties weg
               const rawArt = p.art ? p.art.toString().trim() : "";
               const displayArt = escapeHtml(rawArt);
               
               // Bouw de link alleen als er een artikelnummer is
               let link = null;
               if (rawArt) {
                 if (p.supp === 'Rensa') link = `https://rensa.nl/Product/${rawArt}`;
                 else if (p.supp === 'Wasco') link = `https://www.wasco.nl/artikel/${rawArt}`;
               }

               const artLinkHtml = link 
                 ? `<a href="${link}" target="_blank" style="color:var(--color-primary); text-decoration:none; border-bottom:1px dotted;">${displayArt} ↗</a>` 
                 : displayArt;

               return `<tr><td>${escapeHtml(p.desc)}</td><td style="font-family:monospace;">${artLinkHtml}</td><td><span class="supplier-badge ${badgeClass}">${escapeHtml(p.supp)}</span></td></tr>`;
             }).join('');
             
             materialsContent += '</tbody></table></div>';
           } else {
             materialsContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Geen materialenlijst beschikbaar.</div>';
           }
         } catch(e) { 
             console.error("JSON parse error bij parts:", e);
             materialsContent = `<div class="parts-list"><div class="parts-title">Benodigde materialen</div><div class="parts-text">${escapeHtml(system.parts)}</div></div>`; 
         }
      } else {
         materialsContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Geen materialen toegevoegd.</div>';
      }

      // 3. Content: CONTROLE
      let checksContent = '';
      if (system.checks) {
        try {
            const checks = JSON.parse(system.checks);
            if (Array.isArray(checks) && checks.length > 0) {
                checksContent = checks.map(c => `
                    <div class="check-card">
                        <div class="check-title">${escapeHtml(c.subject)}</div>
                        <div class="check-row">
                            <div class="check-label">Probleem:</div>
                            <div>${escapeHtml(c.problem)}</div>
                        </div>
                        <div class="check-row">
                            <div class="check-label">Oplossing:</div>
                            <div>${escapeHtml(c.solution)}</div>
                        </div>
                        ${c.imgUrl ? `<img src="${c.imgUrl}" class="check-img" onclick="openLightbox(this.src)" loading="lazy" alt="Foto bij ${escapeHtml(c.subject)}">` : ''}
                    </div>
                `).join('');
            } else {
                checksContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Geen aandachtspunten bekend.</div>';
            }
        } catch(e) { checksContent = 'Data error'; }
      } else {
        checksContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Nog geen aandachtspunten toegevoegd.</div>';
      }

      // 4. Content: STORINGEN
      let faultsContent = '';
      if (system.faults) {
        try {
            const faults = JSON.parse(system.faults);
            if (Array.isArray(faults) && faults.length > 0) {
                faultsContent = faults.map(f => {
                    const cause = f.cause || '';
                    const solution = f.solution || f.sol || '';
                    return `
                    <div class="fault-row">
                        <div class="fault-code">${escapeHtml(f.code)}</div>
                        <div style="font-size:13px; color:var(--color-text);">
                            ${cause ? `<div class="fault-detail-item"><span class="fault-label">Oorzaak:</span>${escapeHtml(cause)}</div>` : ''}
                            ${solution ? `<div class="fault-detail-item"><span class="fault-label">Oplossing:</span>${escapeHtml(solution)}</div>` : ''}
                        </div>
                    </div>
                `}).join('');
            } else {
                faultsContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Geen storingen bekend.</div>';
            }
        } catch(e) { faultsContent = 'Data error'; }
      } else {
        faultsContent = '<div style="padding:20px; text-align:center; color:var(--color-text-secondary);">Nog geen storingen toegevoegd.</div>';
      }

      return `
        <div class="system-card" id="card-${system.id}">
          <div class="card-header">
            <div class="card-header-with-logo">
              ${system.logo_url ? '<img src="' + escapeHtml(system.logo_url) + '" alt="logo" class="brand-logo" onerror="this.style.display=\'none\'">' : ''}
              
              <div class="card-header-text">
                <div class="brand-label">${escapeHtml(system.brand)}</div>
                <div class="model-label">${escapeHtml(system.model)}</div>
                
                <!-- DATUM + LINK SECTIE -->
                <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                    ${system.handbook_date ? '<div class="card-meta">📅 Handleiding: ' + new Date(system.handbook_date).toLocaleDateString('nl-NL') + '</div>' : ''}
                    
                    ${system.manual_url ? `
                        <a href="${escapeHtml(system.manual_url)}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--color-primary); text-decoration: none; font-weight: 500;">
                            <svg class="icon" style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            Open handleiding
                        </a>
                    ` : ''}
                </div>
              </div>
            </div>
            
            <div class="card-actions">
              ${system.device_image_url ? `
              <button class="icon-btn" onclick="openLightbox('${system.device_image_url}')" title="Bekijk toestel">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </button>
              ` : ''}
              <button class="icon-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${system.id}')">
                <svg class="icon" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
              </button>
              ${canEdit ? `
                <button class="icon-btn" onclick="openEditModal('${system.id}')"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                <button class="icon-btn" onclick="deleteSystem('${system.id}')" style="color: var(--color-error);"><svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
              ` : ''}
            </div>
          </div>

          <div class="tabs-nav">
            <button class="tab-btn active" data-tab="maint" onclick="switchTab('${system.id}', 'maint')">${tabLabel}</button>
            <button class="tab-btn" data-tab="parts" onclick="switchTab('${system.id}', 'parts')">Materialen</button>
            <button class="tab-btn" data-tab="checks" onclick="switchTab('${system.id}', 'checks')">Controle</button>
            <button class="tab-btn" data-tab="faults" onclick="switchTab('${system.id}', 'faults')">Storingen</button>
          </div>

          <div id="content-maint-${system.id}" class="tab-content active">
             ${maintenanceContent}
          </div>
          <div id="content-parts-${system.id}" class="tab-content">
             ${materialsContent}
          </div>
          <div id="content-checks-${system.id}" class="tab-content">
             ${checksContent}
          </div>
          <div id="content-faults-${system.id}" class="tab-content">
             ${faultsContent}
          </div>
        </div>
      `;
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function initTheme() {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) document.body.setAttribute('data-theme', savedTheme);
      updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
      const icon = document.getElementById('themeIcon');
      if (theme === 'dark') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
      } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>';
      }
    }

    async function openAdminModal() {
      document.getElementById('adminModal').classList.add('active');
      await loadUsers();
      await loadPendingUsers();
    }

    function closeAdminModal() {
      document.getElementById('adminModal').classList.remove('active');
    }

    async function openAuditModal() {
      document.getElementById('auditModal').classList.add('active');
      await loadAuditLogs();
    }

    function closeAuditModal() {
      document.getElementById('auditModal').classList.remove('active');
    }

    async function loadAuditLogs() {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(200);
        if (error) throw error;
        auditLogs = data || [];
        renderAuditTable(auditLogs);
      } catch (error) {
        console.error('Error loading audit logs:', error);
        document.getElementById('auditTableBody').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-error);">Fout bij laden logboek</td></tr>';
      }
    }

    function renderAuditTable(logs) {
      const tbody = document.getElementById('auditTableBody');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Geen logboekitems gevonden</td></tr>';
        return;
      }
      tbody.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp).toLocaleString('nl-NL');
        const actionLabel = log.action === 'system_created' ? '✨ Systeem aangemaakt' : 
                           log.action === 'system_updated' ? '✏️ Systeem bijgewerkt' : 
                           log.action === 'role_change' ? '👤 Rol gewijzigd' : log.action;
        return '<tr><td style="font-size: 13px;">' + date + '</td><td>' + escapeHtml(log.user_email) + '</td><td>' + actionLabel + '</td><td style="font-size: 13px; max-width: 300px; word-break: break-word;">' + escapeHtml(log.details || '') + '</td></tr>';
      }).join('');
    }

    function filterAuditLogs() {
      auditFilterTerm = document.getElementById('auditSearchInput').value.toLowerCase();
      const filtered = auditLogs.filter(log => {
        return (log.user_email?.toLowerCase().includes(auditFilterTerm)) ||
               (log.action?.toLowerCase().includes(auditFilterTerm)) ||
               (log.details?.toLowerCase().includes(auditFilterTerm));
      });
      renderAuditTable(filtered);
    }

    async function loadUsers() {
      try {
        const { data, error } = await supabase
          .rpc('get_all_users_with_roles')
          .order('email', { ascending: true });
        
        if (error) throw error;
        
        allUsers = (data || []).map(u => ({
          id: u.user_id,
          email: u.email,
          role: u.role || 'user'
        }));
        
        renderUsersTable();
      } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--color-error);">Fout bij laden gebruikers. Zorg ervoor dat de RPC-functie "get_all_users_with_roles" bestaat.</td></tr>';
      }
    }

    function renderUsersTable() {
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = allUsers.map(user => {
        return `
          <tr>
    <td>${escapeHtml(user.email)}</td>
    <td><span class="role-badge ${user.role}">${user.role}</span></td>
    <td style="display: flex; gap: 8px; align-items: center;">
      <select onchange="updateUserRole('${user.id}', this.value)" class="form-control" style="width: 120px;">
        <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
        <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
      
      <!-- DE NIEUWE VERWIJDER KNOP -->
      <button onclick="deleteUser('${user.id}', '${user.email}')" class="btn" style="color: var(--color-error); border-color: var(--color-error); padding: 4px 8px;">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:16px; height:16px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
        </svg>
      </button>
    </td>
  </tr>
`;

    async function updateUserRole(userId, newRole) {
      try {
        const { error } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });
        if (error) throw error;
        await logAuditEvent('role_change', `Gebruiker ${userId} rol gewijzigd naar ${newRole}`);
        const user = allUsers.find(u => u.id === userId);
        if (user) user.role = newRole;
        renderUsersTable();
        alert('Rol bijgewerkt!');
      } catch (error) {
        console.error('Error updating role:', error);
        alert('Fout bij bijwerken rol: ' + error.message);
      }
    }

    async function logAuditEvent(action, details) {
      if (!currentUser) return;
      try {
        const { error } = await supabase.from('audit_logs').insert({
          user_id: currentUser.id,
          user_email: currentUser.email,
          action: action,
          details: details,
          timestamp: new Date().toISOString()
        });
        if (error) throw error;
      } catch (error) {
        console.error('Fout bij logging:', error);
      }
    }

    async function deleteSystem(systemId) {
      if (!confirm('Weet je zeker dat je dit systeem wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
        return;
      }

      try {
        const { error } = await supabase
          .from('systems')
          .delete()
          .eq('id', systemId);

        if (error) throw error;

        const system = systems.find(s => s.id === systemId);
        await logAuditEvent('system_deleted', `Systeem verwijderd: ${system ? system.brand + ' ' + system.model : systemId}`);

        systems = systems.filter(s => s.id !== systemId);
        updateBrandFilter();
        updateModelFilter();
        filterSystems();

        alert('Systeem verwijderd.');
      } catch (error) {
        console.error('Error deleting system:', error);
        alert('Fout bij verwijderen: ' + error.message);
      }
    }
    
    async function toggleFavorite(systemId) {
      if (!currentUser) return;
      const isFavorite = favorites.includes(systemId);
      try {
        if (isFavorite) {
          const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('system_id', systemId);
          if (error) throw error;
          favorites = favorites.filter(id => id !== systemId);
        } else {
          const { error } = await supabase
            .from('favorites')
            .insert({ user_id: currentUser.id, system_id: systemId });
          if (error) throw error;
          favorites.push(systemId);
        }
        filterSystems();
      } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Fout bij opslaan favoriet: ' + error.message);
      }
    }

    function openRegisterModal() {
      const modal = document.getElementById('registerModal');
      if (modal) modal.classList.add('active');
    }

    function closeRegisterModal() {
      const modal = document.getElementById('registerModal');
      if (modal) modal.classList.remove('active');
      document.getElementById('registerForm').reset();
    }

    async function handleRegister(e) {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const password2 = document.getElementById('registerPassword2').value;

      if (password !== password2) {
        alert('Wachtwoorden komen niet overeen.');
        return;
      }

      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        const newUserId = data.user?.id;

        if (newUserId) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ 
              user_id: newUserId, 
              email: email,
              role: 'user', 
              is_approved: false
            });
          
          if (roleError) {
             console.error('Fout bij opslaan rol:', roleError);
          }
        }

        alert('Account aangemaakt! Je wordt nu doorgestuurd naar het wachtscherm.');
        closeRegisterModal();
        document.getElementById('registerForm').reset();
        location.reload(); 

      } catch (err) {
        console.error('Fout bij registreren:', err);
        alert('Registratie mislukt: ' + err.message);
      }
    }

    function openEditModal(systemId) {
      const system = systems.find(s => s.id === systemId);
      if (!system) return;
      currentEditingId = systemId;
      document.getElementById('editId').value = systemId;
      document.getElementById('editSystemType').value = system.systemtype;
      document.getElementById('editBrand').value = system.brand;
      document.getElementById('editModel').value = system.model;
      document.getElementById('editLogoUrl').value = system.logo_url || '';
      
      const devImgInput = document.getElementById('editDeviceImage');
      const devImgPreview = document.getElementById('editDeviceImagePreview');
      devImgInput.value = ''; 
      if (system.device_image_url) {
          devImgInput.dataset.currentUrl = system.device_image_url;
          devImgPreview.innerHTML = `✓ Huidige foto: <a href="${system.device_image_url}" target="_blank">Bekijk</a>`;
      } else {
          devImgInput.dataset.currentUrl = '';
          devImgPreview.innerHTML = '';
      }
      
      document.getElementById('editProcedure').value = system.procedure;
      document.getElementById('editO2Low').value = system.o2_low || '';
      document.getElementById('editO2High').value = system.o2_high || '';
      document.getElementById('editCO2Low').value = system.co2_low || '';
      document.getElementById('editCO2High').value = system.co2_high || '';
      document.getElementById('editMaxCO').value = system.maxco || '';
      populatePartsForm('edit', system.parts);
      populateFaultsForm('edit', system.faults);
      populateChecksForm('edit', system.checks);
      document.getElementById('editNotes').value = system.notes || '';
      if (document.getElementById('editHandbookDate')) {
        document.getElementById('editHandbookDate').value = system.handbook_date || '';
      }
        document.getElementById('editManualUrl').value = system.manual_url || '';
      pendingImages.edit = system.images || [];
      renderImagePreview('edit');
      updateFieldsForSystemType(system.systemtype);
      document.getElementById('editModal').classList.add('active');
    }

    function updateFieldsForSystemType(type) {
      const cvFields = document.getElementById('cvKetelFields');
      const wpFields = document.getElementById('warmtepompFields');
      const wtwFields = document.getElementById('wtwMvFields');
      const otherFields = document.getElementById('otherFields');
      
      if(cvFields) cvFields.style.display = 'none';
      if(wpFields) wpFields.style.display = 'none';
      if(wtwFields) wtwFields.style.display = 'none';
      if(otherFields) otherFields.style.display = 'none';

      if (type === 'cv-ketel') {
          if(cvFields) cvFields.style.display = 'block';
      } else if (type === 'warmtepomp') {
          if(wpFields) wpFields.style.display = 'block';
      } else if (type === 'wtw-mv' || type === 'mv-wtw') {
          if(wtwFields) wtwFields.style.display = 'block';
      } else if (['waterzijdig', 'overig', 'collectief', 'appendages', 'rookgasafvoer', 'thermostaten'].includes(type)) {
          if(otherFields) otherFields.style.display = 'block';
      }
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.remove('active');
      currentEditingId = null;
    }

    function openAddModal() {
      document.getElementById('addModal').classList.add('active');
      document.getElementById('addFaultsContainer').innerHTML = '';
      document.getElementById('addDeviceImage').value = '';
      document.getElementById('addForm').reset();
      document.getElementById('addPartsContainer').innerHTML = '';
      document.getElementById('addChecksContainer').innerHTML = '';
      pendingImages.add = [];
      renderImagePreview('add');
      updateAddFieldsForSystemType();
    }

    function closeAddModal() {
      document.getElementById('addModal').classList.remove('active');
    }

    function updateAddFieldsForSystemType(type = '') {
      const cvFields = document.getElementById('addCvKetelFields');
      const wpFields = document.getElementById('addWarmtepompFields');
      const wtwFields = document.getElementById('addWtwMvFields');
      const otherFields = document.getElementById('addOtherFields');
      
      if(cvFields) cvFields.style.display = 'none';
      if(wpFields) wpFields.style.display = 'none';
      if(wtwFields) wtwFields.style.display = 'none';
      if(otherFields) otherFields.style.display = 'none';

      if (type === 'cv-ketel' && cvFields) {
          cvFields.style.display = 'block';
      } else if (type === 'warmtepomp' && wpFields) {
          wpFields.style.display = 'block';
      } else if ((type === 'wtw-mv' || type === 'mv-wtw') && wtwFields) {
          wtwFields.style.display = 'block';
      } else if (['waterzijdig', 'overig', 'collectief', 'appendages', 'rookgasafvoer', 'thermostaten'].includes(type) && otherFields) {
          otherFields.style.display = 'block';
      }
    }

    async function handleAddSubmit(e) {
      e.preventDefault(); 
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      
      console.log("🚀 Start procedure: Systeem toevoegen...");

      try {
        const systemTypeEl = document.getElementById('addSystemType');
        const brandEl = document.getElementById('addBrand');
        const modelEl = document.getElementById('addModel');
        const procedureEl = document.getElementById('addProcedure');

        if (!brandEl.value.trim() || !modelEl.value.trim()) {
            alert("⚠️ Let op: Merk en Model zijn verplicht!");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Bezig met opslaan...";

        const systemType = systemTypeEl.value;

        // 1. Onderdelen verzamelen
        const partsJson = collectPartsData('add'); 
        console.log("Verzamelde onderdelen:", partsJson);

        // 2. Foutcodes verzamelen
        const faultsJson = collectFaultsData('add');

        // 3. Controlepunten verzamelen
        const checksJson = await processChecksData('add');

        // 4. Hoofdfoto uploaden
        let deviceImgUrl = null;
        const deviceFileEl = document.getElementById('addDeviceImage');
        if (deviceFileEl && deviceFileEl.files.length > 0) {
            deviceImgUrl = await uploadSingleFile(deviceFileEl.files[0]); 
        }

        // 5. Galerij foto's uploaden
        let imageUrls = [];
        if (pendingImages.add && pendingImages.add.length > 0) {
            imageUrls = await uploadImages(systemType + '-' + Date.now(), pendingImages.add);
        }

        const newSystem = {
          systemtype: systemType,
          brand: brandEl.value.trim(),
          model: modelEl.value.trim(),
          logo_url: document.getElementById('addLogoUrl')?.value || null,
          device_image_url: deviceImgUrl,
          procedure: procedureEl ? procedureEl.value : '',
          parts: partsJson,
          faults: faultsJson,
          checks: checksJson,
          images: imageUrls,
          notes: document.getElementById('addNotes')?.value || null,
          handbook_date: document.getElementById('addHandbookDate')?.value || null,
          manual_url: document.getElementById('addManualUrl')?.value || null
        };

        // CV-specifieke velden
        if (systemType === 'cv-ketel') {
          newSystem.o2_low = document.getElementById('addO2Low')?.value || null;
          newSystem.o2_high = document.getElementById('addO2High')?.value || null;
          newSystem.co2_low = document.getElementById('addCO2Low')?.value || null;
          newSystem.co2_high = document.getElementById('addCO2High')?.value || null;
          newSystem.maxco = document.getElementById('addMaxCO')?.value || null;
        }

        console.log("Data klaar voor verzending naar Supabase:", newSystem);

        // 6. OPSLAAN IN DATABASE
        const { data, error } = await supabase
          .from('systems')
          .insert([newSystem])
          .select();
          
        if (error) throw error;
        
        console.log("✅ Database succes:", data);
        
        if (data && data.length > 0) {
          systems.push(data[0]);
          await logAuditEvent('system_created', `Systeem ${newSystem.brand} ${newSystem.model} aangemaakt`);
        }
        
        pendingImages.add = [];
        closeAddModal();
        updateBrandFilter();
        updateModelFilter();
        filterSystems();
        
        alert('✅ Systeem is succesvol opgeslagen!');

      } catch (error) {
        console.error('❌ FOUT BIJ OPSLAAN:', error);
        alert('Er ging iets mis: ' + (error.message || "Onbekende fout bij het opslaan"));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }

    async function handleEditSubmit(e) {
      e.preventDefault();
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;

      console.log("🚀 Start procedure: Systeem bijwerken...");

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Bezig met bijwerken...";

        const systemType = document.getElementById('editSystemType').value || 'update';
        
        // 1. Data verzamelen
        const checksJson = await processChecksData('edit');
        const partsJson = collectPartsData('edit');
        const faultsJson = collectFaultsData('edit');

        // 2. Toestelfoto afhandelen
        let deviceImgUrl = document.getElementById('editDeviceImage').dataset.currentUrl || null;
        const deviceFile = document.getElementById('editDeviceImage').files[0];
        if (deviceFile) {
            deviceImgUrl = await uploadSingleFile(deviceFile);
        }

        // 3. Galerij foto's afhandelen
        let imageUrls = pendingImages.edit;
        if (pendingImages.edit.some(img => img instanceof File)) {
          const newFiles = pendingImages.edit.filter(img => img instanceof File);
          const uploadedUrls = await uploadImages(systemType + '-' + Date.now(), newFiles);
          const existingUrls = pendingImages.edit.filter(img => typeof img === 'string');
          imageUrls = existingUrls.concat(uploadedUrls);
        }

        const updates = {
          brand: document.getElementById('editBrand').value,
          model: document.getElementById('editModel').value,
          logo_url: document.getElementById('editLogoUrl').value || null,
          device_image_url: deviceImgUrl, 
          procedure: document.getElementById('editProcedure').value,
          parts: partsJson,
          faults: faultsJson,
          checks: checksJson, 
          images: imageUrls,
          notes: document.getElementById('editNotes').value || null,
          handbook_date: document.getElementById('editHandbookDate').value || null,
          manual_url: document.getElementById('editManualUrl').value || null
        };
        
        // CV velden
        if (systemType === 'cv-ketel') {
          updates.o2_low = document.getElementById('editO2Low').value || null;
          updates.o2_high = document.getElementById('editO2High').value || null;
          updates.co2_low = document.getElementById('editCO2Low').value || null;
          updates.co2_high = document.getElementById('editCO2High').value || null;
          updates.maxco = document.getElementById('editMaxCO').value || null;
        }

        console.log("Data klaar voor update in Supabase:", updates);

        // 4. DATABASE UPDATE
        const { error } = await supabase
          .from('systems')
          .update(updates)
          .eq('id', currentEditingId);

        if (error) throw error;
        
        console.log("✅ Update succesvol!");

        const systemIndex = systems.findIndex(s => s.id === currentEditingId);
        if (systemIndex !== -1) {
          systems[systemIndex] = Object.assign({}, systems[systemIndex], updates);
          await logAuditEvent('system_updated', `Systeem ${updates.brand} ${updates.model} bijgewerkt`);
        }
        
        pendingImages.edit = [];
        closeEditModal();
        updateBrandFilter();
        updateModelFilter(); 
        filterSystems();
        alert('Systeem succesvol bijgewerkt!');

      } catch (error) {
        console.error('❌ FOUT BIJ BIJWERKEN:', error);
        alert('Bijwerken mislukt: ' + (error.message || "Onbekende database fout"));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
    
    function handleDrop(e, mode) {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      handleImageSelect(files, mode);
    }

    function handleImageSelect(files, mode) {
      const maxFiles = 5;
      const newFiles = Array.from(files).slice(0, maxFiles - pendingImages[mode].length);
      pendingImages[mode] = pendingImages[mode].concat(newFiles.filter(f => f instanceof File));
      renderImagePreview(mode);
    }

    function renderImagePreview(mode) {
      const gallery = document.getElementById(mode === 'add' ? 'addImageGallery' : 'editImageGallery');
      const count = document.getElementById(mode === 'add' ? 'addImageCount' : 'editImageCount');
      gallery.innerHTML = pendingImages[mode].map((file, idx) => {
        const isFile = file instanceof File;
        const src = isFile ? URL.createObjectURL(file) : file;
        return '<div class="gallery-item"><img src="' + src + '" alt="Preview ' + (idx + 1) + '"><button class="gallery-item-delete" onclick="removeImage(' + idx + ', \'' + mode + '\')">&times;</button></div>';
      }).join('');
      count.textContent = pendingImages[mode].length + '/5 fotos';
    }

    function removeImage(index, mode) {
      pendingImages[mode].splice(index, 1);
      renderImagePreview(mode);
    }

    async function uploadImages(folderName, files) {
  const urls = [];
  
  for (let file of files) {
    if (!(file instanceof File)) {
      if (typeof file === 'string') urls.push(file);
      continue;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${folderName}/${Date.now()}.${fileExt}`;

    console.log("Poging tot upload...", fileName);

    // We maken een timeout van 10 seconden
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Supabase upload timeout (10s)")), 10000)
    );

    try {
      // We laten de upload racen tegen de klok
      const uploadPromise = supabase.storage.from('system-images').upload(fileName, file);
      const { data, error } = await Promise.race([uploadPromise, timeout]);

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('system-images').getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
      console.log("Upload geslaagd:", urlData.publicUrl);
    } catch (err) {
      console.error("Upload gestopt:", err.message);
      alert("Upload fout: " + err.message);
      throw err; // Dit stopt het 'hangen' en geeft een melding
    }
  }
  return urls;
}

async function uploadSingleFile(file) {
  if (!file) return null;
  try {
    console.log("Start uploadSingleFile...");
    const fileExt = file.name.split('.').pop();
    const fileName = `devices/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('system-images')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('system-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Fout in uploadSingleFile:", err.message);
    throw err;
  }
}

    function escapeInput(str) {
      return str ? str.replace(/"/g, '&quot;') : '';
    }

    function addPartRow(mode, desc = '', art = '', supp = 'Overig') {
      const container = document.getElementById(mode + 'PartsContainer');
      const div = document.createElement('div');
      div.className = 'part-input-row';
      div.innerHTML = `
        <input type="text" placeholder="Omschrijving" class="form-control part-desc" value="${escapeInput(desc)}">
        <input type="text" placeholder="Art. nr." class="form-control part-art" value="${escapeInput(art)}">
        <select class="form-control part-supp">
          <option value="Overig" ${supp === 'Overig' ? 'selected' : ''}>Overig</option>
          <option value="Rensa" ${supp === 'Rensa' ? 'selected' : ''}>Rensa</option>
          <option value="Wasco" ${supp === 'Wasco' ? 'selected' : ''}>Wasco</option>
        </select>
        <button type="button" class="remove-part-btn" onclick="this.parentElement.remove()">&times;</button>
      `;
      container.appendChild(div);
    }

    function switchTab(systemId, tabName) {
      const card = document.getElementById('card-' + systemId);
      
      card.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      card.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

      card.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      card.querySelector(`#content-${tabName}-${systemId}`).classList.add('active');
    }

    function addFaultRow(mode, code = '', cause = '', solution = '') {
      const container = document.getElementById(mode + 'FaultsContainer');
      const div = document.createElement('div');
      div.className = 'part-input-row';
      div.innerHTML = `
        <input type="text" placeholder="Code" class="form-control fault-code-input" value="${escapeInput(code)}">
        <input type="text" placeholder="Oorzaak" class="form-control fault-cause-input" value="${escapeInput(cause)}">
        <input type="text" placeholder="Oplossing" class="form-control fault-sol-input" value="${escapeInput(solution)}">
        <button type="button" class="remove-part-btn" onclick="this.parentElement.remove()">&times;</button>
      `;
      container.appendChild(div);
    }

    function collectFaultsData(mode) {
      const container = document.getElementById(mode + 'FaultsContainer');
      const rows = container.querySelectorAll('.part-input-row');
      const faults = [];
      rows.forEach(row => {
        const code = row.querySelector('.fault-code-input').value.trim();
        const cause = row.querySelector('.fault-cause-input').value.trim();
        const solution = row.querySelector('.fault-sol-input').value.trim();
        
        if (code || cause || solution) {
            faults.push({ code, cause, solution });
        }
      });
      return faults.length > 0 ? JSON.stringify(faults) : null;
    }

    function populateFaultsForm(mode, jsonString) {
      const container = document.getElementById(mode + 'FaultsContainer');
      container.innerHTML = '';
      if (!jsonString) return;
      try {
        const faults = JSON.parse(jsonString);
        if (Array.isArray(faults)) {
          faults.forEach(f => {
              const cause = f.cause || '';
              const solution = f.solution || f.sol || ''; 
              addFaultRow(mode, f.code, cause, solution);
          });
        }
      } catch (e) { console.error('Fout bij laden storingen', e); }
    }

    function collectPartsData(mode) {
  try {
    const container = document.getElementById(mode + 'PartsContainer');
    if (!container) return null;

    const rows = container.querySelectorAll('.part-input-row');
    const parts = [];

    rows.forEach((row, index) => {
      const descEl = row.querySelector('.part-desc');
      const artEl = row.querySelector('.part-art');
      const suppEl = row.querySelector('.part-supp');

      // Check of de elementen wel bestaan in deze rij
      if (descEl && artEl && suppEl) {
        const desc = descEl.value.trim();
        const art = artEl.value.trim();
        const supp = suppEl.value;

        if (desc || art) {
          parts.push({ desc, art, supp });
        }
      }
    });

    console.log(`Verzamelde onderdelen voor ${mode}:`, parts);
    return parts.length > 0 ? JSON.stringify(parts) : null;
  } catch (err) {
    console.error("Fout in collectPartsData:", err);
    return null;
  }
}

    function populatePartsForm(mode, jsonString) {
      const container = document.getElementById(mode + 'PartsContainer');
      container.innerHTML = ''; 
      
      if (!jsonString) return; 

      try {
        const parts = JSON.parse(jsonString);
        if (Array.isArray(parts)) {
          parts.forEach(p => addPartRow(mode, p.desc, p.art, p.supp));
          return;
        }
      } catch (e) {
        const lines = jsonString.split('\n');
        lines.forEach(line => {
          if(line.trim()) addPartRow(mode, line, '', 'Overig');
        });
      }
    }
    
    function openLightbox(imageUrl) {
      document.getElementById('lightbox').classList.add('active');
      document.getElementById('lightboxImg').src = imageUrl;
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }
    
    document.getElementById('currentYear').textContent = new Date().getFullYear();

// Functie 1: Haal niet-goedgekeurde gebruikers op
async function loadPendingUsers() {
  const container = document.getElementById('pendingUsersList');
  if (!container) return; 

  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('is_approved', false);

  container.innerHTML = '';

  if (error) {
    console.error(error);
    container.innerHTML = '<p style="color:red">Fout bij laden aanvragen.</p>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="font-size:13px; color:green;">✓ Geen openstaande aanvragen.</p>';
    return;
  }

  data.forEach(user => {
    const row = document.createElement('div');
    row.style = "display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--color-bg-primary); border:1px solid var(--color-border); border-radius:8px; margin-bottom:8px;";
    row.innerHTML = `
      <span style="font-weight:500;">${user.email}</span>
      <div style="display:flex; gap:8px;">
        <button onclick="approveUser('${user.user_id}')" class="btn btn-primary" style="padding:4px 12px; font-size:12px;">Toelaten</button>
        <button onclick="deleteUser('${user.user_id}', '${user.email}')" class="btn" style="padding:4px 12px; font-size:12px; color:var(--color-error); border-color:var(--color-error);">Weigeren</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// Functie 2: Keur een gebruiker goed
async function approveUser(userId) {
  if(!confirm('Wil je deze gebruiker toegang geven?')) return;
  const { error } = await supabase
    .from('user_roles')
    .update({ is_approved: true })
    .eq('user_id', userId);

  if (error) {
    alert("Fout bij goedkeuren: " + error.message);
  } else {
    loadPendingUsers(); 
    loadUsers(); 
    checkPendingNotifications();
    if(typeof logAuditEvent === 'function') {
        logAuditEvent('user_approved', `Gebruiker ${userId} goedgekeurd`);
    }
  }
}

// Functie 3: Check wachtenden en update badge
async function checkPendingNotifications() {
  if (!currentUser || currentUserRole !== 'admin') return;
  const { count, error } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', false);
  const badge = document.getElementById('adminBadge');
  if (count && count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
    document.title = `(${count}) De Onderhoud Centrale`;
  } else {
    badge.classList.add('hidden');
    document.title = "De Onderhoud Centrale";
  }
}

// Functie 4: Verwijder gebruiker
async function deleteUser(userId, email) {
  if (userId === currentUser.id) {
    alert("Je kunt jezelf niet verwijderen!");
    return;
  }
  if (!confirm(`Weet je zeker dat je ${email} wilt verwijderen?`)) return;

  try {
    const { error } = await supabase.rpc('delete_user_by_id', { user_id: userId });
    if (error) throw error;
    alert('Gebruiker verwijderd.');
    await loadUsers();
    await loadPendingUsers();
  } catch (err) {
    alert('Fout: ' + err.message);
  }
}

// Start de app
init();

// --- KOPPELINGEN NAAR WINDOW ---
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleRegister = handleRegister;
window.openRegisterModal = openRegisterModal;
window.closeRegisterModal = closeRegisterModal;
window.toggleTheme = toggleTheme;
window.toggleFavorite = toggleFavorite;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.updateAddFieldsForSystemType = updateAddFieldsForSystemType;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.deleteSystem = deleteSystem;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.approveUser = approveUser;
window.deleteUser = deleteUser;
window.openAuditModal = openAuditModal;
window.closeAuditModal = closeAuditModal;
window.addPartRow = addPartRow;
window.addCheckRow = addCheckRow;
window.addFaultRow = addFaultRow;
window.handleImageSelect = handleImageSelect;
window.handleDrop = handleDrop;
window.removeImage = removeImage;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.switchTab = switchTab;
window.supabase = supabase;
window.activateEasterEgg = activateEasterEgg;
