// assets/js/login.js

// Show logout success message if redirected from logout

// Show special alerts based on query params
(function () {
    const params = new URLSearchParams(window.location.search);
    window.addEventListener('DOMContentLoaded', function () {
        // NEW: Handle new message/type parameters from logout
        const message = params.get('message');
        const messageType = params.get('type') || 'error';
        
        if (message) {
            const errorMsg = document.getElementById('errorMessage');
            errorMsg.textContent = message;
            
            if (messageType === 'success') {
                errorMsg.className = 'mb-4 text-center text-sm ts-alert-success';
            } else {
                errorMsg.className = 'mb-4 text-center text-sm ts-alert-error';
            }
            errorMsg.classList.remove('hidden');
            return;
        }
        
        // OLD: Keep existing behavior for backwards compatibility
        if (params.get('logout') === '1') {
            showAlert('errorMessage', 'You have been logged out successfully.', 'error', 9000);
        } else if (params.get('msg') === 'loginfirst') {
            showAlert('errorMessage', 'Login First', 'error', 3500);
        }
    });
})();

async function login() {
    const alertBox = document.getElementById("errorMessage");
    
    if (alertBox) {
        alertBox.classList.add("hidden");
        alertBox.innerHTML = "";
        alertBox.className = "";
    } 

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const selectedRole = document.getElementById("role").value;
    
    if (!email || !password) {
        showAlert('errorMessage', 'Please enter email and password.', 'error');
        return;
    }

    try {
        const response = await fetch("http://localhost:5033/api/auth/login", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        console.log("Full login response:", result);
        console.log("Response status:", response.status);

        if (response.ok) {
            const assignedRoles = (result?.user?.roles || []).map(r => {
                const role = String(r).trim();
                // Normalize to title case: ADMIN -> Admin, admin -> Admin, Admin -> Admin
                return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
            });
            
            console.log("Assigned roles from server:", result?.user?.roles);
            console.log("Normalized assigned roles:", assignedRoles);
            
            // If no role selected, update dropdown with ALL standard roles
            if (!selectedRole) {
                populateRoleDropdown(null); // Pass null to show all standard roles
                showAlert('errorMessage', 'Please select your role.', 'error');
                return;
            }

            // Normalize selected role to title case
            const normalizedSelectedRole = String(selectedRole).trim();
            const normalizedForComparison = normalizedSelectedRole.charAt(0).toUpperCase() + normalizedSelectedRole.slice(1).toLowerCase();
            
            console.log("Selected role:", selectedRole);
            console.log("Normalized selected role:", normalizedForComparison);
            
            // Accept the selected role - let backend handle validation and auto-fix
            // This is more lenient since the backend will auto-sync roles
            const standardRoles = ["Customer", "Staff", "Admin", "Vendor"];
            if (!standardRoles.includes(normalizedForComparison)) {
                showAlert('errorMessage', `Invalid role selected.`, 'error');
                return;
            }

            // If user is an admin in their roles, always route to admin dashboard.
            const effectiveRole = assignedRoles.includes("Admin") ? "Admin" : normalizedForComparison;

            // Save to localStorage
            localStorage.setItem("token", result.token);
            localStorage.setItem("userEmail", result?.user?.email || email);
            localStorage.setItem("userRole", effectiveRole);
            
            // Fetch profile to get firstName, lastName, userId for header and cart
            fetch("http://localhost:5033/api/auth/profile", {
                headers: { 'Authorization': `Bearer ${result.token}` }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error(`Profile fetch failed with status: ${res.status}`);
                })
                .then(profile => {
                    localStorage.setItem("firstName", profile.firstName || "");
                    localStorage.setItem("lastName", profile.lastName || "");
                    localStorage.setItem("profilePic", profile.profilePicture || "");
                    localStorage.setItem("userId", profile.id || profile.userId || "");
                    // Redirect after profile fetch
                    redirectByRole(effectiveRole);
                })
                .catch(err => {
                    console.warn("Profile fetch failed, redirecting anyway:", err);
                    // Fallback if profile fetch fails - still redirect
                    redirectByRole(effectiveRole);
                });

        } else {
            showAlert('errorMessage', 'Email and password is incorrect.', 'error');
        }
    } catch (error) {
        console.error("Login Error:", error);
        showAlert('errorMessage', 'An error occurred. Please try again.', 'error');
    }
}

// Helper function to populate role dropdown with available roles
function populateRoleDropdown(availableRoles) {
    const roleSelect = document.getElementById("role");
    const currentSelection = roleSelect.value;
    
    // Keep the "Select your role" option
    roleSelect.innerHTML = '<option value="">Select your role</option>';
    
    // Add all standard roles
    const roleLabels = {
        "Customer": "Customer",
        "Staff": "Staff",
        "Admin": "Admin",
        "Vendor": "Vendor"
    };
    
    // If specific roles provided, use them; otherwise show all common roles
    const rolesToShow = availableRoles && availableRoles.length > 0 
        ? availableRoles 
        : ["Customer", "Staff", "Admin", "Vendor"];
    
    rolesToShow.forEach(role => {
        const option = document.createElement("option");
        option.value = role;
        option.text = roleLabels[role] || role;
        roleSelect.appendChild(option);
    });
    
    // Auto-select if only one role available
    if (rolesToShow.length === 1) {
        roleSelect.value = rolesToShow[0];
    } else if (currentSelection && rolesToShow.includes(currentSelection)) {
        // Keep current selection if still available
        roleSelect.value = currentSelection;
    }
}

// Helper function to redirect based on role
function redirectByRole(role) {
    if (role === "Admin") {
        window.location.href = "../admin/pages/dashboard.html";
    } else if (role === "Customer") {
        window.location.href = "../pages/homepage.html";
    } else if (role === "Staff") {
        window.location.href = "../staff/dashboard.html";
    } else if (role === "Vendor") {
        window.location.href = "../pages/homepage.html"; // Default vendor to homepage
    } else {
        showAlert('errorMessage', 'No dashboard is configured for this role.', 'error');
    }
}