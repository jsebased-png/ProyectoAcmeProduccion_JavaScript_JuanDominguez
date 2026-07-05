import { storage, normalizeText, required, toast, parseFormula, escapeHtml } from './utils.js';
import { unlockNav } from './login.js';

const KEYS = {
    session: 'acme_session',
    products: 'acme_products',
};

async function getSession() {
    return storage.get(KEYS.session, null);
}

async function getProducts() {
    return storage.get(KEYS.products, []);
}

async function setProducts(products) {
    await storage.set(KEYS.products, products);
}

async function canAccess() {
    const s = await getSession();
    return Boolean(s?.userId);
}

export async function renderInventory() {
    unlockNav();

    const main = document.getElementById('main-content');
    if (!(await canAccess())) {
        main.innerHTML = `<section><h2>Inventario</h2><p>Requiere login.</p></section>`;
        return;
    }

    const products = await getProducts();


    main.innerHTML = `
      <section>
        <h2>Módulo de inventario</h2>
        <p>Gestiona productos / materia prima y su stock.</p>

        <div class="grid two">
          <div>
            <h3>Buscar</h3>
            <label>
              Término (código, nombre o proveedor)
              <input type="text" id="inv-search" placeholder="Ej: HARINA, H001, ACME" />
            </label>
            <h3>Productos / Materia prima</h3>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Proveedor</th>
                  <th>Stock</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="inv-tbody">
                ${products.map((p) => rowHtml(p)).join('')}
              </tbody>
            </table>
            <p style="margin-top:10px;">Nota: Stock inicial = 0 al crear. Puedes ingresar stock adicional.</p>
          </div>

          <div>
            <h3>Crear producto</h3>
            <form id="product-form">
              <label>
                Código
                <input type="text" id="prod-code" required />
              </label>
              <label>
                Nombre
                <input type="text" id="prod-name" required />
              </label>
              <label>
                Proveedor
                <input type="text" id="prod-supplier" required />
              </label>
              <label>
                Fórmula (opcional)
                <textarea id="prod-formula" placeholder="Ej: INS1:2; INS2:3"></textarea>
              </label>

              <div class="actions">
                <button class="primary" type="submit">Crear producto</button>
                <button class="ghost" type="button" id="btn-clear">Limpiar</button>
              </div>
              <div id="inv-toast" class="toast" style="display:none"></div>
            </form>

            <h3>Ingresar stock</h3>
            <form id="stock-form">
              <label>
                Código de producto
                <select id="stock-code" required>
                  ${products.map((p) => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.code)}</option>`).join('')}
                </select>
              </label>
              <label>
                Cantidad a agregar
                <input type="number" id="stock-qty" min="1" step="1" required />
              </label>
              <div class="actions">
                <button class="primary" type="submit">Agregar stock</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    `;

    const tbody = document.getElementById('inv-tbody');
    const search = document.getElementById('inv-search');
    const toastEl = document.getElementById('inv-toast');
    const productForm = document.getElementById('product-form');
    const clearBtn = document.getElementById('btn-clear');
    const stockForm = document.getElementById('stock-form');

    async function refreshTable(filter = '') {
        const all = await getProducts();
        const term = normalizeText(filter).toLowerCase();
        const filtered = !term
            ? all
            : all.filter((p) => (
                String(p.code).toLowerCase().includes(term) ||
                String(p.name ?? '').toLowerCase().includes(term) ||
                String(p.supplier ?? '').toLowerCase().includes(term)
            ));

        tbody.innerHTML = filtered.map((p) => rowHtml(p)).join('');

        const stockSelect = document.getElementById('stock-code');
        if (stockSelect) {
            stockSelect.innerHTML = all.map((p) => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.code)}</option>`).join('');
        }
    }


    function rowHtml(p) {
        return `
      <tr>
        <td>${escapeHtml(p.code)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.supplier)}</td>
        <td>${p.stock}</td>
        <td>
          <button class="ghost" type="button" data-action="edit" data-code="${escapeHtml(p.code)}">Editar</button>
          <button class="danger" type="button" data-action="delete" data-code="${escapeHtml(p.code)}" style="margin-left:8px">Eliminar</button>
          <button class="ghost" type="button" data-action="add" data-code="${escapeHtml(p.code)}" style="margin-left:8px">Agregar</button>
        </td>
      </tr>
    `;
    }

    await refreshTable();


    search.addEventListener('input', () => refreshTable(search.value));

    tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        const code = btn.dataset.code;

        if (action === 'delete') {
            if (!confirm('¿Eliminar producto?')) return;
            const allProducts = await getProducts();
            const safeProducts = Array.isArray(allProducts) ? allProducts : [];
            const next = [];
            for (const p of safeProducts) {
                if (String(p?.code) !== String(code)) next.push(p);
            }
            await setProducts(next);
            await renderInventory();
            return;
        }

        if (action === 'edit') {
            const allProducts = await getProducts();
            const safeProducts = Array.isArray(allProducts) ? allProducts : [];

            let p = null;
            for (const item of safeProducts) {
                if (String(item?.code) === String(code)) {
                    p = item;
                    break;
                }
            }

            if (!p) {
                toast(toastEl, { type: 'error', message: 'Producto no encontrado para edición.' });
                toastEl.style.display = 'block';
                return;
            }

            document.getElementById('prod-code').value = p.code;
            document.getElementById('prod-code').disabled = true;
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-supplier').value = p.supplier;
            document.getElementById('prod-formula').value = (p.formulaText ?? '');

            productForm.dataset.editing = String(code);
            document.querySelector('#product-form button.primary').textContent = 'Guardar cambios';
            toastEl.style.display = 'none';
            return;
        }

        if (action === 'add') {
            const stockSelect = document.getElementById('stock-code');
            stockSelect.value = code;
            document.getElementById('stock-qty').focus();
            return;
        }
    });

    clearBtn.addEventListener('click', () => {
        productForm.reset();
        document.getElementById('prod-code').disabled = false;
        delete productForm.dataset.editing;
        document.querySelector('#product-form button.primary').textContent = 'Crear producto';
        toastEl.style.display = 'none';
    });

    productForm.addEventListener('submit', async (e) => {

        e.preventDefault();

        const editingCode = productForm.dataset.editing;

        const code = normalizeText(document.getElementById('prod-code').value).toUpperCase();
        const name = normalizeText(document.getElementById('prod-name').value);
        const supplier = normalizeText(document.getElementById('prod-supplier').value);
        const formulaText = document.getElementById('prod-formula').value;


        if (!required(code) || !required(name) || !required(supplier)) {
            toast(toastEl, { type: 'error', message: 'Completa código, nombre y proveedor.' });
            toastEl.style.display = 'block';
            return;
        }

        const parsedFormula = parseFormula(formulaText);
        const products = await getProducts();

        let exists = false;
        for (const p of (Array.isArray(products) ? products : [])) {
            if (String(p?.code) === String(code)) {
                exists = true;
                break;
            }
        }


        if (exists && !editingCode) {
            toast(toastEl, { type: 'error', message: 'Ya existe un producto con ese código.' });
            toastEl.style.display = 'block';
            return;
        }

        let next;
        if (editingCode) {
            next = products.map((p) => (
                String(p.code) === String(editingCode)
                    ? { ...p, name, supplier, formula: parsedFormula, formulaText, code }
                    : p
            ));
        } else {
            next = [
                ...products,
                { code, name, supplier, formula: parsedFormula, formulaText: normalizeText(formulaText), stock: 0 }
            ];
        }

        await setProducts(next);
        toastEl.style.display = 'none';
        await renderInventory();
    });

    stockForm.addEventListener('submit', async (e) => {

        e.preventDefault();
        const code = normalizeText(document.getElementById('stock-code').value);
        const qty = Number(document.getElementById('stock-qty').value);

        if (!required(code) || !Number.isFinite(qty) || qty <= 0) {
            toast(toastEl, { type: 'error', message: 'Ingresa una cantidad válida para el stock.' });
            toastEl.style.display = 'block';
            return;
        }

        const products = await getProducts();
        const safeProducts = Array.isArray(products) ? products : [];

        let found = false;
        const next = [];
        for (const p of safeProducts) {
            if (String(p?.code) === String(code)) {
                found = true;
                next.push({ ...p, stock: Number(p?.stock ?? 0) + qty });
            } else {
                next.push(p);
            }
        }

        if (!found) {
            toast(toastEl, { type: 'error', message: 'Producto no encontrado para actualizar stock.' });
            toastEl.style.display = 'block';
            return;
        }

        await setProducts(next);
        document.getElementById('stock-qty').value = '';
        toastEl.style.display = 'none';
        await renderInventory();
    });
}

