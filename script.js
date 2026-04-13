// ─────────────────────────────────────────────
//  CONFIG (driven by body data attributes)
//  data-min-inicial: percentage as integer (0, 10, 15)
//  data-max-plazo:   max months (18 or 24)
// ─────────────────────────────────────────────
const MIN_INICIAL_PCT = parseFloat(document.body.dataset.minInicial ?? 10) / 100;
const MIN_PLAZO       = 6;
const MAX_PLAZO       = parseInt(document.body.dataset.maxPlazo ?? 18);

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const state = { precioEquipo: null, inicial: null, plazo: null };

const TASA_MENSUAL = 0.035; // 3.5% mensual

const formatCurrency = (v) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(v);

// ─────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────
const elPrecioEquipo      = document.getElementById('precioEquipo');
const elInicial           = document.getElementById('inicial');
const elInicialSlider     = document.getElementById('inicialSlider');
const elSliderPercent     = document.getElementById('sliderPercent');
const elMinInicialLabel   = document.getElementById('minInicialLabel');
const elHelperMinInicial  = document.getElementById('helperMinInicial');
const elHelperMinText     = document.getElementById('helperMinText');
const elAlertaInicial     = document.getElementById('alertaInicial');
const elPlazoSlider       = document.getElementById('plazoSlider');
const elPlazoLabel        = document.getElementById('plazoSelectedLabel');
const elPlazoHint         = document.getElementById('plazoHint');
const elPlazoTicks        = document.getElementById('plazoTicks');
const elNombreEquipo      = document.getElementById('nombreEquipo');

const outMontoFinanciar = document.getElementById('valMontoFinanciar');
const outComisionFlat   = document.getElementById('valComisionFlat');
const outInicialFlat    = document.getElementById('valInicialFlat');
const outCuotaMensual   = document.getElementById('valCuotaMensual');
const outTotalPagar     = document.getElementById('valTotalPagar');

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const minPct = Math.round(MIN_INICIAL_PCT * 100);

  // --- Config slider de inicial ---
  elInicialSlider.min   = minPct > 0 ? minPct : 0;
  elInicialSlider.value = minPct > 0 ? minPct : 0;
  elSliderPercent.textContent = minPct > 0 ? minPct : '0';

  // --- Texto de ayuda del mínimo ---
  if (MIN_INICIAL_PCT > 0) {
    elHelperMinText.textContent = `Mínimo obligatorio (${minPct}%): `;
    elAlertaInicial.textContent = `⚠️ El monto no puede ser menor al ${minPct}% del precio del equipo.`;
  } else {
    elHelperMinInicial.style.display = 'none';
    elInicial.placeholder = 'Opcional';
  }

  // --- Config slider de plazo: arranca en 6 meses por defecto ---
  elPlazoSlider.min   = MIN_PLAZO;
  elPlazoSlider.max   = MAX_PLAZO;
  elPlazoSlider.value = MIN_PLAZO;

  // Activar 6 meses como selección inicial
  onPlazoSlider();
});

// ─────────────────────────────────────────────
//  PLAZO SLIDER
// ─────────────────────────────────────────────
function onPlazoSlider() {
  const plazo = parseInt(elPlazoSlider.value);
  state.plazo = plazo;
  elPlazoLabel.textContent = plazo;
  elPlazoHint.style.display = 'none';
  renderPlazoTicks(plazo);
  calculate();
}

function renderPlazoTicks(selected) {
  elPlazoTicks.innerHTML = '';
  for (let m = MIN_PLAZO; m <= MAX_PLAZO; m++) {
    const tick = document.createElement('span');
    tick.className = 'plazo-tick' + (m === selected ? ' active' : '');
    tick.textContent = m;
    tick.title = `${m} meses`;
    tick.addEventListener('click', () => {
      elPlazoSlider.value = m;
      onPlazoSlider();
    });
    elPlazoTicks.appendChild(tick);
  }
}

// ─────────────────────────────────────────────
//  PRECIO DEL EQUIPO
// ─────────────────────────────────────────────
function onPrecioChange() {
  const precio = parseFloat(elPrecioEquipo.value);
  const minPct = Math.round(MIN_INICIAL_PCT * 100);

  if (isNaN(precio) || precio <= 0) {
    state.precioEquipo = null;
    state.inicial = null;
    elInicial.value = '';
    elMinInicialLabel.textContent = '$0.00';
    elInicialSlider.value = minPct > 0 ? minPct : 0;
    elSliderPercent.textContent = minPct > 0 ? minPct : '0';
    clearAlert();
    resetOutputs();
    return;
  }

  state.precioEquipo = precio;

  if (MIN_INICIAL_PCT > 0) {
    // Auto-rellena con el mínimo recomendado
    const minInicial = precio * MIN_INICIAL_PCT;
    elMinInicialLabel.textContent = formatCurrency(minInicial);
    elInicial.value = minInicial.toFixed(0);
    elInicialSlider.value = minPct;
    elSliderPercent.textContent = minPct;
  }

  clearAlert();
  calculate();
}

