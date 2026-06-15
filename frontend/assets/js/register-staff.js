/* ============================================================
   register-staff.js — Yaantra Staff Registration
   ============================================================ */
'use strict';

const form            = document.getElementById('staffForm');
const alertBox        = document.getElementById('alertBox');
const fileInput       = document.getElementById('profilePicture');
const fileNameDisplay = document.getElementById('fileNameDisplay');

/* ── Alert helpers ─────────────────────────────────────────── */
function showSuccess(msg) {
    alertBox.textContent = msg;
    alertBox.className = 'mb-4 text-center text-sm ts-alert-success';
    alertBox.style.display = '';
    setTimeout(() => {
        alertBox.classList.add('hidden');
        alertBox.style.display = 'none';
    }, 3000);
}

function showError(msg) {
    alertBox.textContent = msg;
    alertBox.className = 'mb-4 text-center text-sm ts-alert-error';
    alertBox.style.display = '';
    setTimeout(() => {
        alertBox.classList.add('hidden');
        alertBox.style.display = 'none';
    }, 4000);
}

function hideAlert() {
    alertBox.textContent = '';
    alertBox.className = 'hidden mb-4';
    alertBox.style.display = 'none';
}

/* ── File name display ─────────────────────────────────────── */
function displayFileName(input) {
    fileNameDisplay.textContent =
        input.files && input.files[0] ? input.files[0].name : '';
}

/* ── Clear form ────────────────────────────────────────────── */
function clearForm() {
    form.reset();
    fileNameDisplay.textContent = '';
    document.getElementById('gender').value = '';
    hideAlert();
}

/* ── Validation ────────────────────────────────────────────── */
function validateForm() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName  = document.getElementById('lastName').value.trim();
    const email     = document.getElementById('email').value.trim();
    const phone     = document.getElementById('phone').value.trim();
    const password  = document.getElementById('password').value;
    const dob       = document.getElementById('dob').value;
    const gender    = document.getElementById('gender').value;
    const address   = document.getElementById('address').value.trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneOk = phone.replace(/\D/g, '').length >= 7;

    if (!firstName || !lastName || !emailOk || !phoneOk ||
        password.length < 8 || !dob || !gender || !address) {
        showError('All fields are required.');
        return false;
    }
    return true;
}

/* ── Build FormData payload with file upload ──────────────── */
function buildFormDataPayload() {
    const formData = new FormData();
    formData.append("FirstName", document.getElementById('firstName').value.trim());
    formData.append("LastName", document.getElementById('lastName').value.trim());
    formData.append("Email", document.getElementById('email').value.trim());
    formData.append("Password", document.getElementById('password').value);
    formData.append("Phone", document.getElementById('phone').value.trim());
    formData.append("Address", document.getElementById('address').value.trim());
    formData.append("Gender", document.getElementById('gender').value);
    formData.append("DateOfBirth", document.getElementById('dob').value || '');
    formData.append("Role", "STAFF");
    
    // Add profile picture file if selected
    const profilePictureInput = document.getElementById('profilePicture');
    if (profilePictureInput && profilePictureInput.files.length > 0) {
        formData.append("profilePicture", profilePictureInput.files[0]);
    }
    
    return formData;
}

/* ── Parse response ────────────────────────────────────────── */
async function parseResponse(response) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) return response.json();
    return { message: await response.text() };
}

/* ── Main handler ──────────────────────────────────────────── */
async function registerStaff(event) {
    if (event && event.preventDefault) event.preventDefault();
    
    // Validate FIRST before clearing alerts
    if (!validateForm()) return;

    try {
        const response = await fetch(
            'http://localhost:5033/api/auth/register-staff',
            {
                method: 'POST',
                body: buildFormDataPayload()
            }
        );
        const result = await parseResponse(response);

        if (response.ok) {
            const successMsg = result.message || 'Staff registered successfully!';
            console.log('✅ Registration successful:', successMsg);
            console.log('Setting sessionStorage:', successMsg);
            showSuccess(successMsg);
            sessionStorage.setItem('registrationSuccess', successMsg);
            console.log('SessionStorage value:', sessionStorage.getItem('registrationSuccess'));
            clearForm();
            setTimeout(() => { 
                console.log('Redirecting to login.html...');
                window.location.href = 'login.html'; 
            }, 2000);
        } else {
            console.error('❌ Registration failed. Response status:', response.status);
            console.error('Response data:', result);
            let errMsg = 'Registration failed. Please try again.';
            if (result.message) {
                errMsg = result.message;
            } else if (result.description) {
                errMsg = result.description;
            } else if (Array.isArray(result) && result[0]?.description) {
                errMsg = result[0].description;
            }
            console.error('Final error message:', errMsg);
            showError(errMsg);
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showError('Network error — is your backend running on port 5033?');
    }
}

/* ── Init ──────────────────────────────────────────────────── */
if (form) form.addEventListener('submit', registerStaff);
window.registerStaff     = registerStaff;
window.clearForm         = clearForm;
window.displayFileName   = displayFileName;
document.addEventListener('DOMContentLoaded', clearForm);
