import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Call this function in each protected page's module script
export function guardPage(allowedRole) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Not logged in
            window.location.href = "login.html";
            return;
        }
        
        // Fetch role
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                if (allowedRole && role !== allowedRole && role !== "superadmin") { 
                    // superadmin can access everything, others only their allowed role
                    alert("Access Denied. You do not have permission for this page.");
                    window.location.href = "login.html"; // Or a generic unauthorized page
                }
                
                // Expose user ID and Role globally or dispatch an event if needed
                window.currentUser = user;
                window.currentUserRole = role;
                window.currentUserId = user.uid;
                
                // Dispatch custom event to notify scripts that auth is ready
                const event = new CustomEvent('authReady', {
                    detail: { user, role, userDoc: userDoc.data() }
                });
                document.dispatchEvent(event);
                
                // Update header username if present
                const userNameDisplay = document.getElementById("userNameDisplay");
                if (userNameDisplay) {
                    userNameDisplay.innerText = userDoc.data().name;
                }
                
            } else {
                alert("User record missing in database.");
                signOut(auth).then(() => {
                    window.location.href = "login.html";
                });
            }
        } catch (err) {
            console.error("Auth Guard Error:", err);
            alert("Error checking permissions.");
        }
    });
}

// Global Logout function
export function attachLogout(buttonId) {
    const btn = document.getElementById(buttonId);
    if(btn) {
        btn.addEventListener("click", () => {
            signOut(auth).then(() => {
                window.location.href = "login.html";
            }).catch(err => {
                console.error("Logout Error:", err);
            });
        });
    }
}
