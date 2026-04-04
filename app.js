// app.js

// --- STATE MANAGEMENT ---
let vehicles = JSON.parse(localStorage.getItem('ce_vehicles')) || [];
let currentVehicleId = parseInt(localStorage.getItem('ce_currentVehicle')) || null;

let records = JSON.parse(localStorage.getItem('ce_records')) || [];

// --- DOM ELEMENTS ---
const vehicleSelector = document.getElementById('vehicle-selector');
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section');

// Form Elements
const form = document.getElementById('maintenance-form');
const kmInput = document.getElementById('km-input');
const radioTypes = document.querySelectorAll('input[name="type-intervention"]');
const nextKmDisplay = document.getElementById('next-km-display');
const defaultDate = document.getElementById('date-input');

// Vidange Specific Elements
const vidangeDetails = document.getElementById('vidange-details');
const checkHuile = document.getElementById('check-huile');
const huileOptions = document.getElementById('huile-options');
const huileMarque = document.getElementById('huile-marque');
const huileRef = document.getElementById('huile-ref');

// List Elements
const recordsContainer = document.getElementById('records-container');
const recordCount = document.getElementById('record-count');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const modal = document.getElementById('new-vehicle-modal');
const modalTitle = document.getElementById('modal-vehicle-title');
const btnCancelVehicle = document.getElementById('cancel-vehicle-btn');
const btnSaveVehicle = document.getElementById('save-vehicle-btn');

const inputMarque = document.getElementById('new-vehicle-marque');
const inputModele = document.getElementById('new-vehicle-modele');
const inputAnnee = document.getElementById('new-vehicle-annee');
const inputKm = document.getElementById('new-vehicle-km');

// Print Elements
const btnPrint = document.getElementById('print-btn');
const printTableBody = document.getElementById('print-table-body');
const printVehicleName = document.getElementById('print-vehicle-name');

let isOnboarding = false;

// --- INIT ---
function init() {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    defaultDate.value = today;

    if (vehicles.length === 0) {
        // Premier lancement : obliger la création
        showVehicleModal(true);
    } else {
        if (!currentVehicleId) currentVehicleId = vehicles[0].id;
        renderVehicleOptions();
        renderRecords();
        updateTypeUI();
    }
    
    // Attach listeners
    kmInput.addEventListener('input', updateTypeUI);
    radioTypes.forEach(r => r.addEventListener('change', updateTypeUI));
    form.addEventListener('submit', handleFormSubmit);

    checkHuile.addEventListener('change', (e) => {
        if(e.target.checked) {
            huileOptions.style.display = 'grid'; // .form-row uses grid
            huileOptions.style.opacity = '1';
        } else {
            huileOptions.style.display = 'none';
        }
    });

    vehicleSelector.addEventListener('change', (e) => {
        if(e.target.value === 'new') {
            showVehicleModal(false);
            e.target.value = currentVehicleId; // revert temporarily
        } else {
            currentVehicleId = parseInt(e.target.value);
            localStorage.setItem('ce_currentVehicle', currentVehicleId);
            renderRecords();
        }
    });

    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.id === 'print-btn') {
                preparePrint();
                window.print();
                return;
            }

            const targetView = btn.getAttribute('data-view');
            
            navBtns.forEach(b => b.classList.remove('active'));
            if(btn.id !== 'print-btn') btn.classList.add('active');

            views.forEach(v => {
                if(v.id === targetView) v.classList.add('active');
                else v.classList.remove('active');
            });
        });
    });

    // Modal
    btnCancelVehicle.addEventListener('click', () => {
        if (!isOnboarding) modal.classList.add('hidden');
    });

    btnSaveVehicle.addEventListener('click', () => {
        const marque = inputMarque.value.trim();
        const modele = inputModele.value.trim();
        const annee = inputAnnee.value.trim();
        const initialKm = parseInt(inputKm.value) || 0;

        if (marque && modele) {
            const newId = Date.now();
            const displayName = `${marque} ${modele} ${annee ? '(' + annee + ')' : ''}`.trim();

            vehicles.push({ 
                id: newId, 
                marque, 
                modele, 
                annee,
                initialKm,
                name: displayName 
            });

            localStorage.setItem('ce_vehicles', JSON.stringify(vehicles));
            currentVehicleId = newId;
            localStorage.setItem('ce_currentVehicle', currentVehicleId);
            
            modal.classList.add('hidden');
            inputMarque.value = '';
            inputModele.value = '';
            inputAnnee.value = '';
            inputKm.value = '';
            
            isOnboarding = false;
            renderVehicleOptions();
            renderRecords();
            updateTypeUI();
        } else {
            alert("Veuillez au moins renseigner la Marque et le Modèle.");
        }
    });
}

function showVehicleModal(onboarding = false) {
    isOnboarding = onboarding;
    modal.classList.remove('hidden');
    
    if (onboarding) {
        modalTitle.textContent = "🚗 Bienvenue ! Ajoutez votre 1er véhicule";
        btnCancelVehicle.style.display = 'none'; // Pas d'annulation possible
    } else {
        modalTitle.textContent = "Nouveau Véhicule";
        btnCancelVehicle.style.display = 'block';
    }
}

// --- LOGIC ---

function getSelectedType() {
    let type = 'Vidange';
    radioTypes.forEach(r => {
        if(r.checked) type = r.value;
    });
    return type;
}

