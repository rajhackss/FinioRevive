import { auth, db } from "./firebase-config.js";
import { collection, getDocs, updateDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let recoveries = [];
let personnel = [];

async function initializeData() {
    try {
        recoveries = [];
        personnel = [];

        // Fetch all recoveries
        const recSnap = await getDocs(collection(db, "recoveries"));
        recSnap.forEach(d => recoveries.push({ id: d.id, ...d.data() }));

        // Fetch all agents and BDMs for commission calculation
        const userQ = query(collection(db, "users"), where("role", "in", ["agent", "bdm"]));
        const userSnap = await getDocs(userQ);
        userSnap.forEach(d => personnel.push({ id: d.id, ...d.data() }));

        updateAllSections();
    } catch(err) { console.error("Error loading accounts data: ", err); }
}

function updateAllSections() {
    updateDashboardStats();
    renderRecoveries();
    renderCommissions();
}

window.showSection = function(sectionId, element) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(l => l.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    if (element) element.classList.add('active');
};

window.verifyRecovery = async function(id, status, idx) {
    try {
        await updateDoc(doc(db, "recoveries", id), { status: status });
        recoveries[idx].status = status;
        updateAllSections();
        alert('Recovery marked as ' + status);
    } catch(err) { alert(err.message); }
};

function renderRecoveries() {
    const tbody = document.getElementById('reconciliationTable');
    const recent = document.getElementById('recentRecoveries');
    if(!tbody || !recent) return;

    tbody.innerHTML = '';
    recent.innerHTML = '';

    recoveries.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach((r, i) => {
        // Full table
        const row = tbody.insertRow();
        const statusClass = r.status === 'Verified' ? 'recovered' : (r.status === 'Rejected' ? 'inactive' : 'pending');
        row.innerHTML = `
            <td>${r.date}</td><td>${r.recorded_by}</td><td>₹${r.amount}</td>
            <td>${r.mode}</td><td>${r.receiptNo || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${r.status}</span></td>
            <td>
                ${r.status === 'Completed' ? `<button class="btn-small" onclick="verifyRecovery('${r.id}', 'Verified', ${i})">Verify</button> <button class="btn-small cancel-btn" onclick="verifyRecovery('${r.id}', 'Rejected', ${i})">Reject</button>` : '-'}
            </td>
        `;

        // Dashboard table
        if(i < 5) {
            recent.innerHTML += `<tr><td>${r.date}</td><td>${r.recorded_by}</td><td>₹${r.amount}</td><td>${r.mode}</td><td><span class="status-badge ${statusClass}">${r.status}</span></td></tr>`;
        }
    });

}

function renderCommissions() {
    const tbody = document.getElementById('commissionTable');
    if(!tbody) return;
    tbody.innerHTML = '';

    personnel.forEach(p => {
        // Calculate total recoveries by this agent
        const total = recoveries.filter(r => r.recorded_by === p.name && r.status === 'Verified')
                                .reduce((sum, r) => sum + r.amount, 0);

        const commission = total * 0.05; // 5% generic commission for MVP
        
        if(total > 0) {
            tbody.innerHTML += `
                <tr>
                    <td>${p.name}</td><td>${p.role.toUpperCase()}</td><td>₹${total}</td>
                    <td>₹${commission.toFixed(2)}</td><td><span class="status-badge pending">Pending Payout</span></td>
                </tr>
            `;
        }
    });
}

function updateDashboardStats() {
    document.getElementById('totalRecoveries').textContent = recoveries.filter(r => r.status === 'Verified').reduce((sum, r) => sum + r.amount, 0);
    document.getElementById('pendingRecon').textContent = recoveries.filter(r => r.status === 'Completed').length;
}

document.addEventListener('authReady', () => {
    initializeData();
});
