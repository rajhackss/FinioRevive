import { auth, db } from "./firebase-config.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Data
let defaulters = [];
let followups = [];
let collections = [];
let promises = [];
let callerName = "";

// Initialize
async function initializeData(userDoc) {
    try {
        callerName = userDoc.name;
        defaulters = [];
        followups = [];
        collections = [];
        promises = [];

        // Fetch defaulters (Pending or In Progress)
        // Note: Firestore doesn't easily do 'not-in' with multiple arrays or complex queries without indexes, 
        // so we'll fetch 'Pending' and 'In Progress' separately or just fetch all and filter in JS for MVP.
        const memSnap = await getDocs(collection(db, "members"));
        memSnap.forEach(d => {
            const data = d.data();
            if(data.status !== 'Recovered' && data.status !== 'Legal') {
                defaulters.push({ id: d.id, ...data });
            }
        });

        // Fetch followups for this telecaller
        const fSnap = await getDocs(query(collection(db, "calls"), where("caller", "==", callerName)));
        fSnap.forEach(d => {
            const data = d.data();
            if(data.nextAction === 'Follow-up' && !data.completed) {
                followups.push({ id: d.id, ...data });
            }
        });

        // Fetch collections by this telecaller
        const cSnap = await getDocs(query(collection(db, "recoveries"), where("recorded_by", "==", callerName)));
        cSnap.forEach(d => collections.push({ id: d.id, ...d.data() }));

        // Fetch promises by this telecaller
        const pSnap = await getDocs(query(collection(db, "promises"), where("recorded_by", "==", callerName)));
        pSnap.forEach(d => promises.push({ id: d.id, ...d.data() }));

        updateAllSections();
    } catch(err) { console.error("Error loading telecaller data:", err); }
}

function updateAllSections() {
    populateDropdowns();
    updateDashboardStats();
    renderCallList();
    renderFollowups();
    renderPayments();
    renderPromises();
    renderTodayCalls();
    updateCharts();
}

function populateDropdowns() {
    const pDef = document.getElementById('paymentDefaulter');
    const prDef = document.getElementById('promiseDefaulter');
    if(pDef) {
        pDef.innerHTML = '<option value="">Select Defaulter</option>';
        defaulters.forEach(d => pDef.innerHTML += `<option value="${d.id}">${d.name} (${d.society})</option>`);
    }
    if(prDef) {
        prDef.innerHTML = '<option value="">Select Defaulter</option>';
        defaulters.forEach(d => prDef.innerHTML += `<option value="${d.id}">${d.name} (${d.society})</option>`);
    }
}

// Global UI mappings
window.showSection = function(sectionId, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) element.classList.add('active');
};

window.openModal = function(modalId) { 
    document.getElementById(modalId).style.display = 'block'; 
    if(modalId === 'paymentModal') document.getElementById('paymentDate').valueAsDate = new Date();
    if(modalId === 'promiseModal') document.getElementById('promiseDate').valueAsDate = new Date();
};
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    const inputs = document.getElementById(modalId).querySelectorAll('input:not([type="date"]):not([type="time"]), select, textarea');
    inputs.forEach(i => i.type!=='button' && (i.tagName==='SELECT' ? i.selectedIndex=0 : i.value=''));
};

// Search Calls
window.searchCalls = function() {
    const term = document.getElementById('callSearch').value.toLowerCase();
    const rows = document.getElementById('callListTable').getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent.toLowerCase();
        rows[i].style.display = text.includes(term) ? '' : 'none';
    }
};

