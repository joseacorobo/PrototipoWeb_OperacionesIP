let currentArea = "Todas";
let chartHourly = null;
let chartTechnicians = null;
let chartWeights = null;
let activeTickets = [];
let currentOpenTicket = null;
let liveTimerInterval = null;
let timerStartMs = 0;
let isPaused = false;

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    loadDashboardData();
    setInterval(loadMailWorkerStatus, 20000);
});

function changeArea(area) {
    currentArea = area;
    document.getElementById("breadcrumb-area").innerText = area === "Todas" ? "Todas las Áreas" : `Área de ${area}`;
    
    const areas = ['todas', 'soporte', 'cabecera', 'telefonia'];
    areas.forEach(a => {
        const pill = document.getElementById(`pill-area-${a}`);
        const nav = document.getElementById(`nav-area-${a}`);
        const isActive = (a === 'todas' && area === 'Todas') || (a === area.toLowerCase().replace('í', 'i'));
        
        if (pill) {
            pill.className = isActive 
                ? "px-3 py-1.5 rounded-lg bg-white shadow-xs text-gray-900 font-semibold transition"
                : "px-3 py-1.5 rounded-lg text-snow-muted hover:text-gray-900 transition";
        }
        if (nav) {
            nav.className = isActive
                ? "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-snow-blue transition"
                : "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-snow-muted hover:bg-gray-50 hover:text-gray-900 transition";
        }
    });
    
    const techTitle = document.getElementById("tech-chart-title");
    if (area === "Todas") {
        techTitle.innerText = "Carga Individual por Especialista (12 Especialistas)";
        document.getElementById("kpi-tech-count").innerText = "12 especialistas";
    } else {
        techTitle.innerText = `Carga Individual: Especialistas de ${area} (4 personas)`;
        document.getElementById("kpi-tech-count").innerText = `4 especialistas de ${area}`;
    }
    
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const kpiRes = await fetch(`/api/kpis?area=${currentArea}`);
        const kpis = await kpiRes.json();
        
        document.getElementById("kpi-total-points").innerText = kpis.total_points;
        document.getElementById("kpi-avg-mttr").innerText = kpis.avg_mttr;
        document.getElementById("kpi-total-tasks").innerText = kpis.total_tasks;
        document.getElementById("kpi-avg-pts-tech").innerText = kpis.avg_points_per_tech;
        
        const badgeEl = document.getElementById("kpi-balance-status");
        badgeEl.innerText = kpis.balance_status;
        if (kpis.balance_badge === "success") {
            badgeEl.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
        } else if (kpis.balance_badge === "warning") {
            badgeEl.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600";
        } else {
            badgeEl.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600";
        }
        
        renderAreaProgress(kpis.points_by_area, kpis.total_points);

        const techRes = await fetch(`/api/charts/technicians?area=${currentArea}`);
        const techData = await techRes.json();
        renderTechniciansChart(techData);

        const weightsRes = await fetch(`/api/charts/task-weights?area=${currentArea}`);
        const weightsData = await weightsRes.json();
        renderWeightsChart(weightsData);

        const hourlyRes = await fetch(`/api/charts/hourly?area=${currentArea}`);
        const hourlyData = await hourlyRes.json();
        renderHourlyChart(hourlyData);

        loadInbox();
        loadFeed();
        loadMailWorkerStatus();

    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

function renderAreaProgress(areaPoints, totalPoints) {
    const container = document.getElementById("area-progress-bars");
    container.innerHTML = "";
    
    const areas = [
        { name: "Soporte de Operaciones", key: "Soporte", color: "bg-blue-500", count: "4 analistas" },
        { name: "Cabecera / Head End", key: "Cabecera", color: "bg-amber-500", count: "4 especialistas" },
        { name: "Telefonía VoIP", key: "Telefonía", color: "bg-purple-500", count: "4 especialistas" }
    ];
    
    areas.forEach(a => {
        const pts = areaPoints[a.key] || 0;
        const pct = totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
        const isSelected = (currentArea === a.key);
        const borderStyle = isSelected ? "border-l-4 border-snow-blue pl-2" : "";
        
        const html = `
            <div class="${borderStyle} transition">
                <div class="flex justify-between items-center text-xs mb-1">
                    <span class="font-medium ${isSelected ? 'text-snow-blue font-bold' : 'text-gray-800'}">${a.name}</span>
                    <span class="text-snow-muted font-semibold">${pts} pts (${pct}%)</span>
                </div>
                <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div class="${a.color} h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

function renderHourlyChart(hourlyData) {
    const ctx = document.getElementById('chartHourly').getContext('2d');
    if (chartHourly) chartHourly.destroy();
    
    chartHourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyData.labels,
            datasets: [{
                label: 'Puntos Acumulados',
                data: hourlyData.data,
                borderColor: '#437EF7',
                backgroundColor: 'rgba(67, 126, 247, 0.08)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#437EF7',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F1F5F9' }, beginAtZero: true }
            }
        }
    });
}

function renderTechniciansChart(techData) {
    const ctx = document.getElementById('chartTechnicians').getContext('2d');
    if (chartTechnicians) chartTechnicians.destroy();
    
    const labels = techData.map(t => t.name.split(' ')[0] + ' ' + (t.name.split(' ')[1] || '')[0] + '.');
    const points = techData.map(t => t.points);
    const colors = techData.map(t => t.color);
    
    chartTechnicians = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Puntos de Carga',
                data: points,
                backgroundColor: colors,
                borderRadius: 8,
                barThickness: techData.length <= 4 ? 36 : 22
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterLabel: (ctx) => {
                            const t = techData[ctx.dataIndex];
                            return `Área: ${t.area}\nTareas: ${t.tasks}\nMTTR: ${t.avg_mttr}m\nEstado: ${t.status}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#F1F5F9' }, beginAtZero: true }
            }
        }
    });
}

