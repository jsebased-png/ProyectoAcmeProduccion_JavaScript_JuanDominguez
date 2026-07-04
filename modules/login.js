import { storage, normalizeText, required, toast } from './utils.js';

const KEYS = {
    session: 'acme_session',
    users: 'acme_users',
};

function getUsers() {
    return storage.get(KEYS.users, []);
}

function setUsers(users) {
    storage.set(KEYS.users, users);
}

function ensureDefaultUsers() {
    const users = getUsers();
    if (users.length > 0) return;

    setUsers([
        {
            id: '123',
            fullName: 'Juan Dominguez',
            role: 'ADMIN',
            password: 'admin',
        }
    ]);
}

function getSession() {
    return storage.get(KEYS.session, null);
}

export function lockNav() {
    document.getElementById('nav-users').disabled = true;
    document.getElementById('nav-inventory').disabled = true;
    document.getElementById('nav-production').disabled = true;
}

export function unlockNav() {
    document.getElementById('nav-users').disabled = false;
    document.getElementById('nav-inventory').disabled = false;
    document.getElementById('nav-production').disabled = false;
}

export function renderLogin() {
    ensureDefaultUsers();

    const main = document.getElementById('main-content');
    const session = getSession();

    if (session?.userId) {
        unlockNav();
    } else {
        lockNav();
    }

    main.innerHTML = `
    <section class="login-card">
        <h2>Login</h2>
        <p>Ingresa tus credenciales para continuar.</p>
        <form id="login-form">

        <label>
            Número de identificación
            <input type="text" id="login-id" required autocomplete="username" />
        </label>
        <label>
            Contraseña
            <input type="password" id="login-pass" required autocomplete="current-password" />
        </label>
        <div class="actions">
            <button class="primary" type="submit">Iniciar sesión</button>
            <button class="ghost" type="button" id="btn-logout" ${!session ? 'style="display:none"' : ''}>Cerrar sesión</button>
        </div>
        <div id="login-toast" class="toast" style="display:none"></div>
        </form>
        <p style="margin-top:12px;">Credenciales demo: <b>123</b> / <b>admin</b></p>
    </section>
    `;

    const toastEl = document.getElementById('login-toast');

    const form = document.getElementById('login-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = normalizeText(document.getElementById('login-id').value);
        const pass = normalizeText(document.getElementById('login-pass').value);

        if (!required(id) || !required(pass)) {
            toast(toastEl, { type: 'error', message: 'Debes completar identificación y contraseña.' });
            toastEl.style.display = 'block';
            return;
        }

        const users = getUsers();
        const found = users.find((u) => String(u.id) === id && u.password === pass);

        if (!found) {
            toast(toastEl, { type: 'error', message: 'Credenciales inválidas.' });
            toastEl.style.display = 'block';
            return;
        }

        storage.set(KEYS.session, { userId: found.id, ts: Date.now() });
        unlockNav();
        toastEl.style.display = 'none';
        alert('Login exitoso');
    });

    const logoutBtn = document.getElementById('btn-logout');
    logoutBtn?.addEventListener('click', () => {
        storage.set(KEYS.session, null);
        lockNav();
        renderLogin();
    });
}

