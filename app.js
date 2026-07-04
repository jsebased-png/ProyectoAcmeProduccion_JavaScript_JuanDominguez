import { renderLogin, lockNav, unlockNav } from './modules/login.js';
import { renderUsers } from './modules/users.js';
import { renderInventory } from './modules/inventory.js';
import { renderProduction } from './modules/production.js';

const nav = {
    login: document.getElementById('nav-login'),
    users: document.getElementById('nav-users'),
    inventory: document.getElementById('nav-inventory'),
    production: document.getElementById('nav-production')
};

function setHandlers() {
    nav.login.addEventListener('click', () => {
        renderLogin();
    });

    nav.users.addEventListener('click', () => {
        renderUsers();
    });

    nav.inventory.addEventListener('click', () => {
        renderInventory();
    });

    nav.production.addEventListener('click', () => {
        renderProduction();
    });
}

setHandlers();

lockNav();
renderLogin();

window.__acme = { unlockNav };

