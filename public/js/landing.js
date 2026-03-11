const API_URL = '/api';

// State
// selectedPlan is now managed via localStorage 'pendingPlan'

// DOM Elements
const navDashboardBtn = document.getElementById('nav-dashboard-btn');
const authModal = document.getElementById('auth-modal');
const closeModal = document.querySelector('.close-modal');
const loginFormContainer = document.getElementById('login-form-container');
const registerFormContainer = document.getElementById('register-form-container');
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const selectedPlanName = document.getElementById('selected-plan-name');

// Check Auth Status on Load
function checkAuth() {
    console.log('Checking auth status...');
    const token = localStorage.getItem('token');
    const pendingPlan = localStorage.getItem('pendingPlan');

    // Bind listeners to all require-auth-btn elements
    const requireAuthBtns = document.querySelectorAll('.require-auth-btn');

    if (token) {
        console.log('User is authenticated.');
        // Update UI
        if (navDashboardBtn) {
            navDashboardBtn.textContent = 'Dashboard';
            navDashboardBtn.href = '/dashboard.html';
            navDashboardBtn.classList.add('btn', 'btn-primary');
            navDashboardBtn.onclick = null; // Remove modal trigger
        }
        
        requireAuthBtns.forEach(btn => {
            btn.textContent = 'Dashboard';
            btn.href = '/dashboard.html';
            btn.onclick = null;
        });

        // Check for pending plan
        if (pendingPlan) {
            console.log('Found pending plan:', pendingPlan);
            initiateCheckout(pendingPlan);
        }
    } else {
        console.log('User is NOT authenticated.');
        if (navDashboardBtn) {
            navDashboardBtn.textContent = 'Dashboard'; // Always Dashboard
            navDashboardBtn.href = '#';
            navDashboardBtn.onclick = (e) => {
                e.preventDefault();
                console.log('Dashboard clicked without auth. Redirecting to login.');
                openAuthModal('login');
            };
        }
        
        requireAuthBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                openAuthModal('register');
            };
        });
    }
}

// Plan Selection
window.selectPlan = async (plan) => {
    console.log('Plan selected:', plan);
    const token = localStorage.getItem('token');

    if (token) {
        console.log('User logged in, proceeding to checkout...');
        await initiateCheckout(plan);
    } else {
        console.log('User not logged in. Storing plan and showing auth modal.');
        localStorage.setItem('pendingPlan', plan);
        if (selectedPlanName) selectedPlanName.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
        openAuthModal('register');
    }
};

async function initiateCheckout(plan) {
    console.log('Initiating checkout for plan:', plan);
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No token found during checkout initiation.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/payments/create-checkout-session`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan })
        });
        
        const data = await res.json();
        if (data.url) {
            console.log('Checkout session created, redirecting to:', data.url);
            localStorage.removeItem('pendingPlan'); // Clear pending plan
            window.location.href = data.url;
        } else {
            console.error('Checkout error:', data.error);
            alert('Error initiating checkout: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error('Checkout network error:', e);
        alert('Failed to connect to server.');
    }
}

// Auth Modal Logic
function openAuthModal(view = 'login') {
    authModal.classList.remove('hidden');
    if (view === 'login') {
        loginFormContainer.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');
    } else {
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    }
}

closeModal.onclick = () => {
    authModal.classList.add('hidden');
    selectedPlan = null;
};

window.onclick = (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
        selectedPlan = null;
    }
};

switchToRegister.onclick = (e) => {
    e.preventDefault();
    openAuthModal('register');
};

switchToLogin.onclick = (e) => {
    e.preventDefault();
    openAuthModal('login');
};

// Login Form Submit
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (data.success) {
            console.log('Login successful. Token stored.');
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            const pendingPlan = localStorage.getItem('pendingPlan');
            if (pendingPlan) {
                console.log('Resuming checkout for pending plan:', pendingPlan);
                await initiateCheckout(pendingPlan);
            } else {
                console.log('No pending plan, redirecting to dashboard.');
                window.location.href = '/dashboard.html';
            }
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('Login failed');
    }
});

// Register Form Submit
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const name = document.getElementById('reg-name').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        if (data.success) {
            // Auto login after register
            const loginRes = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const loginData = await loginRes.json();
            
            if (loginData.success) {
                console.log('Registration and Login successful. Token stored.');
                localStorage.setItem('token', loginData.token);
                localStorage.setItem('user', JSON.stringify(loginData.user));
                
                const pendingPlan = localStorage.getItem('pendingPlan');
                if (pendingPlan) {
                    console.log('Resuming checkout for pending plan:', pendingPlan);
                    await initiateCheckout(pendingPlan);
                } else {
                    console.log('No pending plan, redirecting to dashboard.');
                    window.location.href = '/dashboard.html';
                }
            }
        } else {
            alert(data.error);
        }
    } catch (e) {
        alert('Registration failed');
    }
});

// Initialize
checkAuth();

// Handle URL params for payment success
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment_success')) {
    alert('Payment successful! Welcome to ZapFlow Pro.');
    window.location.href = '/dashboard.html';
}

window.togglePassword = (id) => {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
};
