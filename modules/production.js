import { storage, normalizeText, required, toast, parseFormula, formatFormulaRows } from './utils.js';
import { unlockNav } from './login.js';
import { db } from '../firebase.js';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    setDoc,
    increment,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

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

async function getTop5ProducedProducts() {
    const totalsRef = collection(db, 'production_totals');
    const q = query(totalsRef, orderBy('totalProduced', 'desc'), limit(5));
    const snap = await getDocs(q);

    const out = [];
    snap.forEach((d) => {
        const data = d.data() ?? {};
        out.push({
            productCode: data.productCode ?? d.id,
            productName: data.productName ?? data.productCode ?? d.id,
            totalProduced: Number(data.totalProduced ?? 0)
        });
    });
    return out;
}

async function increaseProductionTotal({ productCode, productName, quantity }) {
    const safeCode = String(productCode ?? '').trim().toUpperCase();
    if (!safeCode || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return;

    const ref = doc(db, 'production_totals', safeCode);
    await setDoc(ref, {
        productCode: safeCode,
        productName: String(productName ?? '').trim() || safeCode,
        totalProduced: increment(Number(quantity)),
        updatedAt: Date.now()
    }, { merge: true });
}

async function resetProductionTotals() {
    const totalsRef = collection(db, 'production_totals');
    const snap = await getDocs(totalsRef);

    if (snap.empty) return;

    const docs = [];
    snap.forEach((d) => docs.push(d));

    const chunkSize = 450;
    for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + chunkSize);
        for (const d of chunk) {
            batch.delete(d.ref);
        }
        await batch.commit();
    }
}

async function reconcileProductionTotalsFromProcesses() {
    const processesRaw = await getProcesses();
    const processes = Array.isArray(processesRaw) ? processesRaw : [];

    const totalsByCode = new Map();
    for (const pr of processes) {
        if (String(pr?.status ?? '') !== 'OK') continue;

        const code = String(pr?.productCode ?? '').trim().toUpperCase();
        const qty = Number(pr?.quantity ?? 0);
        if (!code || !Number.isFinite(qty) || qty <= 0) continue;

        const current = totalsByCode.get(code) ?? { productCode: code, productName: code, totalProduced: 0 };
        current.totalProduced += qty;
        totalsByCode.set(code, current);
    }

    const products = await getProducts();
    const nameByCode = new Map();
    for (const p of products) {
        const code = String(p?.code ?? '').trim().toUpperCase();
        if (!code) continue;
        const name = String(p?.name ?? '').trim() || code;
        nameByCode.set(code, name);
    }

    for (const [code, total] of totalsByCode.entries()) {
        total.productName = nameByCode.get(code) ?? total.productName ?? code;
    }

    const totalsRef = collection(db, 'production_totals');
    const currentSnap = await getDocs(totalsRef);

    const existingCodes = new Set();
    const existingDocsByCode = new Map();
    currentSnap.forEach((d) => {
        const data = d.data() ?? {};
        const code = String(data.productCode ?? d.id ?? '').trim().toUpperCase();
        if (!code) return;
        existingCodes.add(code);
        existingDocsByCode.set(code, d.ref);
    });

    const chunkSize = 450;
    const entries = Array.from(totalsByCode.entries());
    for (let i = 0; i < entries.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = entries.slice(i, i + chunkSize);
        for (const [code, total] of chunk) {
            const ref = doc(db, 'production_totals', code);
            batch.set(ref, {
                productCode: code,
                productName: total.productName ?? code,
                totalProduced: Number(total.totalProduced ?? 0),
                updatedAt: Date.now()
            }, { merge: true });
        }
        await batch.commit();
    }

    const orphanCodes = [];
    for (const code of existingCodes) {
        if (!totalsByCode.has(code)) orphanCodes.push(code);
    }

    for (let i = 0; i < orphanCodes.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = orphanCodes.slice(i, i + chunkSize);
        for (const code of chunk) {
            const ref = existingDocsByCode.get(code) ?? doc(db, 'production_totals', code);
            batch.delete(ref);
        }
        await batch.commit();
    }
}

