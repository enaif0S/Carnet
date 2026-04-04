// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// --- CONFIGURATION FIREBASE ---
// ⚠️ À REMPLACER : Le développeur doit créer un projet Firebase et coller les valeurs ici.
const firebaseConfig = {
    apiKey: "AIzaSyBnmPy5Afbhr8XIRSE_OxZq_50yLqMZamc",
    authDomain: "carnetentretient.firebaseapp.com",
    projectId: "carnetentretient",
    storageBucket: "carnetentretient.firebasestorage.app",
    messagingSenderId: "843731217789",
    appId: "1:843731217789:web:329eb73ecc30d61ed23014",
    measurementId: "G-J6L37XM9ED"
};

// Intégration factice sécurisée si aucune configuration n'est modifiée pour éviter que l'applie ne crashe avant configuration
const isFirebaseConfigured = firebaseConfig.apiKey !== "1:843731217789:web:329eb73ecc30d61ed23014";

let app, auth, db;
if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// --- VARIABLES CLOUD ---
let currentUser = null;
let vehicles = [];
let currentVehicleId = null;
let records = [];

// --- DOM ELEMENTS ---
// Auth Logic
const authView = document.getElementById('auth-view');
const appWrapper = document.getElementById('app-wrapper');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const btnSubmitAuth = document.getElementById('btn-submit-auth');
const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

let isSignupMode = false;

// App Elements
const vehicleSelector = document.getElementById('vehicle-selector');
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section:not(#auth-view)');
const recordsContainer = document.getElementById('records-container');
const recordCount = document.getElementById('record-count');
const emptyState = document.getElementById('empty-state');

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
const printTableBody = document.getElementById('print-table-body');
const printVehicleName = document.getElementById('print-vehicle-name');

let isOnboarding = false;

// --- INIT APP / AUTH LISTENER ---
function init() {
    if (!isFirebaseConfigured) {
        authView.innerHTML = `
            <div class="glass-card" style="max-width: 500px; margin: 100px auto; text-align:center;">
                <span class="material-symbols-outlined icon-large" style="color:var(--warning)">warning</span>
                <h2>Firebase Non Configuré</h2>
                <p style="color:var(--text-secondary); margin-top:20px;">
                    Ouvrez le fichier <code>app.js</code> et modifiez l'objet <code>firebaseConfig</code> avec les identifiants de votre projet Firebase.
                </p>
            </div>
        `;
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    defaultDate.value = today;

    // Listen to Firebase Auth state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            authView.classList.remove('active');
            appWrapper.style.display = 'block';
            await loadUserData();
        } else {
            currentUser = null;
            appWrapper.style.display = 'none';
            authView.classList.add('active');
            vehicles = [];
            records = [];
        }
    });

    attachAuthListeners();
    attachAppListeners();
}

function attachAuthListeners() {
    toggleAuthModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isSignupMode = !isSignupMode;
        if (isSignupMode) {
            btnSubmitAuth.textContent = "S'inscrire";
            toggleAuthModeBtn.textContent = "Déjà un compte ? Se connecter";
        } else {
            btnSubmitAuth.textContent = "Se Connecter";
            toggleAuthModeBtn.textContent = "Pas de compte ? S'inscrire ici.";
        }
        authError.style.display = 'none';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value.trim();
        const pwd = authPassword.value;
        authError.style.display = 'none';
        btnSubmitAuth.disabled = true;
        btnSubmitAuth.innerHTML = "Patientez...";

        try {
            if (isSignupMode) {
                await createUserWithEmailAndPassword(auth, email, pwd);
            } else {
                await signInWithEmailAndPassword(auth, email, pwd);
            }
        } catch (error) {
            authError.style.display = 'block';
            authError.textContent = error.message;
        } finally {
            btnSubmitAuth.disabled = false;
            btnSubmitAuth.textContent = isSignupMode ? "S'inscrire" : "Se Connecter";
        }
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
}

async function loadUserData() {
    try {
        // Load Vehicles
        const vQ = query(collection(db, "vehicles"), where("userId", "==", currentUser.uid));
        const vSnap = await getDocs(vQ);
        vehicles = [];
        vSnap.forEach(doc => {
            vehicles.push({ id: doc.id, ...doc.data() });
        });

        // Load Records
        const rQ = query(collection(db, "records"), where("userId", "==", currentUser.uid), orderBy("date", "desc"));
        const rSnap = await getDocs(rQ);
        records = [];
        rSnap.forEach(doc => {
            records.push({ id: doc.id, ...doc.data() });
        });

        // Setup UI
        if (vehicles.length === 0) {
            showVehicleModal(true);
        } else {
            currentVehicleId = vehicles[0].id;
            renderVehicleOptions();
            renderRecords();
            updateTypeUI();
        }

    } catch (err) {
        console.error("Erreur de chargement: ", err);
        // Note: Firestore nécessite parfois la création d'index (un lien apparaitra dans la console réseau lors d'erreurs OrderBy)
    }
}

