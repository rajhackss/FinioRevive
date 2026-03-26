import { auth, db, firebaseConfig } from "./firebase-config.js";
import { collection, query, getDocs, setDoc, doc, addDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// Secondary App for creating users without logging out Admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

// Data storage
let defaulters = [];
let societies = [];
let agents = []; // agents are users where role == 'agent'
let teamMembers = []; // bdm, telecaller, legal, accounts

// Chart variables
let recoveryChart, statusChart, trendChart;

// Initialize
async function initializeData() {
    await fetchAllData();
    updateAllSections();
}

async function fetchAllData() {
    try {
        defaulters = [];
        societies = [];
        agents = [];
        teamMembers = [];

        // Fetch members (defaulters)
        const membersSnap = await getDocs(collection(db, "members"));
        membersSnap.forEach(d => defaulters.push({ id: d.id, ...d.data() }));

        // Fetch societies
        const socSnap = await getDocs(collection(db, "societies"));
        socSnap.forEach(d => societies.push({ id: d.id, ...d.data() }));

        // Fetch users (Agents & Team)
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.forEach(d => {
            const u = { id: d.id, ...d.data() };
            if (u.role === 'agent') {
                agents.push(u);
            } else if (u.role !== 'superadmin' && u.role !== 'agent') {
                teamMembers.push(u);
            }
        });
    } catch (err) {
        console.error("Error fetching data:", err);
        showNotification("Error loading data from database.", "error");
    }
}

function updateAllSections() {
    populateDropdowns();
    updateDashboardStats();
    renderDefaulters();
    renderSocieties();
    renderAgents();
    renderTeam();
    renderRecentDefaulters();
    updateCharts();
}

// Populate Society dropdowns in modals
function populateDropdowns() {
    const socDropdowns = ['defaulterSociety', 'agentSociety'];
    socDropdowns.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = '<option value="">-- Select Society --</option>';
        societies.forEach(s => {
            el.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    });
}

// Show section
window.showSection = function(sectionId, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));

    document.getElementById(sectionId).classList.add('active');
    if (element) element.classList.add('active');
};

// Modal functions
window.openModal = function(modalId) {
    document.getElementById(modalId).style.display = 'block';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    clearModalInputs(modalId);
};

function clearModalInputs(modalId) {
    const modal = document.getElementById(modalId);
    const inputs = modal.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type !== 'button') {
            if (input.tagName === 'SELECT') {
                input.selectedIndex = 0;
            } else {
                input.value = '';
            }
        }
    });
}

// Defaulter functions
window.addDefaulter = async function() {
    const d = {
        name: document.getElementById('defaulterName').value,
        contact: document.getElementById('defaulterContact').value,
        society: document.getElementById('defaulterSociety').value,
        amount: parseFloat(document.getElementById('defaulterAmount').value),
        dueDate: document.getElementById('defaulterDueDate').value,
        status: document.getElementById('defaulterStatus').value
    };

    if (Object.values(d).every(v => v !== "" && v !== undefined && !Number.isNaN(v))) {
        try {
            const docRef = await addDoc(collection(db, "members"), d);
            d.id = docRef.id;
            defaulters.push(d);
            updateAllSections();
            closeModal('defaulterModal');
            showNotification('Defaulter added successfully!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error adding defaulter', 'error');
        }
    } else {
        showNotification('Please fill all fields properly!', 'error');
    }
};

window.removeDefaulter = async function(id, index) {
    if (confirm('Are you sure you want to remove this defaulter?')) {
        try {
            await deleteDoc(doc(db, "members", id));
            defaulters.splice(index, 1);
            updateAllSections();
            showNotification('Defaulter removed!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error removing defaulter', 'error');
        }
    }
};

window.updateDefaulterStatus = async function(id, index, newStatus) {
    try {
        await updateDoc(doc(db, "members", id), { status: newStatus });
        defaulters[index].status = newStatus;
        updateAllSections();
        showNotification('Status updated!', 'success');
    } catch(err) {
        console.error(err);
        showNotification('Error updating status', 'error');
    }
};

