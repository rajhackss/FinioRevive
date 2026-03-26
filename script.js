import { auth, db } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");

// Tab Switching Utility
tabLogin.addEventListener('click', () => {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    title.innerText = "Welcome Back";
    subtitle.innerText = "Sign in to your account to continue.";
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
});

tabRegister.addEventListener('click', () => {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    title.innerText = "Create Account";
    subtitle.innerText = "Register a new platform user.";
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
});

// Utility to route user based on their Firestore role
async function routeUserBasedOnRole(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const role = userDoc.data().role;
            switch(role) {
                case "superadmin":
                    window.location.href = "admin.html";
                    break;
                case "bdm":
                    window.location.href = "bdm.html";
                    break;
                case "agent":
                    window.location.href = "agent.html";
                    break;
                case "telecaller":
                    window.location.href = "telecaller.html";
                    break;
                case "legal":
                    window.location.href = "legal.html";
                    break;
                case "accounts":
                    window.location.href = "accounts.html";
                    break;
                default:
                    alert("Unknown role inside system. Contact Super Admin.");
            }
        } else {
            alert("No user record found in DB for this UID. Cannot determine role.");
        }
    } catch(err) {
        console.error("Error fetching user role:", err);
        alert("Error routing user based on role.");
    }
}

// Handle Login
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    const btn = loginForm.querySelector(".btn");
    
    // basic validation
    if (!email || !pass) return alert("Email and password required");
    btn.innerText = "Signing In...";
    
    signInWithEmailAndPassword(auth, email, pass)
    .then((userCredential) => {
        // Logged in
        routeUserBasedOnRole(userCredential.user.uid);
    })
    .catch((error) => {
        alert("Login Error: " + error.message);
        btn.innerText = "Sign In";
    });
});

// Handle Registration
registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const name = document.getElementById("regName").value;
    const role = document.getElementById("regRole").value;
    const btn = registerForm.querySelector(".btn");
    
    if(!role || !email || !pass || !name) {
        alert("Please fill all fields.");
        return;
    }
    
    btn.innerText = "Registering...";
    
    createUserWithEmailAndPassword(auth, email, pass)
    .then(async (userCredential) => {
        const user = userCredential.user;
        // Create user document in Firestore matching collection schema
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            role: role,
            createdAt: new Date()
        });
        
        // Once created, route appropriately
        routeUserBasedOnRole(user.uid);
    })
    .catch((error) => {
        alert("Registration Error: " + error.message);
        btn.innerText = "Register";
    });
});
