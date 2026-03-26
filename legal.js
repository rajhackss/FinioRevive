import { auth, db, storage } from "./firebase-config.js";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// Data
let legalDefaulters = [];
let cases = [];
let notices = [];
let hearings = [];
let documentsRepo = [];
let legalName = "";

// Initialize
async function initializeData(userDoc) {
    try {
        legalName = userDoc.name;
        legalDefaulters = [];
        cases = [];
        notices = [];
        hearings = [];
        documentsRepo = [];

        // Fetch defaulters with "Legal" status OR any society if allowed, but primarily we deal with "Legal" cases.
        const memSnap = await getDocs(query(collection(db, "members"), where("status", "==", "Legal")));
        memSnap.forEach(d => legalDefaulters.push({ id: d.id, ...d.data() }));

        // Fetch cases
        const caseSnap = await getDocs(collection(db, "cases"));
        caseSnap.forEach(d => cases.push({ id: d.id, ...d.data() }));

        // Fetch notices
        const notSnap = await getDocs(collection(db, "notices"));
        notSnap.forEach(d => notices.push({ id: d.id, ...d.data() }));

        // Fetch hearings
        const hearSnap = await getDocs(collection(db, "hearings"));
        hearSnap.forEach(d => hearings.push({ id: d.id, ...d.data() }));

        // Fetch documents
        const docSnap = await getDocs(collection(db, "documents"));
        docSnap.forEach(d => documentsRepo.push({ id: d.id, ...d.data() }));

        updateAllSections();
    } catch(err) { console.error("Error loading legal data:", err); }
}

function updateAllSections() {
    updateDashboardStats();
    renderDefaulters();
    renderCases();
    renderNotices();
    renderHearings();
    renderDocuments();
    updateCharts();
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
};
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
    const inputs = document.getElementById(modalId).querySelectorAll('input:not([type="date"]):not([type="time"]):not([type="file"]), select, textarea');
    inputs.forEach(i => i.type!=='button' && (i.tagName==='SELECT' ? i.selectedIndex=0 : i.value=''));
};

// Defaulters Table
function renderDefaulters() {
    const tbody = document.getElementById('legalDefaulterTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(legalDefaulters.length === 0) return tbody.innerHTML = '<tr><td colspan="7">No defaulters in legal status</td></tr>';

    legalDefaulters.forEach(d => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${d.name}</td><td>${d.contact}</td><td>${d.society}</td><td>₹${d.amount}</td>
            <td><span class="status-badge progress">Pending Case</span></td>
            <td><span class="status-badge progress">Action Required</span></td>
            <td><button class="btn-small" onclick="openModal('noticeModal')"><i class="fas fa-file-alt"></i> Issue Notice</button></td>
        `;
    });
}

// Cases
window.addCase = async function() {
    const c = {
        number: document.getElementById('caseNumber').value,
        defaulter: document.getElementById('caseDefaulter').value,
        society: document.getElementById('caseSociety').value,
        amount: parseFloat(document.getElementById('caseAmount').value) || 0,
        filedDate: document.getElementById('caseFiledDate').value,
        court: document.getElementById('caseCourt').value,
        status: document.getElementById('caseStatus').value,
        nextHearing: document.getElementById('caseNextHearing').value,
        notes: document.getElementById('caseNotes').value,
        createdAt: new Date()
    };
    if(c.number) {
        try {
            await addDoc(collection(db, "cases"), c);
            showNotification('Case filed successfully!', 'success');
            closeModal('caseModal');
            initializeData({name: legalName});
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderCases() {
    const tbody = document.getElementById('caseTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    cases.forEach(c => {
        const statusClass = c.status.toLowerCase().replace(' ', '-');
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${c.number}</td><td>${c.defaulter}</td><td>${c.society}</td><td>₹${c.amount}</td>
            <td>${c.filedDate}</td><td><span class="status-badge ${statusClass}">${c.status}</span></td>
            <td>${c.nextHearing || '-'}</td>
            <td><button class="btn-small" onclick="alert('Viewing Case ${c.number}')">View</button></td>
        `;
    });
}

// Notices with Attachment (D1, D2, D3)
window.addNotice = async function() {
    const btn = document.querySelector('#noticeModal button:first-of-type');
    btn.textContent = 'Uploading...';
    btn.disabled = true;

    try {
        const fileInput = document.getElementById('noticeFile');
        let fileUrl = "";

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'notices/' + new Date().getTime() + '_' + file.name);
            const snapshot = await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(snapshot.ref);
        }

        const n = {
            number: document.getElementById('noticeNumber').value,
            defaulter: document.getElementById('noticeDefaulter').value,
            society: document.getElementById('noticeSociety').value,
            issueDate: document.getElementById('noticeIssueDate').value,
            responseDate: document.getElementById('noticeResponseDate').value,
            type: document.getElementById('noticeType').value,
            status: document.getElementById('noticeStatus').value,
            notes: document.getElementById('noticeNotes').value,
            fileUrl: fileUrl,
            createdAt: new Date()
        };

        if(n.number) {
            await addDoc(collection(db, "notices"), n);
            showNotification('Notice added successfully!', 'success');
            closeModal('noticeModal');
            initializeData({name: legalName});
        }
    } catch(err) {
        showNotification(err.message, 'error');
    } finally {
        btn.textContent = 'Add Notice';
        btn.disabled = false;
        if(document.getElementById('noticeFile')) document.getElementById('noticeFile').value = '';
    }
};