function renderWeightsChart(weightsData) {
    const ctx = document.getElementById('chartWeights').getContext('2d');
    if (chartWeights) chartWeights.destroy();
    
    const labels = weightsData.map(w => w.category);
    const data = weightsData.map(w => w.count);
    const colors = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA'];
    
    chartWeights = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 10 } }
                }
            }
        }
    });
}

// =============================================================
// BANDEJA DE CORREOS Y WORKSPACE INTEGRAL CON CRONÓMETRO
// =============================================================

async function loadInbox() {
    const res = await fetch(`/api/tickets/inbox?area=${currentArea}`);
    const tickets = await res.json();
    activeTickets = tickets;
    
    const tbody = document.getElementById('inbox-tbody');
    tbody.innerHTML = '';
    
    const pendingCount = tickets.filter(t => t.status === 'PENDIENTE').length;
    document.getElementById('badge-inbox-count').innerText = pendingCount;
    
    if (tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-snow-muted italic">No hay correos en esta área.</td></tr>`;
        return;
    }
    
    tickets.forEach(t => {
        let statusBadge = '';
        let actionBtn = '';
        
        if (t.status === 'PENDIENTE') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">Pendiente</span>`;
            actionBtn = `<button onclick="openTicketWorkspace(${t.id})" class="px-3 py-1 rounded-lg bg-snow-blue text-white font-semibold hover:bg-blue-600 transition shadow-2xs flex items-center gap-1"><i data-lucide="folder-open" class="w-3 h-3"></i> Atender</button>`;
        } else if (t.status === 'EN PROGRESO') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-blue-50 text-snow-blue font-semibold flex items-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> ${t.claimed_by_name || 'En Atención'}</span>`;
            actionBtn = `<button onclick="openTicketWorkspace(${t.id})" class="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition shadow-2xs flex items-center gap-1"><i data-lucide="play" class="w-3 h-3"></i> Continuar</button>`;
        } else if (t.status === 'EN ESPERA') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center gap-1"><i data-lucide="pause" class="w-3 h-3"></i> En Espera</span>`;
            actionBtn = `<button onclick="openTicketWorkspace(${t.id})" class="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition shadow-2xs flex items-center gap-1"><i data-lucide="play" class="w-3 h-3"></i> Reanudar</button>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">Completado</span>`;
            actionBtn = `<span class="text-emerald-600 font-bold flex items-center justify-end gap-1"><i data-lucide="check-check" class="w-3.5 h-3.5"></i> +${t.suggested_points} pts</span>`;
        }

        // Badge de Origen de Ingesta (Módulo 6)
        let sourceBadge = '';
        const src = (t.source || 'MANUAL').toUpperCase();
        if (src === 'REAL_IMAP') {
            sourceBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">IMAP Real</span>`;
        } else if (src === 'SIMULATOR' || src === 'SIMULADOR') {
            sourceBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-100">Simulador</span>`;
        } else {
            sourceBadge = `<span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-600 border border-gray-200">Manual</span>`;
        }
        
        const row = `
            <tr class="hover:bg-gray-50/60 transition cursor-pointer" onclick="openTicketWorkspace(${t.id})">
                <td class="py-2.5 px-3">
                    <span class="font-mono font-semibold text-gray-900 block">${t.ticket_code}</span>
                    <div class="mt-0.5">${sourceBadge}</div>
                </td>
                <td class="py-2.5 px-3">
                    <p class="font-medium text-gray-900 truncate max-w-xs">${t.subject}</p>
                    <p class="text-[10px] text-snow-muted truncate max-w-xs">${t.sender_email}</p>
                </td>
                <td class="py-2.5 px-3 font-medium text-snow-muted">${t.area}</td>
                <td class="py-2.5 px-3 text-gray-700 font-medium">${t.suggested_task_name || 'Operación'}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-snow-blue">+${t.suggested_points || 2} pts</span>
                </td>
                <td class="py-2.5 px-3">${statusBadge}</td>
                <td class="py-2.5 px-3 text-right" onclick="event.stopPropagation()">${actionBtn}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    lucide.createIcons();
}

async function openTicketWorkspace(ticketId) {
    try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        const t = await res.json();
        currentOpenTicket = t;

        // Si está PENDIENTE, reclamarlo automáticamente en el backend y comenzar cronómetro
        if (t.status === 'PENDIENTE') {
            await fetch(`/api/tickets/${ticketId}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 1 }) // Carlos Méndez (Soporte)
            });
            t.status = 'EN PROGRESO';
            t.claimed_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
        }

        // Llenar datos de la cabecera
        document.getElementById("ws-ticket-code").innerText = t.ticket_code;
        document.getElementById("ws-ticket-sender").innerText = t.sender_email;
        document.getElementById("ws-ticket-subject").innerText = t.subject;
        document.getElementById("ws-ticket-body").innerText = t.full_body;

        const srcEl = document.getElementById("ws-ticket-source-badge");
        if (srcEl) {
            const src = (t.source || 'MANUAL').toUpperCase();
            if (src === 'REAL_IMAP') {
                srcEl.innerText = "IMAP Real";
                srcEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100";
            } else if (src === 'SIMULATOR' || src === 'SIMULADOR') {
                srcEl.innerText = "Simulador";
                srcEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-snow-blue border border-blue-100";
            } else {
                srcEl.innerText = "Manual";
                srcEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200";
            }
        }

        // Llenar parámetros técnicos detectados
        document.getElementById("ws-param-subscriber").innerText = t.subscriber_code || "N/A";
        document.getElementById("ws-param-serial").innerText = t.serial_pon || "N/A";
        document.getElementById("ws-param-node").innerText = t.node_name || "N/A";
        document.getElementById("ws-param-slotpon").innerText = t.slot_pon || "N/A";
        document.getElementById("ws-param-mac").innerText = t.mac_address || "N/A";
        document.getElementById("ws-param-points-badge").innerText = `+${t.task_points || 2} pts (${t.task_code || 'P2'})`;
        document.getElementById("ws-param-taskname").innerText = t.task_name || "Operación Estándar";

        // Advertencia si es Modo Bridge
        const isBridge = (t.subject + t.full_body).toLowerCase().includes("bridge");
        const alertEl = document.getElementById("ws-bridge-alert");
        if (isBridge) {
            alertEl.classList.remove("hidden");
        } else {
            alertEl.classList.add("hidden");
        }

        // Iniciar cronómetro en vivo 100% automático
        startLiveTimer(t.claimed_at);

        // Mostrar Workspace
        document.getElementById("modalTicketWorkspace").classList.remove("hidden");
        document.getElementById("modalTicketWorkspace").classList.add("flex");
        lucide.createIcons();

    } catch (e) {
        console.error("Error opening ticket workspace:", e);
    }
}

