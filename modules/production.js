import { storage, normalizeText, required, toast, parseFormula, formatFormulaRows } from './utils.js';
import { unlockNav } from './login.js';

const KEYS = {
    session: 'acme_session',
    products: 'acme_products',
    processes: 'acme_processes'
};

function getSession() {
    return storage.get(KEYS.session, null);
}

function getProducts() {
    return storage.get(KEYS.products, []);
}

function setProducts(products) {
    storage.set(KEYS.products, products);
}

function getProcesses() {
    return storage.get(KEYS.processes, []);
}

function setProcesses(p) {
    storage.set(KEYS.processes, p);
}

function canAccess() {
    return Boolean(getSession()?.userId);
}

function nextProcessCode() {
    const list = getProcesses();
    const max = list.reduce((acc, pr) => Math.max(acc, Number(pr.codeNum) || 0), 0);
    const n = max + 1;
    return { codeNum: n, code: `P-${String(n).padStart(4, '0')}` };
}

export function renderProduction() {
    unlockNav();

    const main = document.getElementById('main-content');
    if (!canAccess()) {
        main.innerHTML = `<section><h2>Producción</h2><p>Requiere login.</p></section>`;
        return;
    }

    const products = getProducts();

    // Productos terminados: en este prototipo tratamos cualquier producto con fórmula definida como “producto a fabricar”.
    const buildables = products.filter((p) => Array.isArray(p.formula) && p.formula.length > 0);

    main.innerHTML = `
    <section>
      <h2>Módulo de producción</h2>
      <p>Selecciona un producto, cantidad a producir y genera un proceso con resumen de insumos.</p>

      <div class="grid two">
        <div>
          <h3>Nueva producción</h3>
          <form id="production-form">
            <label>
              Producto a fabricar
              <select id="prod-to-make" required>
                ${buildables.length
            ? buildables.map((p) => `<option value="${p.code}">${p.code} - ${p.name}</option>`).join('')
            : '<option value="">No hay productos con fórmula definida</option>'}
              </select>
            </label>
            <label>
              Cantidad a producir
              <input type="number" id="make-qty" min="1" step="1" required />
            </label>

            <div class="actions">
              <button class="primary" type="submit">Generar proceso</button>
              <button class="ghost" type="button" id="btn-reset">Limpiar</button>
            </div>
            <div id="prod-toast" class="toast" style="display:none"></div>
          </form>

          <h3>Resumen del proceso</h3>
          <div id="process-summary">
            <p>Selecciona un producto para ver la materia prima consumida y el producto terminado generado.</p>
          </div>
        </div>

        <div>
          <h3>Procesos realizados</h3>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="process-tbody">
              ${getProcesses().map((pr) => `
                <tr>
                  <td>${pr.code}</td>
                  <td>${pr.productCode}</td>
                  <td>${pr.quantity}</td>
                  <td>${pr.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

    const toastEl = document.getElementById('prod-toast');
    const form = document.getElementById('production-form');
    const summaryEl = document.getElementById('process-summary');
    const processesTbody = document.getElementById('process-tbody');

    function updateSummary() {
        const code = document.getElementById('prod-to-make').value;
        const qty = Number(document.getElementById('make-qty').value);

        if (!required(code) || !Number.isFinite(qty) || qty <= 0) {
            summaryEl.innerHTML = '<p>Completa los campos para ver el resumen.</p>';
            return;
        }

        const product = products.find((p) => String(p.code) === String(code));
        if (!product || !Array.isArray(product.formula) || product.formula.length === 0) {
            summaryEl.innerHTML = '<p>Este producto no tiene fórmula definida.</p>';
            return;
        }

        // Consumir insumos = fórmula * cantidad.
        const consumed = product.formula.map((r) => ({ code: r.code, qty: r.qty * qty }));

        summaryEl.innerHTML = `
      <p><b>Producto terminado:</b> ${product.code} - ${product.name}</p>
      <p><b>Cantidad:</b> ${qty}</p>
      <h4>Materia prima consumida</h4>
      ${formatFormulaRows(consumed)}
    `;
    }

    document.getElementById('prod-to-make').addEventListener('change', updateSummary);
    document.getElementById('make-qty').addEventListener('input', updateSummary);
    updateSummary();

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const productCode = document.getElementById('prod-to-make').value;
        const quantity = Number(document.getElementById('make-qty').value);

        if (!required(productCode) || !Number.isFinite(quantity) || quantity <= 0) {
            toast(toastEl, { type: 'error', message: 'Selecciona un producto y cantidad válida.' });
            toastEl.style.display = 'block';
            return;
        }

        const product = getProducts().find((p) => String(p.code) === String(productCode));
        if (!product) {
            toast(toastEl, { type: 'error', message: 'Producto no encontrado.' });
            toastEl.style.display = 'block';
            return;
        }

        const formula = Array.isArray(product.formula) ? product.formula : parseFormula(product.formulaText);
        if (!formula.length) {
            toast(toastEl, { type: 'error', message: 'El producto no tiene fórmula definida.' });
            toastEl.style.display = 'block';
            return;
        }

        const consumption = formula.map((r) => ({ code: r.code, qty: r.qty * quantity }));

        const allProducts = getProducts();

        // Verificar stock suficiente
        // Normalizamos códigos para evitar fallos por case / espacios.
        const shortages = [];
        const normalizeCode = (x) => String(x ?? '').trim().toUpperCase();

        for (const c of consumption) {
            const cCode = normalizeCode(c.code);
            const insumo = allProducts.find((p) => normalizeCode(p.code) === cCode);
            const stock = Number(insumo?.stock ?? 0);
            if (stock < c.qty) shortages.push({ code: c.code, need: c.qty, stock, found: Boolean(insumo) });
        }


        const { codeNum, code } = nextProcessCode();

        if (shortages.length) {
            // Mensaje visible con detalle.
            const detalle = shortages
                .map((s) => {
                    const code = String(s.code ?? '').trim();
                    if (!s.found) return `- ${code}: no existe en inventario`;
                    return `- ${code}: stock ${s.stock} < requerido ${s.need}`;
                })
                .join('\n');

            toast(toastEl, { type: 'error', message: `Proceso fallido.\n${detalle}` });
            toastEl.style.display = 'block';

            const processes = getProcesses();
            const next = [
                {
                    code,
                    codeNum,
                    productCode: product.code,
                    quantity,
                    status: 'FALLIDO (insumos insuficientes)',
                    shortages,
                    ts: Date.now(),
                },
                ...processes
            ];
            setProcesses(next);
            renderProduction();
            return;
        }


        // Descontar insumos
        const nextProducts = allProducts.map((p) => {
            const match = consumption.find((c) => normalizeCode(c.code) === normalizeCode(p.code));
            if (!match) return p;
            return { ...p, stock: Number(p.stock) - match.qty };
        });


        setProducts(nextProducts);

        // Registrar proceso
        const processes = getProcesses();
        const nextProcesses = [
            {
                code,
                codeNum,
                productCode: product.code,
                quantity,
                status: 'OK',
                consumption,
                ts: Date.now()
            },
            ...processes
        ];
        setProcesses(nextProcesses);

        // Incrementar stock del producto terminado
        const pCodeNorm = String(product.code ?? '').trim().toUpperCase();
        const after = getProducts().map((p) =>
            normalizeCode(p.code) === pCodeNorm
                ? { ...p, stock: Number(p.stock) + quantity }
                : p
        );

        setProducts(after);

        toastEl.style.display = 'none';
        renderProduction();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        document.getElementById('prod-to-make').value = '';
        document.getElementById('make-qty').value = '';
        summaryEl.innerHTML = '<p>Selecciona un producto para ver el resumen.</p>';
    });
}

