async function registerCustomer() {
    // Clear previous errors
    const alertBox = document.getElementById("alertBox");
    alertBox.style.display = "none";
    alertBox.innerHTML = "";
    const fields = ["email", "password", "confirmPassword", "firstName", "lastName", "phone", "profilePicture", "address", "gender", "dob"];
    fields.forEach(f => {
        const err = document.getElementById(f+"-error");
        if (err) err.innerText = "";
    });

    // Validate required fields
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    let hasError = false;
    if (!email) {
        document.getElementById("email-error").innerText = "Email is required.";
        hasError = true;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        document.getElementById("email-error").innerText = "Invalid email format.";
        hasError = true;
    }
    if (!password) {
        document.getElementById("password-error").innerText = "Password is required.";
        hasError = true;
    } else if (password.length < 6) {
        document.getElementById("password-error").innerText = "Password must be at least 6 characters.";
        hasError = true;
    }
    if (!confirmPassword) {
        document.getElementById("confirmPassword-error").innerText = "Confirm Password is required.";
        hasError = true;
    } else if (password && confirmPassword && password !== confirmPassword) {
        document.getElementById("confirmPassword-error").innerText = "Passwords do not match.";
        hasError = true;
    }
    // Add more field-level validation as needed
    if (hasError) return;

    let dobValue = document.getElementById("dob").value;
    const formData = new FormData();
    formData.append("firstName", document.getElementById("firstName").value);
    formData.append("lastName", document.getElementById("lastName").value);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);
    formData.append("phone", document.getElementById("phone").value);
    formData.append("address", document.getElementById("address").value);
    formData.append("gender", document.getElementById("gender").value);
    if (dobValue) {
        const date = new Date(dobValue);
        formData.append("dateOfBirth", date.toISOString());
    }
    // Handle file upload
    const fileInput = document.getElementById("profilePicture");
    if (fileInput.files && fileInput.files[0]) {
        formData.append("profilePicture", fileInput.files[0]);
    }

    try {
        const response = await fetch("http://localhost:5033/api/auth/register-customer", {
            method: "POST",
            body: formData
        });
        const result = await response.text();
        if (response.ok) {
            alertBox.className = "ts-alert-success";
            alertBox.innerHTML = result + "<br>Redirecting to login...";
            alertBox.style.display = "block";
            hideAlert("alertBox", 2000);
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } else {
            let msg = result;
            try {
                const json = JSON.parse(result);
                if (json && json.errors) {
                    Object.entries(json.errors).forEach(([field, arr]) => {
                        let key = field.charAt(0).toLowerCase() + field.slice(1);
                        if (["confirmPassword", "password", "email", "phone"].includes(key)) {
                            const errEl = document.getElementById(key + "-error");
                            if (errEl) errEl.innerText = arr.join(', ');
                        }
                    });
                    msg = null;
                } else if (Array.isArray(json) && json.length && json[0].description) {
                    // Handle [{description: ...}] error array
                    msg = json.map(e => e.description).join('<br>');
                } else if (json.title) {
                    msg = json.title;
                }
            } catch (e) {}
            if (msg) {
                alertBox.className = "ts-alert-error";
                alertBox.innerHTML = msg;
                alertBox.style.display = "block";
                hideAlert("alertBox", 6000);
            }
        }
    } catch (error) {
        alertBox.className = "ts-alert-error";
        alertBox.innerHTML = "Error: " + error.message;
        alertBox.style.display = "block";
        hideAlert("alertBox", 6000);
    }
}