// ─────────────────────────────────────────────
//  SLIDER DE LA INICIAL
// ─────────────────────────────────────────────
function syncSlider() {
  const percent = parseFloat(elInicialSlider.value);
  elSliderPercent.textContent = percent;
  const precio = state.precioEquipo;
  if (!precio) return;
  elInicial.value = ((precio * percent) / 100).toFixed(0);
  clearAlert();
  calculate();
}

// ─────────────────────────────────────────────
//  INPUT MANUAL DE LA INICIAL
// ─────────────────────────────────────────────
function onInicialChange() {
  const precio = state.precioEquipo;
  if (!precio) return;

  const inicialRaw = parseFloat(elInicial.value);
  const minInicial = precio * MIN_INICIAL_PCT;

  if (isNaN(inicialRaw) || elInicial.value.trim() === '') {
    clearAlert();
    state.inicial = null;
    resetOutputs();
    return;
  }

  if (MIN_INICIAL_PCT > 0 && inicialRaw < minInicial) {
    showAlert();
    state.inicial = null;
    resetOutputs();
    return;
  }

  clearAlert();
  // Sync slider
  const percent = Math.min((inicialRaw / precio) * 100, 100);
  elInicialSlider.value = percent.toFixed(0);
  elSliderPercent.textContent = percent.toFixed(0);
  calculate();
}

// ─────────────────────────────────────────────
//  CÁLCULO CORE (determinista)
// ─────────────────────────────────────────────
function calculate() {
  const precio  = state.precioEquipo;
  const plazo   = state.plazo;
  const inicial = parseFloat(elInicial.value);
  const minInicial = precio ? precio * MIN_INICIAL_PCT : 0;

  const inicialValida = !isNaN(inicial) && inicial >= 0 &&
    (MIN_INICIAL_PCT === 0 || inicial >= minInicial);

  state.inicial = inicialValida ? inicial : null;

  if (!precio || !plazo || state.inicial === null) {
    resetOutputs();
    return;
  }

  //  Fórmulas (calculadora.md)
  const comisionFlat   = 0; // Eliminada por solicitud del equipo
  const montoFinanciar = precio - state.inicial;
  const inicialFlat    = state.inicial; // Ya no hay comision flat
  const capitalMensual = montoFinanciar / plazo;
  const interesMensual = montoFinanciar * TASA_MENSUAL;
  const cuotaMensual   = capitalMensual + interesMensual;
  const totalPagar     = state.inicial + (cuotaMensual * plazo);

  if (outMontoFinanciar) animValue(outMontoFinanciar, formatCurrency(montoFinanciar));
  if (outComisionFlat)   animValue(outComisionFlat,   formatCurrency(comisionFlat));
  if (outInicialFlat)    animValue(outInicialFlat,    formatCurrency(inicialFlat));
  if (outCuotaMensual)   animValue(outCuotaMensual,   formatCurrency(cuotaMensual));
  if (outTotalPagar)     animValue(outTotalPagar,     formatCurrency(totalPagar));
}

// ─────────────────────────────────────────────
//  UI HELPERS
// ─────────────────────────────────────────────
function showAlert() {
  elAlertaInicial.style.display = 'block';
  elInicial.classList.add('input-error');
}

function clearAlert() {
  elAlertaInicial.style.display = 'none';
  elInicial.classList.remove('input-error');
}

function resetOutputs() {
  [outMontoFinanciar, outComisionFlat, outInicialFlat, outCuotaMensual, outTotalPagar]
    .forEach(el => animValue(el, '$0.00'));
}

function animValue(el, newVal) {
  if (el.innerText === newVal) return;
  el.style.opacity   = '0.4';
  el.style.transform = 'translateY(-3px)';
  el.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  setTimeout(() => {
    el.innerText    = newVal;
    el.style.opacity   = '1';
    el.style.transform = 'translateY(0)';
  }, 150);
}