function renderDefaulters() {
    const tbody = document.getElementById('defaulterTable');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (defaulters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No defaulters found</td></tr>';
        return;
    }

    defaulters.forEach((d, i) => {
        const row = tbody.insertRow();
        const statusClass = d.status.toLowerCase().replace(' ', '-');
        row.innerHTML = `
            <td>${d.name}</td>
            <td>${d.contact}</td>
            <td>${d.society}</td>
            <td>₹${d.amount.toLocaleString()}</td>
            <td>${d.dueDate}</td>
            <td>
                <select onchange="updateDefaulterStatus('${d.id}', ${i}, this.value)" class="status-badge ${statusClass}">
                    <option value="Pending" ${d.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${d.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Recovered" ${d.status === 'Recovered' ? 'selected' : ''}>Recovered</option>
                    <option value="Legal" ${d.status === 'Legal' ? 'selected' : ''}>Legal</option>
                </select>
            </td>
            <td>
                <button onclick="removeDefaulter('${d.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function renderRecentDefaulters() {
    const tbody = document.getElementById('recentDefaulters');
    if (!tbody) return;
    tbody.innerHTML = '';
    const recent = defaulters.slice(-5).reverse();

    recent.forEach(d => {
        const row = tbody.insertRow();
        const statusClass = d.status.toLowerCase().replace(' ', '-');
        row.innerHTML = `
            <td>${d.name}</td>
            <td>${d.society}</td>
            <td>₹${d.amount.toLocaleString()}</td>
            <td><span class="status-badge ${statusClass}">${d.status}</span></td>
        `;
    });
}

// Society functions
window.addSociety = async function() {
    const s = {
        name: document.getElementById('societyName').value,
        address: document.getElementById('societyAddress').value,
        city: document.getElementById('societyCity').value,
        units: parseInt(document.getElementById('societyUnits').value),
        status: document.getElementById('societyStatus').value
    };

    if (Object.values(s).every(v => v !== "" && v !== undefined && !Number.isNaN(v))) {
        try {
            const docRef = await addDoc(collection(db, "societies"), s);
            s.id = docRef.id;
            societies.push(s);
            updateAllSections();
            closeModal('societyModal');
            showNotification('Society added successfully!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error adding society', 'error');
        }
    } else {
        showNotification('Please fill all fields properly!', 'error');
    }
};

window.removeSociety = async function(id, index) {
    if (confirm('Are you sure?')) {
        try {
            await deleteDoc(doc(db, "societies", id));
            societies.splice(index, 1);
            updateAllSections();
            showNotification('Society removed!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error removing', 'error');
        }
    }
};

function renderSocieties() {
    const grid = document.getElementById('societiesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (societies.length === 0) {
        grid.innerHTML = '<div class="no-data">No societies found</div>';
        return;
    }

    societies.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon"><i class="fas fa-building"></i></div>
                <div>
                    <h3>${s.name}</h3>
                    <p>${s.city}</p>
                </div>
            </div>
            <div class="card-body">
                <p><i class="fas fa-map-marker-alt"></i> ${s.address}</p>
                <p><i class="fas fa-door-open"></i> ${s.units} Units</p>
                <p><span class="status-badge ${s.status.toLowerCase()}">${s.status}</span></p>
            </div>
            <div class="card-footer">
                <button onclick="removeSociety('${s.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i> Remove</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// User Creation Functions
async function createUserInFirebase(email, password, name, phone, role, society = null, status = 'Active') {
    try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const u = {
            uid: cred.user.uid,
            email: email,
            name: name,
            phone: phone,
            role: role,
            status: status,
            createdAt: new Date()
        };
        if(society) u.assigned_society = society;
        
        await setDoc(doc(db, "users", cred.user.uid), u);
        await signOut(secondaryAuth); // Sign out of secondary instance
        
        u.id = cred.user.uid;
        return u;
    } catch(err) {
        console.error(err);
        showNotification(err.message, 'error');
        return null;
    }
}

// Agent functions
window.addAgent = async function() {
    const name = document.getElementById('agentName').value;
    const email = document.getElementById('agentEmail').value;
    const phone = document.getElementById('agentPhone').value;
    const society = document.getElementById('agentSociety').value; // Dropdown now populated
    const status = document.getElementById('agentStatus').value;
    const password = "Password@123"; // Default password since it wasn't in the form

    if (name && email && phone) {
        showNotification('Creating agent...', 'success');
        const user = await createUserInFirebase(email, password, name, phone, "agent", society, status);
        if(user) {
            agents.push(user);
            updateAllSections();
            closeModal('agentModal');
            showNotification('Agent added successfully! Default pass is Password@123', 'success');
        }
    } else {
        showNotification('Please fill all fields!', 'error');
    }
};

window.removeAgent = async function(id, index) {
    if (confirm('Are you sure? Removing from DB will delete user profile but not Firebase Auth (needs admin sdk). Proceed?')) {
        try {
            await deleteDoc(doc(db, "users", id));
            agents.splice(index, 1);
            updateAllSections();
            showNotification('Agent removed!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error removing', 'error');
        }
    }
};

function renderAgents() {
    const grid = document.getElementById('agentsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (agents.length === 0) {
        grid.innerHTML = '<div class="no-data">No agents found</div>';
        return;
    }

    agents.forEach((a, i) => {
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon"><i class="fas fa-user-tie"></i></div>
                <div>
                    <h3>${a.name}</h3>
                    <p>${a.assigned_society || 'Unassigned'}</p>
                </div>
            </div>
            <div class="card-body">
                <p><i class="fas fa-envelope"></i> ${a.email}</p>
                <p><i class="fas fa-phone"></i> ${a.phone}</p>
                <p><span class="status-badge ${(a.status||'active').toLowerCase()}">${a.status || 'Active'}</span></p>
            </div>
            <div class="card-footer">
                <button onclick="removeAgent('${a.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i> Remove</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Team functions
window.addTeamMember = async function() {
    const name = document.getElementById('teamName').value;
    const email = document.getElementById('teamEmail').value;
    const phone = document.getElementById('teamPhone').value;
    const role = document.getElementById('teamRole').value.toLowerCase(); // Ensure lowercase matching our scheme
    const status = document.getElementById('teamStatus').value;
    const password = "Password@123";

    if (name && email && role) {
        showNotification('Creating member...', 'success');
        const user = await createUserInFirebase(email, password, name, phone, role, null, status);
        if(user) {
            teamMembers.push(user);
            updateAllSections();
            closeModal('teamModal');
            showNotification('Team member added! Default pass is Password@123', 'success');
        }
    } else {
        showNotification('Please fill all fields!', 'error');
    }
};

window.removeTeamMember = async function(id, index) {
    if (confirm('Are you sure?')) {
        try {
            await deleteDoc(doc(db, "users", id));
            teamMembers.splice(index, 1);
            updateAllSections();
            showNotification('Team member removed!', 'success');
        } catch(err) {
            console.error(err);
            showNotification('Error removing', 'error');
        }
    }
};

function renderTeam() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (teamMembers.length === 0) {
        grid.innerHTML = '<div class="no-data">No team members found</div>';
        return;
    }

    teamMembers.forEach((m, i) => {
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon"><i class="fas fa-user-cog"></i></div>
                <div>
                    <h3>${m.name}</h3>
                    <p>${m.role.toUpperCase()}</p>
                </div>
            </div>
            <div class="card-body">
                <p><i class="fas fa-envelope"></i> ${m.email}</p>
                <p><i class="fas fa-phone"></i> ${m.phone || 'N/A'}</p>
                <p><span class="status-badge ${(m.status||'active').toLowerCase()}">${m.status || 'Active'}</span></p>
            </div>
            <div class="card-footer">
                <button onclick="removeTeamMember('${m.id}', ${i})" class="delete-btn"><i class="fas fa-trash"></i> Remove</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Dashboard stats
function updateDashboardStats() {
    document.getElementById('totalDefaulters').textContent = defaulters.length;
    document.getElementById('totalSocieties').textContent = societies.length;
    document.getElementById('totalAgents').textContent = agents.length;
    
    const totalRecovery = defaulters
        .filter(d => d.status === 'Recovered')
        .reduce((sum, d) => sum + (d.amount || 0), 0);
    document.getElementById('totalRecovery').textContent = totalRecovery.toLocaleString();
}

// Charts
function updateCharts() {
    updateRecoveryChart();
    updateStatusChart();
    updateTrendChart();
}

function updateRecoveryChart() {
    const ctx = document.getElementById('recoveryChart');
    if (!ctx) return;
    if (recoveryChart) recoveryChart.destroy();

    const statusAmounts = {
        'Pending': defaulters.filter(d => d.status === 'Pending').reduce((s, d) => s + (d.amount||0), 0),
        'In Progress': defaulters.filter(d => d.status === 'In Progress').reduce((s, d) => s + (d.amount||0), 0),
        'Recovered': defaulters.filter(d => d.status === 'Recovered').reduce((s, d) => s + (d.amount||0), 0),
        'Legal': defaulters.filter(d => d.status === 'Legal').reduce((s, d) => s + (d.amount||0), 0)
    };

    recoveryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'In Progress', 'Recovered', 'Legal'],
            datasets: [{
                data: Object.values(statusAmounts),
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: 'white' } } }
        }
    });
}

function updateStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    if (statusChart) statusChart.destroy();

    const statusCounts = {
        'Pending': defaulters.filter(d => d.status === 'Pending').length,
        'In Progress': defaulters.filter(d => d.status === 'In Progress').length,
        'Recovered': defaulters.filter(d => d.status === 'Recovered').length,
        'Legal': defaulters.filter(d => d.status === 'Legal').length
    };

    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Pending', 'In Progress', 'Recovered', 'Legal'],
            datasets: [{
                label: 'Number of Defaulters',
                data: Object.values(statusCounts),
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
}

function updateTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Recovery Amount (₹)',
                data: [50000, 75000, 120000, 80000, 150000, 200000], // Mock logic for MVP
                borderColor: '#2563eb',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(255,255,255,0.1)' } } }
        }
    });
}

// Report generation
window.generateReport = function(type) {
    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} report downloaded!`, 'success');
}

// Settings
window.saveSettings = function() {
    showNotification('Settings saved successfully!', 'success');
}

// Notification
window.showNotification = function(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Initialize on auth ready
document.addEventListener('authReady', (e) => {
    // Auth loaded successfully and we are the admin
    initializeData();
});