// Calls List
function renderCallList() {
    const tbody = document.getElementById('callListTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(defaulters.length === 0) return tbody.innerHTML = '<tr><td colspan="7">No calls assigned</td></tr>';

    defaulters.forEach((d, i) => {
        const row = tbody.insertRow();
        const statusClass = d.status.toLowerCase().replace(' ', '-');
        row.innerHTML = `
            <td>${d.name}</td><td>${d.contact}</td><td>${d.society}</td><td>₹${d.amount}</td>
            <td>N/A</td>
            <td><span class="status-badge ${statusClass}">${d.status}</span></td>
            <td><button class="btn-small" onclick="alert('Calling ${d.contact}')"><i class="fas fa-phone"></i> Call</button></td>
        `;
    });
}

// Followups
function renderFollowups() {
    const tbody = document.getElementById('followupsTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(followups.length === 0) return tbody.innerHTML = '<tr><td colspan="7">No pending follow-ups</td></tr>';

    followups.forEach((f, i) => {
        const row = tbody.insertRow();
        const member = defaulters.find(d => d.id === f.member_id) || {};
        row.innerHTML = `
            <td>${member.name || 'Unknown'}</td><td>${member.contact || 'N/A'}</td><td>${member.society || 'N/A'}</td>
            <td>${f.date}</td><td>${f.time || '10:00 AM'}</td><td>${f.notes}</td>
            <td><button class="btn-small" onclick="alert('Calling Followup ${member.contact}')"><i class="fas fa-phone"></i> Call</button></td>
        `;
    });
}

function renderTodayCalls() { /* Simplified */ }

// Payment (Collections)
window.recordPayment = async function() {
    const p = {
        member_id: document.getElementById('paymentDefaulter').value,
        amount: parseFloat(document.getElementById('paymentAmount').value),
        mode: document.getElementById('paymentMode').value,
        date: document.getElementById('paymentDate').value,
        promiseDate: document.getElementById('promiseDate').value,
        notes: document.getElementById('paymentNotes').value,
        recorded_by: callerName,
        status: "Completed",
        createdAt: new Date()
    };
    
    if(p.member_id && p.amount) {
        try {
            await addDoc(collection(db, "recoveries"), p);
            
            // update defaulter amount
            const m = defaulters.find(md => md.id === p.member_id);
            if(m) {
                const newAmt = m.amount - p.amount;
                await updateDoc(doc(db, "members", p.member_id), { amount: newAmt, status: newAmt <= 0 ? "Recovered" : "In Progress" });
            }
            showNotification('Payment recorded!', 'success');
            closeModal('paymentModal');
            initializeData({name: callerName}); // Refresh
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderPayments() {
    const tbody = document.getElementById('paymentTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    collections.forEach(c => {
        const d = defaulters.find(x => x.id === c.member_id) || {};
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.date}</td><td>${d.name||'Unknown'}</td><td>₹${c.amount}</td><td>${c.mode}</td>
            <td>${c.promiseDate || 'N/A'}</td>
            <td><span class="status-badge recovered">${c.status}</span></td>
            <td>-</td>
        `;
    });
}

// Promises
window.addPromise = async function() {
    const p = {
        member_id: document.getElementById('promiseDefaulter').value,
        amount: document.getElementById('promiseAmount').value,
        date: document.getElementById('promiseDate').value,
        time: document.getElementById('promiseTime').value,
        notes: document.getElementById('promiseNotes').value,
        recorded_by: callerName,
        status: "Active",
        createdAt: new Date()
    };
    
    if(p.member_id && p.amount) {
        try {
            await addDoc(collection(db, "promises"), p);
            showNotification('Promise recorded!', 'success');
            closeModal('promiseModal');
            initializeData({name: callerName}); // Refresh
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderPromises() {
    const grid = document.getElementById('promisesGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    promises.forEach((p, i) => {
        const d = defaulters.find(x => x.id === p.member_id) || {};
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon"><i class="fas fa-handshake"></i></div>
                <div><h3>${d.name||'Unknown'}</h3><p>₹${p.amount}</p></div>
            </div>
            <div class="card-body">
                <p><i class="fas fa-calendar"></i> Promise: ${p.date} ${p.time}</p>
                <p><i class="fas fa-phone"></i> ${d.contact||'N/A'}</p>
                <p><span class="status-badge progress">${p.status}</span></p>
            </div>
            <div class="card-footer"><button class="btn-small" onclick="openModal('paymentModal')">Collect</button></div>
        `;
        grid.appendChild(card);
    });
}

function updateDashboardStats() {
    document.getElementById('totalCalls').textContent = "0"; // Mock MVP
    document.getElementById('connectedCalls').textContent = "0";
    document.getElementById('followupCalls').textContent = followups.length;
    document.getElementById('callCollections').textContent = collections.reduce((s,c)=>s+c.amount,0);
}

function updateCharts() { /* Keep lightweight for MVP */ }

window.generateReport = function(type) { showNotification(`${type} report downloaded!`, 'success'); }
window.saveSettings = function() { showNotification('Settings saved successfully!', 'success'); }
window.showNotification = function(message, type) {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) event.target.style.display = 'none';
}

document.addEventListener('authReady', (e) => {
    initializeData(e.detail.userDoc);
});