function resetCalculator() {
  const minPct = Math.round(MIN_INICIAL_PCT * 100);
  
  const inputs = [elPrecioEquipo, elInicial, elNombreEquipo];
  
  inputs.forEach(el => {
    if(el) {
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity = '0';
    }
  });

  setTimeout(() => {
    if(elNombreEquipo) elNombreEquipo.value = '';
    elPrecioEquipo.value = '';
    elInicial.value = '';
    elMinInicialLabel.textContent = '$0.00';
    if(elInicialSlider) elInicialSlider.value = minPct > 0 ? minPct : 0;
    if(elSliderPercent) elSliderPercent.textContent = minPct > 0 ? minPct : '0';
    
    if (elPlazoSlider) {
      elPlazoSlider.value = MIN_PLAZO;
      if(elPlazoLabel) elPlazoLabel.textContent = '—';
      if(elPlazoHint) elPlazoHint.style.display = 'inline';
    }
    
    Array.from(document.querySelectorAll('#pvAdicionales input[type="checkbox"]')).forEach(cb => cb.checked = false);
    
    clearAlert();
    state.precioEquipo = null;
    state.inicial = null;
    state.plazo = MIN_PLAZO;
    if (typeof renderPlazoTicks === 'function') renderPlazoTicks(null);
    if (typeof updatePlazos === 'function') updatePlazos();
    resetOutputs();
    
    inputs.forEach(el => {
      if(el) el.style.opacity = '1';
    });
  }, 200);
}