function startLiveTimer(claimedAtStr) {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    
    // Parsear fecha inicial
    let startDate = new Date();
    if (claimedAtStr) {
        startDate = new Date(claimedAtStr.replace(' ', 'T'));
    }
    timerStartMs = startDate.getTime();

    function update() {
        const nowMs = Date.now();
        const diffSec = Math.max(0, Math.floor((nowMs - timerStartMs) / 1000));
        
        const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
        const secs = String(diffSec % 60).padStart(2, '0');
        
        document.getElementById("ws-live-timer").innerText = `${hrs}:${mins}:${secs}`;
    }

    update();
    liveTimerInterval = setInterval(update, 1000);
}

function closeWorkspaceModal() {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    document.getElementById("modalTicketWorkspace").classList.add("hidden");
    document.getElementById("modalTicketWorkspace").classList.remove("flex");
    loadInbox();
}

async function togglePauseTicket() {
    if (!currentOpenTicket) return;
    
    if (currentOpenTicket.status === 'EN PROGRESO') {
        await fetch(`/api/tickets/${currentOpenTicket.id}/pause`, { method: 'POST' });
        currentOpenTicket.status = 'EN ESPERA';
        document.getElementById("btn-pause-text").innerText = "Reanudar Tarea";
        document.getElementById("ws-ticket-status-badge").className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1.5";
        document.getElementById("ws-ticket-status-badge").innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> En Espera`;
    } else {
        await fetch(`/api/tickets/${currentOpenTicket.id}/resume`, { method: 'POST' });
        currentOpenTicket.status = 'EN PROGRESO';
        document.getElementById("btn-pause-text").innerText = "Pausar (En Espera)";
        document.getElementById("ws-ticket-status-badge").className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-snow-blue flex items-center gap-1.5";
        document.getElementById("ws-ticket-status-badge").innerHTML = `<span class="w-2 h-2 rounded-full bg-snow-blue animate-pulse"></span> En Atención`;
    }
}

async function submitCompleteAutomated(e) {
    e.preventDefault();
    if (!currentOpenTicket) return;
    
    const notes = document.getElementById("ws_resolution_notes").value;
    
    try {
        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution_notes: notes,
                task_type_id: currentOpenTicket.suggested_task_type_id
            })
        });
        
        const result = await res.json();
        if (result.status === 'ok') {
            closeWorkspaceModal();
            loadDashboardData(); // Recalcula puntos y MTTR en vivo
        }
    } catch (err) {
        console.error("Error completing ticket:", err);
    }
}

async function simulateEmail() {
    try {
        const res = await fetch(`/api/tickets/simulate-incoming?area=${currentArea}`, { method: 'POST' });
        const result = await res.json();
        if (result.status === 'ok') {
            loadInbox();
        }
    } catch (e) {
        console.error("Error simulating email:", e);
    }
}

async function loadFeed() {
    const res = await fetch(`/api/feed?area=${currentArea}`);
    const feed = await res.json();
    const tbody = document.getElementById('feed-tbody');
    tbody.innerHTML = '';
    
    feed.forEach(f => {
        const row = `
            <tr class="hover:bg-gray-50/60 transition">
                <td class="py-2.5 px-3 font-mono font-semibold text-snow-blue">${f.ticket}</td>
                <td class="py-2.5 px-3 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-gray-100 text-[10px] font-bold text-gray-700 flex items-center justify-center">${f.avatar}</span>
                    <span class="font-medium text-gray-900">${f.user}</span>
                </td>
                <td class="py-2.5 px-3 text-snow-muted">${f.area}</td>
                <td class="py-2.5 px-3 text-gray-700">${f.task}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-snow-blue">+${f.points} pts</span>
                </td>
                <td class="py-2.5 px-3 text-center font-mono text-snow-muted">${f.duration}m</td>
                <td class="py-2.5 px-3 text-right text-snow-muted">${f.time.split(' ')[1] || ''}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}
// =============================================================
// PROBADOR INTERACTIVO DEL ALGORITMO DE PARSING (CASOS REALES)
// =============================================================

let lastAnalyzedData = null;

function openTesterModal() {
    document.getElementById("modalParserTester").classList.remove("hidden");
    document.getElementById("modalParserTester").classList.add("flex");
    loadExampleText(1);
    lucide.createIcons();
}

function closeTesterModal() {
    document.getElementById("modalParserTester").classList.add("hidden");
    document.getElementById("modalParserTester").classList.remove("flex");
}

function loadExampleText(type) {
    const txtArea = document.getElementById("tester_raw_text");
    if (type === 1) {
        txtArea.value = `Buenas tardes soporte, favor apoyo con el siguiente caso:
AB: 1020491823
Serial: FHTT09182312
OLT: OLT-CHAC-01
Potencia: -19.2 dBm
Falla: El cliente no levanta servicio, la ont queda en discovery permanente. Favor desatascar demonio y pasar a whitelist.`;
    } else if (type === 2) {
        txtArea.value = `Buen dia equipo, tenemos al cliente con AB 2599182341 y serial HWTC88291044 en OLT-CCS-02 que tiene IP certificada modo bridge pero la mac 00:1a:2b:3c:4d:5e sale en rojo en el 815. Favor verificar wanmac.`;
    } else if (type === 3) {
        txtArea.value = `Alerta automática NOC: Enlace troncal OLT-CCS-01 slot uplink 1 presenta saturación al 79% (7.85 Gbps). Requiere evaluar activación de PortChannel a 20G en switch.`;
    }
}

async function executeParserAnalysis() {
    const rawText = document.getElementById("tester_raw_text").value;
    if (!rawText.trim()) return;

    try {
        const res = await fetch('/api/parser/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: rawText })
        });
        const data = await res.json();
        const p = data.parsed;
        lastAnalyzedData = p;

        // Llenar casillas
        document.getElementById("res_subscriber").value = p.subscriber_code || "N/A";
        const pBadge = document.getElementById("res_permisor_badge");
        if (p.permisor && pBadge) {
            pBadge.innerText = `P-${p.permisor}`;
            pBadge.classList.remove("hidden");
        } else if (pBadge) {
            pBadge.classList.add("hidden");
        }

        document.getElementById("res_serial").value = p.serial_pon ? `${p.serial_pon} (${p.vendor})` : "N/A";
        document.getElementById("res_node").value = p.node_name || "N/A";
        document.getElementById("res_slotpon").value = p.slot_pon || "Consultar en OLT vía Serial PON";
        document.getElementById("res_mac").value = p.mac_address || "No provista";
        document.getElementById("res_power").value = p.optical_power || "N/A";
        document.getElementById("res_points").value = `+${p.suggested_points} pts (${p.suggested_task_code})`;
        document.getElementById("res_taskname").innerText = `[${p.detected_area}] ${p.suggested_task_name}`;

        // Alerta bridge
        const bridgeEl = document.getElementById("tester-bridge-alert");
        if (p.is_bridge) {
            bridgeEl.classList.remove("hidden");
        } else {
            bridgeEl.classList.add("hidden");
        }

        document.getElementById("tester-results-container").classList.remove("hidden");
        lucide.createIcons();
    } catch (e) {
        console.error("Error analyzing text:", e);
    }
}

