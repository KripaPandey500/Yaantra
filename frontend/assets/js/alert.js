function hideAlert(id, timeout = 4000) {
    setTimeout(function() {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        el.style.display = 'none';
    }, timeout);
}

function showAlert(id, message, type = 'success', timeout = 10000) {
    var el = document.getElementById(id);
    if (!el) return;

    el.textContent = message;
    el.className = 'mb-4 text-center text-base';
    el.classList.add(type === 'success' ? 'ts-alert-success' : 'ts-alert-error');
    el.classList.remove('hidden');
    el.style.display = '';

    if (timeout > 0) {
        hideAlert(id, timeout);
    }
}