async function exportData() {
  const btn = document.querySelector('.btn-primary');
  if (!state.precioEquipo || !state.plazo || state.inicial === null) {
    alert('Por favor, complete todos los campos antes de guardar.');
    return;
  }
  btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Guardando...`;

  const montoFinanciar = state.precioEquipo - state.inicial;
  const capitalMensual = montoFinanciar / state.plazo;
  const interesMensual = montoFinanciar * TASA_MENSUAL;
  const cuotaMensual = capitalMensual + interesMensual;
  const totalPagar = state.inicial + (cuotaMensual * state.plazo);
  const minInicial = state.precioEquipo * MIN_INICIAL_PCT;
  
  let plazosDisponibles = [];
  const ticks = document.querySelectorAll('.plazo-tick');
  if (ticks && ticks.length > 0) {
    plazosDisponibles = Array.from(ticks).map(t => parseInt(t.textContent));
  } else {
    for (let m = MIN_PLAZO; m <= MAX_PLAZO; m++) plazosDisponibles.push(m);
  }

  const payload = {
    input: {
      nombreEquipo: elNombreEquipo ? elNombreEquipo.value : 'N/A',
      precioEquipo: state.precioEquipo,
      inicial: state.inicial,
      plazo: state.plazo
    },
    output: {
      montoFinanciar: parseFloat(montoFinanciar.toFixed(2)),
      comisionFlat: 0,
      inicialFlat: parseFloat(state.inicial.toFixed(2)),
      cuotaMensual: parseFloat(cuotaMensual.toFixed(2)),
      totalPagar: parseFloat(totalPagar.toFixed(2)),
      plazosDisponibles: plazosDisponibles,
      inicialRecomendadaMinima: parseFloat(minInicial.toFixed(2))
    }
  };

  try {
    await fetch("https://hook.us2.make.com/b6y2p17l4hmvas5ammiujfrn0ykors7w", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    btn.innerHTML = `<i class="ph ph-check"></i> Guardado exitosamente`;
    btn.style.backgroundColor = '#10B981';
  } catch (error) {
    console.error("Error al enviar recolección:", error);
    btn.innerHTML = `<i class="ph ph-warning-circle"></i> Error`;
    btn.style.backgroundColor = '#EF4444';
  }

  setTimeout(() => {
    btn.innerHTML = `<i class="ph ph-export"></i> Guardar cotización`;
    btn.style.backgroundColor = '';
  }, 3000);
}

// ─────────────────────────────────────────────
//  NUEVAS FUNCIONALIDADES (Whatsapp & Plan de Venta)
// ─────────────────────────────────────────────
function sendWhatsapp() {
  const equipoStr = (elNombreEquipo && elNombreEquipo.value) || 'N/A';
  const precio = state.precioEquipo ? formatCurrency(state.precioEquipo) : 'N/A';
  const inicial = state.inicial !== null ? formatCurrency(state.inicial) : 'N/A';
  const plazo = state.plazo ? `${state.plazo} meses` : 'N/A';
  
  let cuota = 'N/A';
  if (state.precioEquipo && state.plazo && state.inicial !== null) {
      const montoFinanciar = state.precioEquipo - state.inicial;
      const capitalMensual = montoFinanciar / state.plazo;
      const interesMensual = montoFinanciar * TASA_MENSUAL;
      cuota = formatCurrency(capitalMensual + interesMensual);
  }

  const msg = `HOSPITALAR - Venta a plazos INNOMED 
--------------------------
*Equipo:* ${equipoStr}
--------------------------
*Precio:* ${precio}
*Pago Inicial:* ${inicial}
*Plazo:* ${plazo}
*Cuota Mensual:* ${cuota}
--------------------------
Quedamos a su disposición.`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function showVentasForm() {
  const grid = document.querySelector('.calculator-grid');
  const form = document.getElementById('ventasFormSection');
  
  grid.style.transition = 'opacity 0.3s ease';
  grid.style.opacity = '0';
  
  setTimeout(() => {
    grid.style.display = 'none';
    form.style.display = 'block';
    form.style.opacity = '0';
    form.classList.remove('fade-in'); 
    form.style.transition = 'opacity 0.3s ease';
    
    // Allow reflow
    void form.offsetWidth;
    form.style.opacity = '1';
  }, 300);
}

function hideVentasForm() {
  const grid = document.querySelector('.calculator-grid');
  const form = document.getElementById('ventasFormSection');
  
  form.style.transition = 'opacity 0.3s ease';
  form.style.opacity = '0';
  
  setTimeout(() => {
    form.style.display = 'none';
    grid.style.display = 'grid';
    grid.style.opacity = '0';
    grid.style.transition = 'opacity 0.3s ease';
    
    // Allow reflow
    void grid.offsetWidth;
    grid.style.opacity = '1';
  }, 300);
}

async function generatePlanVentas(event) {
  event.preventDefault();

  const btn = event.target.querySelector('button[type="submit"]');
  const originalBtnHTML = btn.innerHTML;
  btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Generando y Enviando...`;
  btn.disabled = true;

  const data = {
    nombreEquipo: elNombreEquipo ? elNombreEquipo.value : 'N/A',
    realizadoPor: document.getElementById('pvRealizadoPor').value,
    cliente: document.getElementById('pvCliente').value,
    transductores: document.getElementById('pvTransductores').value,
    adicionales: document.getElementById('pvAdicionales').value,
    configuracion: document.getElementById('pvConfiguracion').value,
    iva: document.getElementById('pvIva').value
  };
  
  // Añadimos también los datos de la calculadora (el payload de gemini)
  const montoFinanciar = state.precioEquipo ? (state.precioEquipo - state.inicial) : 0;
  const capitalMensual = state.plazo ? (montoFinanciar / state.plazo) : 0;
  const interesMensual = montoFinanciar * TASA_MENSUAL;
  const cuotaMensual = capitalMensual + interesMensual;
  const totalPagar = state.inicial !== null ? (state.inicial + (cuotaMensual * state.plazo)) : 0;
  const minInicial = state.precioEquipo ? (state.precioEquipo * MIN_INICIAL_PCT) : 0;

  let plazosDisponibles = [];
  const ticks = document.querySelectorAll('.plazo-tick');
  if (ticks && ticks.length > 0) {
    plazosDisponibles = Array.from(ticks).map(t => parseInt(t.textContent));
  } else {
    for (let m = MIN_PLAZO; m <= MAX_PLAZO; m++) plazosDisponibles.push(m);
  }

  const payload = {
    input: {
      precioEquipo: state.precioEquipo,
      inicial: state.inicial,
      plazo: state.plazo
    },
    output: {
      montoFinanciar: parseFloat(montoFinanciar.toFixed(2)),
      comisionFlat: 0,
      inicialFlat: parseFloat(state.inicial.toFixed(2)),
      cuotaMensual: parseFloat(cuotaMensual.toFixed(2)),
      totalPagar: parseFloat(totalPagar.toFixed(2)),
      plazosDisponibles: plazosDisponibles,
      inicialRecomendadaMinima: parseFloat(minInicial.toFixed(2))
    },
    planVentas: data
  };

  try {
    const webhookUrl = "https://hook.us2.make.com/b6y2p17l4hmvas5ammiujfrn0ykors7w";
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    btn.innerHTML = `<i class="ph ph-check"></i> Enviado exitosamente`;
    btn.style.backgroundColor = '#10B981';
    alert('Plan de venta generado correctamente y datos enviados. (Plantilla de Word pendiente)');
  } catch (error) {
    console.error("Error enviando webhook:", error);
    btn.innerHTML = `<i class="ph ph-warning-circle"></i> Error al enviar`;
    btn.style.backgroundColor = '#EF4444';
    alert('Plan generado localmente pero hubo un error al enviar al Webhook.');
  }

  setTimeout(() => {
    btn.innerHTML = originalBtnHTML;
    btn.style.backgroundColor = '';
    btn.disabled = false;
    hideVentasForm();
  }, 2500);
}
