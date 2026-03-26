import { auth, db, firebaseConfig } from "./firebase-config.js";
import { collection, query, where, getDocs, setDoc, doc, addDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// Secondary App for creating users without logging out
const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppBDM");
const secondaryAuth = getAuth(secondaryApp);

// Data
let societies = [];
let agents = [];
let defaulters = [];
let commissions = []; // Not backed by DB in MVP

let recoveryChart = null;
let agentChart = null;
let commissionChart = null;

async function initializeData() {
    await fetchAllData();
    updateAllSections();
}

async function fetchAllData() {
    try {
        societies = [];
        agents = [];
        defaulters = [];
        
        const bdmId = window.currentUserId; // injected by auth-guard

        // Fetch societies created by or assigned to this BDM
        const socQ = query(collection(db, "societies"), where("createdBy", "==", bdmId));
        const socSnap = await getDocs(socQ);
        socSnap.forEach(d => societies.push({ id: d.id, ...d.data() }));

        // Ensure we only query agents if there's an index or just fetch all BDM agents
        const agentsQ = query(collection(db, "users"), where("createdBy", "==", bdmId), where("role", "==", "agent"));
        const agentsSnap = await getDocs(agentsQ);
        agentsSnap.forEach(d => agents.push({ id: d.id, ...d.data() }));

        // Fetch defaulters for the societies
        const societyNames = societies.map(s => s.name);
        if (societyNames.length > 0) {
            // Firestore 'in' queries max 10, chunk if needed. For MVP, assuming < 10 or fetch all and filter client side
            const defSnap = await getDocs(collection(db, "members"));
            defSnap.forEach(d => {
                const def = { id: d.id, ...d.data() };
                if (societyNames.includes(def.society)) {
                    defaulters.push(def);
                }
            });
        }
    } catch (err) {
        console.error("Error fetching BDM data:", err);
    }
}

function updateAllSections() {
    populateAgentDropdowns();
    updateDashboardStats();
    renderSocieties();
    renderAgents();
    renderDefaulters();
    renderRecentDefaulters();
    // commission table mock
    updateCharts();
}

function populateAgentDropdowns() {
    const socDropdowns = ['defaulterSociety', 'agentSociety'];
    socDropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = '<option value="">-- Select Society --</option>';
        societies.forEach(s => el.innerHTML += `<option value="${s.name}">${s.name}</option>`);
    });

    const agentDropdown = document.getElementById('defaulterAgent');
    if(agentDropdown) {
        agentDropdown.innerHTML = '<option value="">-- Select Agent --</option>';
        agents.forEach(a => agentDropdown.innerHTML += `<option value="${a.name}">${a.name}</option>`);
    }
}

// Global UI mappings
window.showSection = function(sectionId, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) element.classList.add('active');
};

window.openModal = function(modalId) { document.getElementById(modalId).style.display = 'block'; };
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    const inputs = document.getElementById(modalId).querySelectorAll('input, select');
    inputs.forEach(i => i.type!=='button' && (i.tagName==='SELECT' ? i.selectedIndex=0 : i.value=''));
};

// Society functions
window.addSociety = async function() {
    const s = {
        name: document.getElementById('societyName').value,
        address: document.getElementById('societyAddress').value,
        city: document.getElementById('societyCity').value,
        units: parseInt(document.getElementById('societyUnits').value),
        status: document.getElementById('societyStatus').value,
        createdBy: window.currentUserId
    };

    if(s.name) {
        try {
            const docRef = await addDoc(collection(db, "societies"), s);
            s.id = docRef.id;
            societies.push(s);
            updateAllSections();
            closeModal('societyModal');
        } catch(err) { console.error(err); }
    }
};

window.removeSociety = async function(id, index) {
    if(confirm('Are you sure?')) {
        await deleteDoc(doc(db, "societies", id));
        societies.splice(index, 1);
        updateAllSections();
    }
};