async function convertAnalysisToTicket() {
    if (!lastAnalyzedData) return;
    const rawText = document.getElementById("tester_raw_text").value;
    
    try {
        const res = await fetch('/api/tickets/ingest-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_email: "cuadrilla.terreno@inter.com.ve",
                subject: `Caso Procesado: ${lastAnalyzedData.suggested_task_name} (${lastAnalyzedData.subscriber_code || 'Cliente'})`,
                body_text: rawText
            })
        });
        const result = await res.json();
        if (result.status === 'ok') {
            closeTesterModal();
            loadDashboardData();
            const inboxEl = document.getElementById("inbox-section");
            if (inboxEl) inboxEl.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        console.error("Error converting to ticket:", e);
    }
}

// =============================================================
// CONTROLADOR DEL MÓDULO DE REPORTES GERENCIALES Y AUDITORÍA
// =============================================================

let reportCurrentArea = "Todas";
let reportCurrentRange = "all";

function openReportsModal() {
    document.getElementById("modalReportsAudit").classList.remove("hidden");
    document.getElementById("modalReportsAudit").classList.add("flex");
    loadReportsData();
    lucide.createIcons();
}

function closeReportsModal() {
    document.getElementById("modalReportsAudit").classList.add("hidden");
    document.getElementById("modalReportsAudit").classList.remove("flex");
}