function buildRawMaterialBreakdown(topProducts, allProducts) {
    const byCode = new Map();
    for (const p of allProducts) {
        byCode.set(String(p?.code ?? '').trim().toUpperCase(), p);
    }

    return topProducts.map((tp) => {
        const pCode = String(tp.productCode ?? '').trim().toUpperCase();
        const product = byCode.get(pCode);
        const formula = Array.isArray(product?.formula) ? product.formula : parseFormula(product?.formulaText);

        const materials = (Array.isArray(formula) ? formula : []).map((item) => {
            const unitQty = Number(item?.qty ?? 0);
            const totalUsed = unitQty * Number(tp.totalProduced ?? 0);
            return {
                code: String(item?.code ?? '').trim().toUpperCase(),
                unitQty,
                totalUsed
            };
        });

        return {
            productCode: tp.productCode,
            productName: tp.productName,
            totalProduced: Number(tp.totalProduced ?? 0),
            materials
        };
    });
}

function renderTop5ReportHTML(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return `
        <section class="report-empty card" aria-live="polite">
            <p>No hay datos de producción acumulada para mostrar el Top 5 todavía.</p>
        </section>
        `;
    }

    return `
    <section class="report-grid" aria-label="Top 5 productos más fabricados">
        ${rows.map((row, idx) => `
            <article class="product-card">
                <header class="product-card__header">
                    <span class="ranking-badge" aria-label="Puesto ${idx + 1}">#${idx + 1}</span>
                    <div class="product-card__title-wrap">
                        <h4 class="product-card__title">${row.productName}</h4>
                        <p class="product-card__code">Código: <strong>${row.productCode}</strong></p>
                    </div>
                </header>

                <section class="total-panel" aria-label="Total fabricado">
                    <p class="total-panel__label">Total fabricado</p>
                    <p class="total-panel__value">${row.totalProduced}</p>
                </section>

                <section class="materials-panel" aria-label="Materia prima total usada">
                    <h5 class="materials-panel__title">Materia prima total usada</h5>
                    ${row.materials.length
                        ? `<ul class="materials-list">
                            ${row.materials.map((m) => `
                                <li class="materials-list__row">
                                    <span class="materials-list__code"><strong>${m.code}</strong></span>
                                    <span class="materials-list__calc">${m.unitQty} x ${row.totalProduced}</span>
                                    <span class="materials-list__total">${m.totalUsed}</span>
                                </li>
                            `).join('')}
                        </ul>`
                        : '<p class="materials-panel__empty">Sin receta/fórmula registrada para este producto.</p>'}
                </section>
            </article>
        `).join('')}
    </section>
    `;
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

            <h3>Reporte: Top 5 productos más fabricados</h3>
            <div class="actions">
                <button class="primary" type="button" id="btn-refresh-top5"> Actualizar Reporte</button>
            </div>
            <div id="top5-report">
                <p>Cargando reporte...</p>
            </div>
        </div>
        </div>
    </section>
    `;

    const toastEl = document.getElementById('prod-toast');
    const form = document.getElementById('production-form');
    const summaryEl = document.getElementById('process-summary');
    const top5ReportEl = document.getElementById('top5-report');
    const btnRefreshTop5 = document.getElementById('btn-refresh-top5');

    async function refreshTop5Report() {
        const defaultBtnText = '🔄 Actualizar Reporte';
        try {
            if (btnRefreshTop5) {
                btnRefreshTop5.disabled = true;
                btnRefreshTop5.textContent = 'Actualizando...';
            }

            top5ReportEl.innerHTML = '<p>Cargando reporte...</p>';

            await reconcileProductionTotalsFromProcesses();
            const top5 = await getTop5ProducedProducts();
            const allProducts = await getProducts();
            const rows = buildRawMaterialBreakdown(top5, allProducts);
            top5ReportEl.innerHTML = renderTop5ReportHTML(rows);
        } catch (err) {
            console.error('Error cargando reporte Top 5:', err);
            top5ReportEl.innerHTML = '<p>No se pudo cargar el reporte Top 5 en este momento.</p>';
        } finally {
            if (btnRefreshTop5) {
                btnRefreshTop5.disabled = false;
                btnRefreshTop5.textContent = defaultBtnText;
            }
        }
    }

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
    if (btnRefreshTop5) {
        btnRefreshTop5.addEventListener('click', refreshTop5Report);
    }
    updateSummary();
    await refreshTop5Report();

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
        await increaseProductionTotal({
            productCode: product.code,
            productName: product.name,
            quantity
        });

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

