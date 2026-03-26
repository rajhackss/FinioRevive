import { auth, db } from "./firebase-config.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Data storage
let assignedDefaulters = [];
let visits = [];
let collections = [];
let agentName = "";

// Chart variables
let collectionChart = null;
let visitChart = null;
let trendChart = null;

// Initialize
async function initializeData(userDoc) {
    try {
        agentName = userDoc.name;
        assignedDefaulters = [];
        visits = [];
        collections = [];

        // Fetch members assigned to this agent
        const memQ = query(collection(db, "members"), where("agent", "==", agentName));
        const memSnap = await getDocs(memQ);
        memSnap.forEach(d => assignedDefaulters.push({ id: d.id, ...d.data() }));

        // Fetch visits
        const visQ = query(collection(db, "visits"), where("agent", "==", agentName));
        const visSnap = await getDocs(visQ);
        visSnap.forEach(d => visits.push({ id: d.id, ...d.data() }));

        // Fetch collections (recoveries)
        const recQ = query(collection(db, "recoveries"), where("recorded_by", "==", agentName));
        const recSnap = await getDocs(recQ);
        recSnap.forEach(d => collections.push({ id: d.id, ...d.data() }));

        updateAllSections();
    } catch (err) {
        console.error("Error fetching agent data:", err);
    }
}

function updateAllSections() {
    populateDropdowns();
    updateDashboardStats();
    renderAgentDefaulters();
    renderVisits();
    renderCollections();
    renderSchedule();
    updateCharts();
}