// --- APP LISTENERS & LOGIC ---

function attachAppListeners() {
    kmInput.addEventListener('input', updateTypeUI);
    radioTypes.forEach(r => r.addEventListener('change', updateTypeUI));
    form.addEventListener('submit', handleFormSubmit);

    checkHuile.addEventListener('change', (e) => {
        if (e.target.checked) {
            huileOptions.style.display = 'grid';
            huileOptions.style.opacity = '1';
        } else {
            huileOptions.style.display = 'none';
        }
    });

    vehicleSelector.addEventListener('change', (e) => {
        if (e.target.value === 'new') {
            showVehicleModal(false);
            e.target.value = currentVehicleId;
        } else {
            currentVehicleId = e.target.value;
            renderRecords();
        }
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.id === 'print-btn') {
                preparePrint();
                window.print();
                return;
            }
            if (btn.id === 'logout-btn') return;

            const targetView = btn.getAttribute('data-view');
            navBtns.forEach(b => {
                if (b.id !== 'print-btn' && b.id !== 'logout-btn') b.classList.remove('active');
            });
            btn.classList.add('active');

            views.forEach(v => {
                if (v.id === targetView) v.classList.add('active');
                else v.classList.remove('active');
            });
        });
    });

    btnCancelVehicle.addEventListener('click', () => {
        if (!isOnboarding) modal.classList.add('hidden');
    });

    btnSaveVehicle.addEventListener('click', async () => {
        const marque = inputMarque.value.trim();
        const modele = inputModele.value.trim();
        const annee = inputAnnee.value.trim();
        const initialKm = parseInt(inputKm.value) || 0;

        if (marque && modele) {
            const displayName = `${marque} ${modele} ${annee ? '(' + annee + ')' : ''}`.trim();
            btnSaveVehicle.disabled = true;

            const newVehData = {
                userId: currentUser.uid,
                marque,
                modele,
                annee,
                initialKm,
                name: displayName
            };

            try {
                const docRef = await addDoc(collection(db, "vehicles"), newVehData);
                const vehicleObj = { id: docRef.id, ...newVehData };
                vehicles.push(vehicleObj);
                currentVehicleId = vehicleObj.id;

                modal.classList.add('hidden');
                inputMarque.value = '';
                inputModele.value = '';
                inputAnnee.value = '';
                inputKm.value = '';

                isOnboarding = false;
                renderVehicleOptions();
                renderRecords();
                updateTypeUI();
            } catch (e) {
                alert("Erreur lors de l'ajout: " + e.message);
            } finally {
                btnSaveVehicle.disabled = false;
            }
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
        btnCancelVehicle.style.display = 'none';
    } else {
        modalTitle.textContent = "Nouveau Véhicule";
        btnCancelVehicle.style.display = 'block';
    }
}

function getSelectedType() {
    let type = 'Vidange';
    radioTypes.forEach(r => {
        if (r.checked) type = r.value;
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

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentVehicleId || !currentUser) return;

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

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const newRecData = {
            userId: currentUser.uid,
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

        const docRef = await addDoc(collection(db, "records"), newRecData);
        records.unshift({ id: docRef.id, ...newRecData }); // Ajouter au début car on sort desc sur date normalement

        // Reset
        kmInput.value = '';
        document.getElementById('detail-input').value = '';
        document.getElementById('cost-input').value = '';
        document.getElementById('garage-input').value = '';
        document.getElementById('obs-input').value = '';
        huileMarque.value = '';
        huileRef.value = '';
        checkHuile.checked = true;
        huileOptions.style.display = 'grid';

        document.querySelector('[data-view="list-view"]').click();
        renderRecords();
    } catch (err) {
        alert("Erreur de sauvegarde: " + err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

// --- RENDERING ---

function renderVehicleOptions() {
    vehicleSelector.innerHTML = '';
    vehicles.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        if (v.id === currentVehicleId) opt.selected = true;
        vehicleSelector.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = 'new';
    addOpt.textContent = '+ Ajouter un véhicule';
    vehicleSelector.appendChild(addOpt);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
}

function getVehicleRecords() {
    if (!currentVehicleId) return [];
    return records
        .filter(r => r.vehicleId === currentVehicleId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
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

    if (vRecords.length === 0) {
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
        if (rec.nextKm) {
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
                    ${rec.detail ? `<strong>Détails:</strong> ${rec.detail.replace(/\n/g, '<br>')}<br>` : ''}
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
                ${rec.detail ? rec.detail.replace(/\n/g, '<br>') : ''}
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
