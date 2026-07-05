import { storage, normalizeText, required, toast, parseFormula, formatFormulaRows } from './utils.js';
import { unlockNav } from './login.js';

const KEYS = {
    session: 'acme_session',
    products: 'acme_products',
    processes: 'acme_processes'
};

async function getSession() {
    return storage.get(KEYS.session, null);
}


async function getProducts() {
    const products = await storage.get(KEYS.products, []);
    return Array.isArray(products) ? products : [];
}

async function setProducts(products) {
    await storage.set(KEYS.products, products);
}


async function getProcesses() {
    const processes = await storage.get(KEYS.processes, []);
    return Array.isArray(processes) ? processes : [];
}

async function setProcesses(p) {
    await storage.set(KEYS.processes, p);
}

function canAccess(session) {
    return Boolean(session?.userId);
}


async function nextProcessCode() {
    const list = await getProcesses();
    const max = list.reduce((acc, pr) => Math.max(acc, Number(pr.codeNum) || 0), 0);
    const n = max + 1;
    return { codeNum: n, code: `P-${String(n).padStart(4, '0')}` };
}


export async function renderProduction() {
    unlockNav();

    const main = document.getElementById('main-content');
    const session = await getSession();
    if (!canAccess(session)) {
        main.innerHTML = `<section><h2>Producción</h2><p>Requiere login.</p></section>`;
        return;
    }

    const products = await getProducts();


    const buildables = products.filter((p) => Array.isArray(p.formula) && p.formula.length > 0);
    const processes = await getProcesses();

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
                ${processes.map((pr) => `

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

    form.addEventListener('submit', async (e) => {

        e.preventDefault();

        const productCode = document.getElementById('prod-to-make').value;
        const quantity = Number(document.getElementById('make-qty').value);

        if (!required(productCode) || !Number.isFinite(quantity) || quantity <= 0) {
            toast(toastEl, { type: 'error', message: 'Selecciona un producto y cantidad válida.' });
            toastEl.style.display = 'block';
            return;
        }

        const allProductsRaw = await getProducts();
        const allProducts = Array.isArray(allProductsRaw) ? allProductsRaw : [];

        let product = null;
        for (const p of allProducts) {
            if (String(p?.code) === String(productCode)) {
                product = p;
                break;
            }
        }

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

        const consumption = [];
        for (const r of formula) {
            consumption.push({ code: r.code, qty: r.qty * quantity });
        }

        const shortages = [];
        const normalizeCode = (x) => String(x ?? '').trim().toUpperCase();

        for (const c of consumption) {
            const cCode = normalizeCode(c.code);
            let insumo = null;
            for (const p of allProducts) {
                if (normalizeCode(p?.code) === cCode) {
                    insumo = p;
                    break;
                }
            }

            const stock = Number(insumo?.stock ?? 0);
            if (stock < c.qty) {
                shortages.push({ code: c.code, need: c.qty, stock, found: Boolean(insumo) });
            }
        }

        const { codeNum, code } = await nextProcessCode();

        if (shortages.length) {
            const detalleParts = [];
            for (const s of shortages) {
                const sCode = String(s.code ?? '').trim();
                if (!s.found) {
                    detalleParts.push(`- ${sCode}: no existe en inventario`);
                } else {
                    detalleParts.push(`- ${sCode}: stock ${s.stock} < requerido ${s.need}`);
                }
            }
            const detalle = detalleParts.join('\n');

            toast(toastEl, { type: 'error', message: `Proceso fallido.\n${detalle}` });
            toastEl.style.display = 'block';

            const processesRaw = await getProcesses();
            const processes = Array.isArray(processesRaw) ? processesRaw : [];
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
            await setProcesses(next);
            await renderProduction();
            return;
        }

        const nextProducts = [];
        for (const p of allProducts) {
            let discounted = false;
            for (const c of consumption) {
                if (normalizeCode(c.code) === normalizeCode(p?.code)) {
                    nextProducts.push({ ...p, stock: Number(p?.stock ?? 0) - c.qty });
                    discounted = true;
                    break;
                }
            }
            if (!discounted) nextProducts.push(p);
        }

        const finalProducts = [];
        const pCodeNorm = normalizeCode(product.code);
        for (const p of nextProducts) {
            if (normalizeCode(p?.code) === pCodeNorm) {
                finalProducts.push({ ...p, stock: Number(p?.stock ?? 0) + quantity });
            } else {
                finalProducts.push(p);
            }
        }

        await setProducts(finalProducts);

        const processesRaw = await getProcesses();
        const processes = Array.isArray(processesRaw) ? processesRaw : [];
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
        await setProcesses(nextProcesses);

        toastEl.style.display = 'none';
        await renderProduction();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        document.getElementById('prod-to-make').value = '';
        document.getElementById('make-qty').value = '';
        summaryEl.innerHTML = '<p>Selecciona un producto para ver el resumen.</p>';
    });
}