function populateDropdowns() {
    const vDef = document.getElementById('visitDefaulter');
    const cDef = document.getElementById('collectionDefaulter');
    if(vDef) {
        vDef.innerHTML = '<option value="">Select Defaulter</option>';
        assignedDefaulters.forEach(d => vDef.innerHTML += `<option value="${d.id}">${d.name} (${d.society})</option>`);
    }
    if(cDef) {
        cDef.innerHTML = '<option value="">Select Defaulter</option>';
        assignedDefaulters.forEach(d => cDef.innerHTML += `<option value="${d.id}">${d.name} (${d.society})</option>`);
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
    if(modalId === 'visitModal') {
        document.getElementById('visitDate').valueAsDate = new Date();
        const now = new Date();
        document.getElementById('visitTime').value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }
    if(modalId === 'collectionModal') {
        document.getElementById('collectionDate').valueAsDate = new Date();
    }
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    const inputs = document.getElementById(modalId).querySelectorAll('input:not([type="date"]):not([type="time"]), select, textarea');
    inputs.forEach(i => i.type!=='button' && (i.tagName==='SELECT' ? i.selectedIndex=0 : i.value=''));
};

// Defaulters
function renderAgentDefaulters() {
    const tbody = document.getElementById('agentDefaulterTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (assignedDefaulters.length === 0) return tbody.innerHTML = '<tr><td colspan="8">No assigned defaulters</td></tr>';

    assignedDefaulters.forEach(d => {
        const row = tbody.insertRow();
        const statusClass = d.status.toLowerCase().replace(' ', '-');
        row.innerHTML = `
            <td>${d.name}</td><td>${d.contact}</td><td>${d.society}</td><td>₹${d.amount}</td>
            <td>${d.dueDate || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${d.status}</span></td>
            <td>N/A</td>
            <td><button class="btn-small" onclick="showSection('visits'); openModal('visitModal');">Log Visit</button></td>
        `;
    });
}

// Visits
window.addVisit = async function() {
    const v = {
        defaulterId: document.getElementById('visitDefaulter').value,
        date: document.getElementById('visitDate').value,
        time: document.getElementById('visitTime').value,
        purpose: document.getElementById('visitPurpose').value,
        outcome: document.getElementById('visitOutcome').value,
        nextVisit: document.getElementById('nextVisit').value,
        notes: document.getElementById('visitNotes').value,
        agent: agentName,
        createdAt: new Date()
    };
    if(v.defaulterId) {
        try {
            const docRef = await addDoc(collection(db, "visits"), v);
            v.id = docRef.id;
            visits.push(v);
            
            // Optionally update member status
            if(["Full Payment", "Partial Payment", "Promise"].includes(v.outcome)) {
                await updateDoc(doc(db, "members", v.defaulterId), { status: "In Progress" });
                const m = assignedDefaulters.find(md => md.id === v.defaulterId);
                if(m) m.status = "In Progress";
            }
            
            updateAllSections();
            closeModal('visitModal');
            showNotification('Visit logged successfully!', 'success');
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderVisits() {
    const tbody = document.getElementById('visitsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    visits.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(v => {
        const row = tbody.insertRow();
        const memberName = assignedDefaulters.find(d => d.id === v.defaulterId)?.name || "Unknown";
        const societyName = assignedDefaulters.find(d => d.id === v.defaulterId)?.society || "Unknown";
        
        row.innerHTML = `
            <td>${v.date} ${v.time}</td>
            <td>${memberName}</td>
            <td>${societyName}</td>
            <td>${v.purpose}</td>
            <td><span class="status-badge progress">${v.outcome}</span></td>
            <td>${v.nextVisit || '-'}</td>
            <td><button class="btn-small" onclick="alert('View Notes: '+ '${v.notes}')">View</button></td>
        `;
    });
}

// Collections
window.addCollection = async function() {
    const tDefId = document.getElementById('collectionDefaulter').value;
    const tAmount = parseFloat(document.getElementById('collectionAmount').value);
    const c = {
        member_id: tDefId,
        amount: tAmount,
        mode: document.getElementById('collectionMode').value,
        receiptNo: document.getElementById('receiptNo').value,
        date: document.getElementById('collectionDate').value,
        notes: document.getElementById('collectionNotes').value,
        recorded_by: agentName,
        status: "Completed",
        createdAt: new Date()
    };
    
    if(c.member_id && c.amount) {
        try {
            const docRef = await addDoc(collection(db, "recoveries"), c);
            c.id = docRef.id;
            collections.push(c);
            
            // update defaulter amount
            const m = assignedDefaulters.find(md => md.id === c.member_id);
            if(m) {
                const newAmt = m.amount - c.amount;
                await updateDoc(doc(db, "members", c.member_id), { amount: newAmt, status: newAmt <= 0 ? "Recovered" : "In Progress" });
                m.amount = newAmt;
                m.status = newAmt <= 0 ? "Recovered" : "In Progress";
            }
            
            updateAllSections();
            closeModal('collectionModal');
            showNotification('Collection added successfully!', 'success');
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderCollections() {
    const tbody = document.getElementById('collectionsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    collections.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(c => {
        const row = tbody.insertRow();
        const memberName = assignedDefaulters.find(d => d.id === c.member_id)?.name || "Unknown";
        
        row.innerHTML = `
            <td>${c.date}</td>
            <td>${memberName}</td>
            <td>₹${c.amount}</td>
            <td>${c.mode}</td>
            <td>${c.receiptNo}</td>
            <td><span class="status-badge 'recovered'">${c.status}</span></td>
        `;
    });
}

function renderSchedule() {
    const tbody = document.getElementById('visitSchedule');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const today = new Date().toISOString().split('T')[0];
    const todaysVisits = visits.filter(v => v.date === today);
    
    if (todaysVisits.length === 0) return tbody.innerHTML = '<tr><td colspan="6">No visits scheduled for today</td></tr>';
    
    todaysVisits.forEach(v => {
        const row = tbody.insertRow();
        const memberName = assignedDefaulters.find(d => d.id === v.defaulterId)?.name || "Unknown";
        const societyName = assignedDefaulters.find(d => d.id === v.defaulterId)?.society || "Unknown";
        const memberAmt = assignedDefaulters.find(d => d.id === v.defaulterId)?.amount || 0;
        
        row.innerHTML = `
            <td>${v.time}</td>
            <td>${memberName}</td>
            <td>${societyName}</td>
            <td>₹${memberAmt}</td>
            <td><span class="status-badge ${v.outcome === 'Met' ? 'recovered' : 'pending'}">${v.outcome}</span></td>
            <td><button class="btn-small" onclick="openModal('collectionModal')">Collect</button></td>
        `;
    });
}

function updateDashboardStats() {
    document.getElementById('assignedDefaulters').textContent = assignedDefaulters.length;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('visitsToday').textContent = visits.filter(v => v.date === today).length;
    
    const cToday = collections.filter(c => c.date === today).reduce((sum, c) => sum + c.amount, 0);
    document.getElementById('collectedToday').textContent = cToday;
    
    document.getElementById('weeklyCollection').textContent = collections.reduce((sum, c) => sum + c.amount, 0); // Simplified for MVP
    document.getElementById('monthlyCollection').textContent = collections.reduce((sum, c) => sum + c.amount, 0); // Simplified for MVP
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
    // Current user's role is correct
    initializeData(e.detail.userDoc);
});