function changeReportRange(range) {
    reportCurrentRange = range;
    ["all", "month", "7days", "today"].forEach(r => {
        const btn = document.getElementById(`btn-rep-${r}`);
        if (btn) {
            if (r === range) {
                btn.className = "px-2.5 py-1 rounded-lg bg-gray-900 text-white font-semibold transition";
            } else {
                btn.className = "px-2.5 py-1 rounded-lg text-snow-muted hover:text-gray-900 transition";
            }
        }
    });
    loadReportsData();
}

function changeReportArea(areaVal) {
    reportCurrentArea = areaVal;
    loadReportsData();
}

async function loadReportsData() {
    try {
        const res = await fetch(`/api/reports/summary?area=${reportCurrentArea}&range_filter=${reportCurrentRange}`);
        const data = await res.json();
        
        // 1. Llenar Tarjetas KPI
        document.getElementById("rep-kpi-points").innerText = `${data.kpis.total_points} pts`;
        document.getElementById("rep-kpi-tasks").innerText = `${data.kpis.total_tasks}`;
        document.getElementById("rep-kpi-mttr").innerText = `${data.kpis.avg_mttr} min`;
        document.getElementById("rep-kpi-sla").innerText = `${data.kpis.sla_compliance}%`;

        // 2. Llenar Tabla de Células
        const tbodyAreas = document.getElementById("rep-table-areas");
        tbodyAreas.innerHTML = "";
        data.area_breakdown.forEach(a => {
            const badgeClass = a.status === 'Equilibrada' ? 'bg-emerald-50 text-emerald-700' :
                              (a.status === 'Moderada' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700');
            const tr = `
                <tr class="hover:bg-gray-50/60 transition">
                    <td class="py-2 px-3 font-semibold text-gray-900">${a.area}</td>
                    <td class="py-2 px-3 text-center text-snow-muted">${a.techs_count}</td>
                    <td class="py-2 px-3 text-right font-mono">${a.total_tasks}</td>
                    <td class="py-2 px-3 text-right font-bold text-snow-blue">${a.total_points} pts</td>
                    <td class="py-2 px-3 text-center font-medium">${a.share_percent}%</td>
                    <td class="py-2 px-3 text-right font-mono">${a.avg_mttr} min</td>
                    <td class="py-2 px-3 text-center">
                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">
                            ${a.status}
                        </span>
                    </td>
                </tr>
            `;
            tbodyAreas.insertAdjacentHTML('beforeend', tr);
        });

        // 3. Llenar Tabla de Especialistas
        const tbodyTechs = document.getElementById("rep-table-techs");
        tbodyTechs.innerHTML = "";
        data.tech_rankings.forEach(t => {
            const stBadge = t.status === 'Equilibrada' ? 'bg-emerald-50 text-emerald-700' :
                           (t.status === 'Moderada' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700');
            const tr = `
                <tr class="hover:bg-gray-50/60 transition text-xs">
                    <td class="py-2 px-3 flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-gray-100 text-[9px] font-bold text-gray-700 flex items-center justify-center">${t.avatar}</span>
                        <span class="font-semibold text-gray-900">${t.name}</span>
                    </td>
                    <td class="py-2 px-3 text-snow-muted font-medium">${t.area}</td>
                    <td class="py-2 px-3 text-right font-mono">${t.tasks_count}</td>
                    <td class="py-2 px-3 text-right font-bold text-snow-blue">${t.total_points} pts</td>
                    <td class="py-2 px-3 text-center text-gray-600">${t.p1}</td>
                    <td class="py-2 px-3 text-center text-gray-600">${t.p2}</td>
                    <td class="py-2 px-3 text-center text-gray-600">${t.p3}</td>
                    <td class="py-2 px-3 text-center text-gray-600">${t.p4}</td>
                    <td class="py-2 px-3 text-center text-gray-600">${t.p5}</td>
                    <td class="py-2 px-3 text-right font-mono">${t.avg_mttr}m</td>
                    <td class="py-2 px-3 text-center">
                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${stBadge}">
                            ${t.status}
                        </span>
                    </td>
                </tr>
            `;
            tbodyTechs.insertAdjacentHTML('beforeend', tr);
        });

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading reports data:", err);
    }
}

function downloadExcelReport() {
    window.location.href = `/api/reports/export/excel?area=${reportCurrentArea}&range_filter=${reportCurrentRange}`;
}

// =============================================================
// CONTROLADOR DEL WORKER DE INGESTA DE CORREO (MÓDULO 6)
// =============================================================

let currentWorkerStatus = null;

async function loadMailWorkerStatus() {
    try {
        const res = await fetch('/api/mail-worker/status');
        if (!res.ok) return;
        const status = await res.json();
        currentWorkerStatus = status;

        // 1. Badge de Modo
        const modeBadge = document.getElementById("worker-mode-badge");
        const modeText = document.getElementById("worker-mode-text");
        if (modeBadge && modeText) {
            if (status.config.mode === 'REAL_IMAP') {
                modeBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5";
                modeText.innerText = "Modo: IMAP Real";
            } else {
                modeBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-snow-blue border border-blue-100 flex items-center gap-1.5";
                modeText.innerText = "Modo: Simulador";
            }
        }

        // 2. Badge de Estado (Activo / Pausado)
        const stateBadge = document.getElementById("worker-state-badge");
        const stateText = document.getElementById("worker-state-text");
        const btnToggleText = document.getElementById("btn-worker-toggle-text");
        const iconToggle = document.getElementById("icon-worker-toggle");

        const isRunning = status.is_running && status.config.enabled;

        if (stateBadge && stateText) {
            if (isRunning) {
                stateBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5";
                stateBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span id="worker-state-text">Activo (Cada ${status.config.poll_interval}s)</span>`;
            } else {
                stateBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1.5";
                stateBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span id="worker-state-text">Pausado</span>`;
            }
        }

        if (btnToggleText && iconToggle) {
            if (isRunning) {
                btnToggleText.innerText = "Pausar";
                iconToggle.setAttribute("data-lucide", "pause");
                iconToggle.className = "w-3.5 h-3.5 text-amber-600";
            } else {
                btnToggleText.innerText = "Reanudar";
                iconToggle.setAttribute("data-lucide", "play");
                iconToggle.className = "w-3.5 h-3.5 text-emerald-600";
            }
        }

        // 3. Telemetría (Última sync y total)
        const lastSyncEl = document.getElementById("worker-last-sync");
        if (lastSyncEl) {
            if (status.last_check) {
                lastSyncEl.innerText = status.last_check.split(' ')[1] || status.last_check;
            } else {
                lastSyncEl.innerText = "Pendiente";
            }
        }

        const totalCountEl = document.getElementById("worker-total-count");
        if (totalCountEl) {
            totalCountEl.innerText = status.total_processed;
        }

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading mail worker status:", err);
    }
}

async function toggleMailWorker() {
    if (!currentWorkerStatus) return;
    const nextState = !currentWorkerStatus.config.enabled;
    try {
        const res = await fetch('/api/mail-worker/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: nextState })
        });
        if (res.ok) {
            await loadMailWorkerStatus();
        }
    } catch (err) {
        console.error("Error toggling worker:", err);
    }
}

async function syncMailWorkerNow() {
    const btn = document.getElementById("btn-worker-sync");
    const icon = document.getElementById("icon-sync-spin");
    if (icon) icon.classList.add("animate-spin");
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/mail-worker/sync-now', { method: 'POST' });
        const result = await res.json();
        
        await loadMailWorkerStatus();
        if (result.status === 'ok' || result.new_tickets > 0) {
            await loadInbox();
            await loadDashboardData();
        }
    } catch (err) {
        console.error("Error syncing mail worker now:", err);
    } finally {
        if (icon) icon.classList.remove("animate-spin");
        if (btn) btn.disabled = false;
        lucide.createIcons();
    }
}