function updateTypeUI() {
    if (!currentVehicleId) return;
    
    const type = getSelectedType();
    const km = parseInt(kmInput.value) || 0;
    const previewContainer = document.getElementById('next-maintenance-preview');

    if (type === 'Vidange') {
        const nextKm = km + 8000;
        nextKmDisplay.textContent = `${nextKm.toLocaleString()} km`;
        previewContainer.style.opacity = '1';
        vidangeDetails.style.display = 'block';
    } else {
        nextKmDisplay.textContent = "N/A";
        previewContainer.style.opacity = '0.4';
        vidangeDetails.style.display = 'none';
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentVehicleId) return;

    const date = document.getElementById('date-input').value;
    const km = parseInt(kmInput.value);
    const type = getSelectedType();
    let detail = document.getElementById('detail-input').value;
    const cost = document.getElementById('cost-input').value;
    const garage = document.getElementById('garage-input').value;
    const obs = document.getElementById('obs-input').value;

    let nextKm = null;
    if (type === 'Vidange') {
        nextKm = km + 8000;
        if (checkHuile.checked) {
            const hM = huileMarque.value.trim() || '?';
            const hR = huileRef.value.trim() || '?';
            const huileStr = `Huile: ${hM} (${hR})`;
            detail = detail ? `${huileStr}\nAutres: ${detail}` : huileStr;
        }
    }

    const newRecord = {
        id: Date.now(),
        vehicleId: currentVehicleId,
        date,
        km,
        type,
        detail,
        cost,
        garage,
        obs,
        nextKm
    };

    records.push(newRecord);
    localStorage.setItem('ce_records', JSON.stringify(records));

    // Reset Form (keep date)
    kmInput.value = '';
    document.getElementById('detail-input').value = '';
    document.getElementById('cost-input').value = '';
    document.getElementById('garage-input').value = '';
    document.getElementById('obs-input').value = '';
    huileMarque.value = '';
    huileRef.value = '';
    checkHuile.checked = true;
    huileOptions.style.display = 'grid';
    
    // Switch to List View
    document.querySelector('[data-view="list-view"]').click();
    renderRecords();
}

function renderVehicleOptions() {
    vehicleSelector.innerHTML = '';
    vehicles.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        if(v.id === currentVehicleId) opt.selected = true;
        vehicleSelector.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = 'new';
    addOpt.textContent = '+ Ajouter un véhicule';
    vehicleSelector.appendChild(addOpt);
}

function formatDate(dateStr) {
    if(!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
}

function getVehicleRecords() {
    if (!currentVehicleId) return [];
    return records
        .filter(r => r.vehicleId === currentVehicleId)
        .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending
}

function renderRecords() {
    if (!currentVehicleId) {
        recordsContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        recordCount.textContent = "0";
        return;
    }

    const vRecords = getVehicleRecords();
    recordCount.textContent = vRecords.length;
    
    if(vRecords.length === 0) {
        recordsContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    recordsContainer.innerHTML = '';

    vRecords.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'record-card';
        
        let nextAlert = '';
        if(rec.nextKm) {
            nextAlert = `
                <div class="next-maintenance-alert">
                    <span class="material-symbols-outlined">schedule</span>
                    Prochaine vidange à: ${rec.nextKm.toLocaleString()} km
                </div>
            `;
        }

        let costHtml = rec.cost ? `<div class="card-cost">${parseInt(rec.cost).toLocaleString()} DA</div>` : '';
        let garageHtml = rec.garage ? `<div class="card-garage"><span class="material-symbols-outlined" style="font-size:16px">build</span> ${rec.garage}</div>` : '';

        card.innerHTML = `
            <div class="card-content">
                <div class="card-header">
                    <div class="card-type">${rec.type}</div>
                    <div class="card-date">${formatDate(rec.date)}</div>
                </div>
                
                <div class="card-metrics">
                    <div class="metric">
                        <span class="material-symbols-outlined">speed</span>
                        ${rec.km.toLocaleString()} km
                    </div>
                </div>
                
                <div class="card-details">
                    ${rec.detail ? `<strong>Détails:</strong> ${rec.detail}<br>` : ''}
                    ${rec.obs ? `<strong>Obs:</strong> ${rec.obs}` : ''}
                </div>
                
                <div class="card-footer">
                    ${garageHtml}
                    ${costHtml}
                </div>
                ${nextAlert}
            </div>
        `;
        
        recordsContainer.appendChild(card);
    });
}

function preparePrint() {
    const currentVehicle = vehicles.find(v => v.id === currentVehicleId);
    printVehicleName.textContent = `Véhicule: ${currentVehicle ? currentVehicle.name : ''}`;
    
    const vRecords = getVehicleRecords();
    printTableBody.innerHTML = '';
    
    vRecords.forEach(rec => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(rec.date)}</td>
            <td>${rec.km.toLocaleString()} km</td>
            <td>${rec.type}</td>
            <td>
                ${rec.detail || ''}
                ${rec.obs ? '<br><em>Obs: ' + rec.obs + '</em>' : ''}
            </td>
            <td>${rec.cost ? parseInt(rec.cost).toLocaleString() : '-'}</td>
            <td>${rec.garage || '-'}</td>
            <td>${rec.nextKm ? rec.nextKm.toLocaleString() + ' km' : '-'}</td>
        `;
        printTableBody.appendChild(tr);
    });
}

// Start app
document.addEventListener('DOMContentLoaded', init);
