import { storage, normalizeText, required, toast } from './utils.js';
import { unlockNav } from './login.js';

const KEYS = {
  session: 'acme_session',
  users: 'acme_users',
};

function getSession() {
  return storage.get(KEYS.session, null);
}

function getUsers() {
  return storage.get(KEYS.users, []);
}

function setUsers(users) {
  storage.set(KEYS.users, users);
}

function canAccess() {
  return Boolean(getSession()?.userId);
}

export function renderUsers() {
  unlockNav();

  const main = document.getElementById('main-content');
  if (!canAccess()) {
    main.innerHTML = `<section><h2>Usuarios</h2><p>Requiere login.</p></section>`;
    return;
  }

  const users = getUsers();
  main.innerHTML = `
    <section>
      <h2>Módulo de usuarios</h2>
      <p>CRUD: crear / modificar / eliminar.</p>

      <div class="grid two">
        <div>
          <h3>Listado</h3>
          <table>
            <thead>
              <tr>
                <th>Identificación</th>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              ${users.map((u) => `
                <tr>
                  <td>${u.id}</td>
                  <td>${u.fullName ?? ''}</td>
                  <td>${u.role ?? ''}</td>
                  <td>
                    <button class="ghost" type="button" data-action="edit" data-id="${u.id}">Editar</button>
                    <button class="danger" type="button" data-action="delete" data-id="${u.id}" style="margin-left:8px">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div>
          <h3 id="form-title">Crear / Modificar usuario</h3>
          <form id="user-form">
            <label>
              Identificación
              <input type="text" id="user-id" required />
            </label>
            <label>
              Nombre completo
              <input type="text" id="user-name" required />
            </label>
            <label>
              Cargo
              <select id="user-role" required>
                <option value="ADMIN">ADMIN</option>
                <option value="OPERADOR">OPERADOR</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </label>
            <label>
              Contraseña
              <input type="password" id="user-pass" required autocomplete="new-password" />
            </label>
            <label>
              Confirmar contraseña
              <input type="password" id="user-pass-2" required autocomplete="new-password" />
            </label>

            <div class="actions">
              <button class="primary" type="submit">Guardar</button>
              <button class="ghost" type="button" id="btn-clear">Limpiar</button>
            </div>
            <div id="user-toast" class="toast" style="display:none"></div>
          </form>
        </div>
      </div>
    </section>
  `;

  const toastEl = document.getElementById('user-toast');
  const form = document.getElementById('user-form');
  const tbody = document.getElementById('users-tbody');
  const clearBtn = document.getElementById('btn-clear');

  let editingId = null;

  function setFormEnabled(enabled) {
    document.getElementById('user-id').disabled = !enabled;
  }

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'edit') {
      const u = getUsers().find((x) => String(x.id) === String(id));
      if (!u) return;
      editingId = u.id;
      document.getElementById('form-title').textContent = 'Modificar usuario';
      document.getElementById('user-id').value = u.id;
      document.getElementById('user-id').disabled = true;
      document.getElementById('user-name').value = u.fullName ?? '';
      document.getElementById('user-role').value = u.role ?? 'OPERADOR';
      document.getElementById('user-pass').value = '';
      document.getElementById('user-pass-2').value = '';
    }

    if (action === 'delete') {
      if (!confirm('¿Eliminar usuario?')) return;
      const next = getUsers().filter((x) => String(x.id) !== String(id));
      setUsers(next);
      renderUsers();
    }
  });

  clearBtn.addEventListener('click', () => {
    editingId = null;
    document.getElementById('form-title').textContent = 'Crear / Modificar usuario';
    form.reset();
    document.getElementById('user-id').disabled = false;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = normalizeText(document.getElementById('user-id').value);
    const fullName = normalizeText(document.getElementById('user-name').value);
    const role = document.getElementById('user-role').value;
    const pass = normalizeText(document.getElementById('user-pass').value);
    const pass2 = normalizeText(document.getElementById('user-pass-2').value);

    if (!required(id) || !required(fullName) || !required(pass) || !required(pass2)) {
      toast(toastEl, { type: 'error', message: 'Completa todos los campos requeridos.' });
      toastEl.style.display = 'block';
      return;
    }

    if (pass !== pass2) {
      toast(toastEl, { type: 'error', message: 'Las contraseñas no coinciden.' });
      toastEl.style.display = 'block';
      return;
    }

    const users = getUsers();
    const exists = users.some((u) => String(u.id) === String(id));

    if (exists && !editingId) {
      toast(toastEl, { type: 'error', message: 'Ya existe un usuario con esa identificación.' });
      toastEl.style.display = 'block';
      return;
    }

    let next;
    if (editingId) {
      next = users.map((u) => (String(u.id) === String(editingId)
        ? { ...u, fullName, role, password: pass }
        : u));
    } else {
      next = [
        ...users,
        { id, fullName, role, password: pass },
      ];
    }

    setUsers(next);
    toast(toastEl, { type: 'success', message: 'Usuario guardado correctamente.' });
    toastEl.style.display = 'block';

    editingId = null;
    document.getElementById('form-title').textContent = 'Crear / Modificar usuario';
    form.reset();
    setFormEnabled(true);

    // Refrescar tabla
    renderUsers();
  });
}