function renderSocieties() {
    const tbody = document.getElementById('societyTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (societies.length === 0) return tbody.innerHTML = '<tr><td colspan="6">No societies found</td></tr>';
    
    societies.forEach((s, i) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${s.name}</td><td>${s.address}</td><td>${s.city}</td><td>${s.units}</td>
            <td><span class="status-badge ${s.status.toLowerCase()}">${s.status}</span></td>
            <td><button onclick="removeSociety('${s.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i> Remove</button></td>
        `;
    });
}

// Agent functions
window.addAgent = async function() {
    const a = {
        name: document.getElementById('agentName').value,
        email: document.getElementById('agentEmail').value,
        phone: document.getElementById('agentPhone').value,
        society: document.getElementById('agentSociety').value,
        status: document.getElementById('agentStatus').value
    };

    if(a.email) {
        try {
            // create auth user
            const cred = await createUserWithEmailAndPassword(secondaryAuth, a.email, "Password@123");
            const u = {
                uid: cred.user.uid,
                email: a.email,
                name: a.name,
                phone: a.phone,
                role: 'agent',
                assigned_society: a.society,
                createdBy: window.currentUserId,
                status: a.status,
                createdAt: new Date()
            };
            await setDoc(doc(db, "users", cred.user.uid), u);
            await signOut(secondaryAuth);
            
            u.id = cred.user.uid;
            agents.push(u);
            updateAllSections();
            closeModal('agentModal');
        } catch(err) { alert(err.message); }
    }
};

window.removeAgent = async function(id, index) {
    if(confirm('Are you sure?')) {
        await deleteDoc(doc(db, "users", id));
        agents.splice(index, 1);
        updateAllSections();
    }
};

function renderAgents() {
    const tbody = document.getElementById('agentTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (agents.length === 0) return tbody.innerHTML = '<tr><td colspan="6">No agents found</td></tr>';

    agents.forEach((a, i) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${a.name}</td><td>${a.email}</td><td>${a.phone}</td><td>${a.assigned_society}</td>
            <td><span class="status-badge ${a.status.toLowerCase()}">${a.status}</span></td>
            <td><button onclick="removeAgent('${a.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i></button></td>
        `;
    });
}

// Defaulters
window.addDefaulter = async function() {
    const d = {
        name: document.getElementById('defaulterName').value,
        contact: document.getElementById('defaulterContact').value,
        society: document.getElementById('defaulterSociety').value,
        amount: parseFloat(document.getElementById('defaulterAmount').value),
        dueDate: document.getElementById('defaulterDueDate').value,
        status: document.getElementById('defaulterStatus').value,
        agent: document.getElementById('defaulterAgent').value
    };

    try {
        const docRef = await addDoc(collection(db, "members"), d);
        d.id = docRef.id;
        defaulters.push(d);
        updateAllSections();
        closeModal('defaulterModal');
    } catch(err) { console.error(err); }
};

window.removeDefaulter = async function(id, index) {
    if(confirm('Sure?')) {
        await deleteDoc(doc(db, "members", id));
        defaulters.splice(index, 1);
        updateAllSections();
    }
};

window.updateDefaulterStatus = async function(id, index, newStatus) {
    await updateDoc(doc(db, "members", id), { status: newStatus });
    defaulters[index].status = newStatus;
    updateAllSections();
};

function renderDefaulters() {
    const tbody = document.getElementById('defaulterTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    defaulters.forEach((d, i) => {
        const row = tbody.insertRow();
        const statuses = ['Pending', 'In Progress', 'Recovered', 'Legal'];
        let opts = statuses.map(s => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${s}</option>`).join('');
        row.innerHTML = `
            <td>${d.name}</td><td>${d.contact}</td><td>${d.society}</td><td>₹${d.amount}</td>
            <td>${d.dueDate || ''}</td>
            <td><select onchange="updateDefaulterStatus('${d.id}', ${i}, this.value)" class="status-badge">${opts}</select></td>
            <td>${d.agent}</td>
            <td><button onclick="removeDefaulter('${d.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i></button></td>
        `;
    });
}

function renderRecentDefaulters() { /* MVP simplified */ }

function updateDashboardStats() {
    document.getElementById('totalSocieties').textContent = societies.length;
    document.getElementById('totalAgents').textContent = agents.length;
    document.getElementById('totalDefaulters').textContent = defaulters.length;
}

function updateCharts() { /* Keeping empty for streamlined code in MVP */ }

document.addEventListener('authReady', () => initializeData());