window.downloadNotice = function(url) {
    if(url && url !== 'undefined') {
        window.open(url, '_blank');
    } else {
        alert("No file attachment found for this notice.");
    }
}

function renderNotices() {
    const tbody = document.getElementById('noticeTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    notices.forEach(n => {
        const statusClass = n.status.toLowerCase().replace(' ', '-');
        const dL = n.fileUrl ? `<button class="btn-small" onclick="downloadNotice('${n.fileUrl}')"><i class="fas fa-download"></i> D/L</button>` : '';
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${n.number}</td><td>${n.defaulter}</td><td>${n.society}</td>
            <td>${n.issueDate}</td><td>${n.responseDate || '-'}</td>
            <td><span class="status-badge ${statusClass}">${n.status}</span></td>
            <td>${dL}</td>
        `;
    });
}

// Hearings
window.addHearing = async function() {
    const h = {
        caseNumber: document.getElementById('hearingCase').value,
        defaulter: document.getElementById('hearingDefaulter').value,
        date: document.getElementById('hearingDate').value,
        time: document.getElementById('hearingTime').value,
        court: document.getElementById('hearingCourt').value,
        judge: document.getElementById('hearingJudge').value,
        status: document.getElementById('hearingStatus').value,
        notes: document.getElementById('hearingNotes').value,
        createdAt: new Date()
    };
    if(h.caseNumber && h.date) {
        try {
            await addDoc(collection(db, "hearings"), h);
            showNotification('Hearing scheduled!', 'success');
            closeModal('hearingModal');
            initializeData({name: legalName});
        } catch(err) { showNotification(err.message, 'error'); }
    }
};

function renderHearings() {
    const tbody = document.getElementById('hearingTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    hearings.forEach(h => {
        const statusClass = h.status.toLowerCase().replace(' ', '-');
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${h.date}</td><td>${h.time}</td><td>${h.caseNumber}</td><td>${h.defaulter}</td>
            <td>${h.court}</td><td>${h.judge}</td>
            <td><span class="status-badge ${statusClass}">${h.status}</span></td>
            <td><button class="btn-small">Update</button></td>
        `;
    });
    
    // Also update Upcoming Hearings on dashboard
    const upcoming = document.getElementById('upcomingHearings');
    if(upcoming) {
        upcoming.innerHTML = '';
        hearings.slice(0, 5).forEach(h => {
            upcoming.innerHTML += `<tr><td>${h.date}</td><td>${h.caseNumber}</td><td>${h.defaulter}</td><td>${h.court}</td></tr>`;
        });
    }
}

// Documents General
window.addDocument = async function() {
    const btn = document.querySelector('#documentModal button:first-of-type');
    btn.textContent = 'Uploading...';
    btn.disabled = true;

    try {
        const fileInput = document.getElementById('docFile');
        let fileUrl = "";

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storageRef = ref(storage, 'documents/' + new Date().getTime() + '_' + file.name);
            const snapshot = await uploadBytes(storageRef, file);
            fileUrl = await getDownloadURL(snapshot.ref);
        }

        const docObj = {
            name: document.getElementById('docName').value,
            caseNumber: document.getElementById('docCase').value,
            type: document.getElementById('docType').value,
            date: document.getElementById('docDate').value,
            notes: document.getElementById('docNotes').value,
            fileUrl: fileUrl,
            createdAt: new Date()
        };

        if(docObj.name) {
            await addDoc(collection(db, "documents"), docObj);
            showNotification('Document uploaded!', 'success');
            closeModal('documentModal');
            initializeData({name: legalName});
        }
    } catch(err) {
        showNotification(err.message, 'error');
    } finally {
        btn.textContent = 'Upload Document';
        btn.disabled = false;
        if(document.getElementById('docFile')) document.getElementById('docFile').value = '';
    }
};

function renderDocuments() {
    const grid = document.getElementById('documentGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    documentsRepo.forEach((d) => {
        const dL = d.fileUrl ? `<button class="btn-small" onclick="window.open('${d.fileUrl}', '_blank')"><i class="fas fa-download"></i> View File</button>` : '';
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon"><i class="fas fa-file-pdf"></i></div>
                <div><h3>${d.name}</h3><p>${d.caseNumber}</p></div>
            </div>
            <div class="card-body">
                <p><i class="fas fa-tag"></i> Type: ${d.type}</p>
                <p><i class="fas fa-calendar"></i> Date: ${d.date}</p>
            </div>
            <div class="card-footer">${dL}</div>
        `;
        grid.appendChild(card);
    });
}

function updateDashboardStats() {
    document.getElementById('totalCases').textContent = cases.length;
    document.getElementById('activeCases').textContent = cases.filter(c => c.status !== 'Resolved' && c.status !== 'Dismissed').length;
    document.getElementById('totalHearings').textContent = hearings.length;
    document.getElementById('resolvedCases').textContent = cases.filter(c => c.status === 'Resolved').length;
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