async function openMailConfigModal() {
    try {
        const res = await fetch('/api/mail-worker/status');
        const status = await res.json();
        currentWorkerStatus = status;
        const cfg = status.config;

        document.getElementById("cfg_mode").value = cfg.mode || "SIMULATOR";
        document.getElementById("cfg_interval").value = cfg.poll_interval || 60;
        document.getElementById("cfg_imap_server").value = cfg.imap_server || "imap.gmail.com";
        document.getElementById("cfg_imap_port").value = cfg.imap_port || 993;
        document.getElementById("cfg_imap_mailbox").value = cfg.imap_mailbox || "INBOX";
        document.getElementById("cfg_imap_user").value = cfg.imap_user || "";
        document.getElementById("cfg_imap_password").value = "";

        toggleImapFieldsVisibility();

        const modal = document.getElementById("modalMailWorkerConfig");
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        lucide.createIcons();
    } catch (err) {
        console.error("Error opening mail config modal:", err);
    }
}

function closeMailConfigModal() {
    const modal = document.getElementById("modalMailWorkerConfig");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function toggleImapFieldsVisibility() {
    const mode = document.getElementById("cfg_mode").value;
    const fields = document.getElementById("cfg_imap_fields");
    if (!fields) return;
    if (mode === "SIMULATOR") {
        fields.classList.add("opacity-50");
    } else {
        fields.classList.remove("opacity-50");
    }
}

async function saveMailWorkerConfig(e) {
    e.preventDefault();
    const mode = document.getElementById("cfg_mode").value;
    const interval = parseInt(document.getElementById("cfg_interval").value, 10) || 60;
    const server = document.getElementById("cfg_imap_server").value.trim();
    const port = parseInt(document.getElementById("cfg_imap_port").value, 10) || 993;
    const mailbox = document.getElementById("cfg_imap_mailbox").value.trim() || "INBOX";
    const user = document.getElementById("cfg_imap_user").value.trim();
    const pass = document.getElementById("cfg_imap_password").value;

    const payload = {
        mode: mode,
        poll_interval: interval,
        imap_server: server,
        imap_port: port,
        imap_mailbox: mailbox,
        imap_user: user
    };
    if (pass) {
        payload.imap_password = pass;
    }

    try {
        const res = await fetch('/api/mail-worker/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeMailConfigModal();
            await loadMailWorkerStatus();
            await loadInbox();
        }
    } catch (err) {
        console.error("Error saving mail worker config:", err);
    }
}

