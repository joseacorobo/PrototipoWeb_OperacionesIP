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
    initTheme();
    lucide.createIcons();
    loadCurrentUserProfile();
    loadDashboardData();
    setInterval(loadMailWorkerStatus, 20000);

    // Seleccionar vista inicial según hash o default a 'metrics'
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('inbox') || hash.includes('correo')) {
        switchDashboardView('inbox');
    } else if (hash.includes('audit') || hash.includes('report') || hash.includes('historial')) {
        switchDashboardView('audit');
    } else {
        switchDashboardView('metrics');
    }
});

// =============================================================
// GESTOR DE MODO OSCURO SNOWUI (FIGMA DESIGN SYSTEM)
// =============================================================

function initTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    updateThemeIcon(isDark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
    try {
        updateChartsTheme(isDark);
    } catch (err) {
        console.warn("Error actualizando tema de graficos:", err);
    }
}

function updateThemeIcon(isDark) {
    const container = document.getElementById("theme-icon-container");
    if (container) {
        const iconName = isDark ? "sun" : "moon";
        const iconClass = isDark ? "w-4 h-4 text-amber-400" : "w-4 h-4 text-snow-muted";
        container.innerHTML = `<i data-lucide="${iconName}" class="${iconClass}"></i>`;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons({ root: container });
        }
        return;
    }
    const icon = document.getElementById("theme-icon");
    if (!icon) return;
    if (isDark) {
        icon.setAttribute("data-lucide", "sun");
        icon.className = "w-4 h-4 text-amber-400";
    } else {
        icon.setAttribute("data-lucide", "moon");
        icon.className = "w-4 h-4 text-snow-muted";
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function updateChartsTheme(isDark) {
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
    const tickColor = isDark ? '#8E8E93' : '#717579';
    const bgCard = isDark ? '#1C1C1E' : '#FFFFFF';

    if (chartHourly && chartHourly.options && chartHourly.options.scales) {
        if (chartHourly.options.scales.y && chartHourly.options.scales.y.grid) {
            chartHourly.options.scales.y.grid.color = gridColor;
        }
        if (chartHourly.options.scales.x) {
            if (!chartHourly.options.scales.x.ticks) chartHourly.options.scales.x.ticks = {};
            chartHourly.options.scales.x.ticks.color = tickColor;
        }
        if (chartHourly.options.scales.y) {
            if (!chartHourly.options.scales.y.ticks) chartHourly.options.scales.y.ticks = {};
            chartHourly.options.scales.y.ticks.color = tickColor;
        }
        if (chartHourly.data && chartHourly.data.datasets && chartHourly.data.datasets[0]) {
            chartHourly.data.datasets[0].pointBorderColor = bgCard;
        }
        chartHourly.update();
    }

    if (chartTechnicians && chartTechnicians.options && chartTechnicians.options.scales) {
        if (chartTechnicians.options.scales.y && chartTechnicians.options.scales.y.grid) {
            chartTechnicians.options.scales.y.grid.color = gridColor;
        }
        if (chartTechnicians.options.scales.x) {
            if (!chartTechnicians.options.scales.x.ticks) chartTechnicians.options.scales.x.ticks = {};
            chartTechnicians.options.scales.x.ticks.color = tickColor;
        }
        if (chartTechnicians.options.scales.y) {
            if (!chartTechnicians.options.scales.y.ticks) chartTechnicians.options.scales.y.ticks = {};
            chartTechnicians.options.scales.y.ticks.color = tickColor;
        }
        chartTechnicians.update();
    }

    if (chartWeights && chartWeights.data && chartWeights.data.datasets && chartWeights.data.datasets[0]) {
        chartWeights.data.datasets[0].borderColor = bgCard;
        if (chartWeights.options && chartWeights.options.plugins && chartWeights.options.plugins.legend && chartWeights.options.plugins.legend.labels) {
            chartWeights.options.plugins.legend.labels.color = tickColor;
        }
        chartWeights.update();
    }
}

function changeArea(area) {
    currentArea = area;
    
    let label = "Todas las Áreas";
    if (area === "Acceso" || area === "Redes de Acceso") {
        label = "División Redes de Acceso";
    } else if (area === "Soporte") {
        label = "Célula Soporte FTTH";
    } else if (area === "Cabecera") {
        label = "Célula Cabecera OLT";
    } else if (area === "Telefonía") {
        label = "Célula Telefonía VoIP";
    }
    document.getElementById("breadcrumb-area").innerText = label;
    const mainTitle = document.getElementById("main-view-title");
    if (mainTitle) {
        if (area === "Todas") {
            mainTitle.innerText = "Dashboard General de Operaciones";
        } else if (area === "Acceso" || area === "Redes de Acceso") {
            mainTitle.innerText = "Dashboard: División Redes de Acceso";
        } else {
            mainTitle.innerText = `Dashboard: ${label}`;
        }
    }
    
    reportCurrentArea = area;
    if (currentDashboardView === 'audit') {
        const sel = document.getElementById("select-report-area");
        if (sel) sel.value = area;
        loadReportsData();
    }

    // Auto-expandir el grupo acordeón correspondiente al área seleccionada
    if (area === "Acceso" || area === "Redes de Acceso" || area === "Soporte" || area === "Cabecera") {
        toggleSidebarMenu("acceso", true);
    } else if (area === "Telefonía") {
        toggleSidebarMenu("telefonia", true);
    }

    const areas = ['todas', 'acceso', 'soporte', 'cabecera', 'telefonia'];
    areas.forEach(a => {
        const pill = document.getElementById(`pill-area-${a}`);
        const nav = document.getElementById(`nav-area-${a}`);
        const isActive = (a === 'todas' && area === 'Todas') || 
                         (a === 'acceso' && (area === 'Acceso' || area === 'Redes de Acceso')) ||
                         (a === area.toLowerCase().replace('í', 'i'));
        
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
        techTitle.innerText = "Carga Individual por Especialista";
    } else if (area === "Acceso" || area === "Redes de Acceso") {
        techTitle.innerText = "Carga Individual: Especialistas de Redes de Acceso";
    } else {
        techTitle.innerText = `Carga Individual: Especialistas de ${area}`;
    }
    
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const kpiRes = await fetch(`/api/kpis?area=${currentArea}`);
        const kpis = await kpiRes.json();
        
        // Nivel 1: Visión Macro (ScoreCards)
        if (document.getElementById("kpi-queue-pending")) {
            document.getElementById("kpi-queue-pending").innerText = kpis.pending_count || 0;
        }
        if (document.getElementById("kpi-queue-progress")) {
            document.getElementById("kpi-queue-progress").innerText = kpis.in_progress_count || 0;
        }
        if (document.getElementById("kpi-queue-onhold")) {
            document.getElementById("kpi-queue-onhold").innerText = kpis.on_hold_count || 0;
        }

        if (document.getElementById("kpi-total-tasks")) {
            document.getElementById("kpi-total-tasks").innerText = kpis.total_tasks || 0;
        }
        if (document.getElementById("kpi-total-points")) {
            document.getElementById("kpi-total-points").innerText = kpis.total_points || 0;
        }
        
        if (document.getElementById("kpi-critical-unassigned")) {
            document.getElementById("kpi-critical-unassigned").innerText = kpis.unassigned_critical_count || 0;
            const critBadge = document.getElementById("kpi-critical-badge");
            if (critBadge) {
                if (kpis.unassigned_critical_count > 0) {
                    critBadge.className = "text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 animate-pulse";
                    critBadge.innerText = "¡Atención Inmediata!";
                } else {
                    critBadge.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
                    critBadge.innerText = "Bandeja Normal";
                }
            }
        }

        if (document.getElementById("kpi-first-response")) {
            document.getElementById("kpi-first-response").innerText = kpis.avg_first_response || "8.4";
        }
        if (document.getElementById("kpi-sla-compliance")) {
            document.getElementById("kpi-sla-compliance").innerText = `${kpis.sla_compliance || 94.2}%`;
        }
        if (document.getElementById("kpi-avg-mttr")) {
            document.getElementById("kpi-avg-mttr").innerText = kpis.avg_mttr || 0;
        }
        
        const badgeEl = document.getElementById("kpi-balance-status");
        if (badgeEl) {
            badgeEl.innerText = kpis.balance_status;
            if (kpis.balance_badge === "success") {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
            } else if (kpis.balance_badge === "warning") {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600";
            } else {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600";
            }
        }

        renderAreaProgress(kpis.points_by_area, kpis.total_points);

        const techRes = await fetch(`/api/charts/technicians?area=${currentArea}`);
        const techData = await techRes.json();
        renderTechniciansChart(techData);
        populateTechFilter(techData);

        const countEl = document.getElementById("kpi-tech-count");
        if (countEl) {
            const num = techData.length;
            countEl.innerText = `${num} especialista${num !== 1 ? 's' : ''}`;
        }

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
        { name: "Soporte FTTH", key: "Soporte", color: "bg-blue-500", category: "Redes de Acceso" },
        { name: "Cabecera OLT", key: "Cabecera", color: "bg-amber-500", category: "Redes de Acceso" },
        { name: "Telefonía VoIP", key: "Telefonía", color: "bg-purple-500", category: "Servicios & Clientes" }
    ];
    
    areas.forEach(a => {
        const pts = areaPoints[a.key] || 0;
        const pct = totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
        const isSelected = (currentArea === a.key) || (currentArea === "Acceso" && a.category === "Redes de Acceso");
        const borderStyle = isSelected ? "border-l-4 border-snow-blue pl-2" : "";
        
        const html = `
            <div class="${borderStyle} transition cursor-pointer" onclick="changeArea('${a.key}')">
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
    
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
    const tickColor = isDark ? '#8E8E93' : '#717579';
    const bgCard = isDark ? '#1C1C1E' : '#FFFFFF';

    chartHourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyData.labels,
            datasets: [{
                label: 'Puntos Acumulados',
                data: hourlyData.data,
                borderColor: '#437EF7',
                backgroundColor: 'rgba(67, 126, 247, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#437EF7',
                pointBorderColor: bgCard,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { color: tickColor }
                },
                y: { 
                    grid: { color: gridColor }, 
                    ticks: { color: tickColor },
                    beginAtZero: true 
                }
            }
        }
    });
}

function renderTechniciansChart(techData) {
    const ctx = document.getElementById('chartTechnicians').getContext('2d');
    if (chartTechnicians) chartTechnicians.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
    const tickColor = isDark ? '#8E8E93' : '#717579';

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
                x: { 
                    grid: { display: false },
                    ticks: { color: tickColor }
                },
                y: { 
                    grid: { color: gridColor }, 
                    ticks: { color: tickColor },
                    beginAtZero: true 
                }
            }
        }
    });
}

function renderWeightsChart(weightsData) {
    const ctx = document.getElementById('chartWeights').getContext('2d');
    if (chartWeights) chartWeights.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const bgCard = isDark ? '#1C1C1E' : '#FFFFFF';
    const tickColor = isDark ? '#8E8E93' : '#717579';

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
                borderColor: bgCard,
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
                    labels: { 
                        boxWidth: 10, 
                        font: { size: 10 },
                        color: tickColor
                    }
                }
            }
        }
    });
}

// =============================================================
// BANDEJA DE CORREOS Y WORKSPACE INTEGRAL CON CRONÓMETRO
// =============================================================

function populateTechFilter(techs) {
    const select = document.getElementById("filter-tech");
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="todos">Todos los Ingenieros</option>';
    techs.forEach(t => {
        select.innerHTML += `<option value="${t.name}">${t.name} (${t.area})</option>`;
    });
    if (currentVal) select.value = currentVal;
}

async function loadInbox() {
    const res = await fetch(`/api/tickets/inbox?area=${currentArea}`);
    const tickets = await res.json();
    activeTickets = tickets;
    
    const pendingCount = tickets.filter(t => t.status === 'PENDIENTE').length;
    const badgeInbox = document.getElementById('badge-inbox-count');
    if (badgeInbox) badgeInbox.innerText = pendingCount;
    const headerBadge = document.getElementById('header-badge-count');
    if (headerBadge) {
        headerBadge.style.display = pendingCount > 0 ? 'block' : 'none';
    }
    
    applyInboxFilters();
}

// =============================================================
// MICROSOFT 365 / OUTLOOK WEB INBOX ENGINE (NODE 160-236405)
// =============================================================

let currentInboxTab = 'prioritarios'; // 'prioritarios' | 'otros' | 'todos'
let isOutlookFullscreen = false;
let selectedTicketId = null;

function toggleOutlookFullscreen() {
    const inbox = document.getElementById("inbox-section");
    const icon = document.getElementById("icon-outlook-screen");
    if (!inbox) return;

    isOutlookFullscreen = !isOutlookFullscreen;
    if (isOutlookFullscreen) {
        inbox.classList.add("outlook-fullscreen-mode");
        if (icon) {
            icon.setAttribute("data-lucide", "minimize-2");
        }
    } else {
        inbox.classList.remove("outlook-fullscreen-mode");
        if (icon) {
            icon.setAttribute("data-lucide", "maximize-2");
        }
    }
    lucide.createIcons();
}

function switchInboxTab(tab) {
    currentInboxTab = tab;
    ['prioritarios', 'otros', 'todos'].forEach(t => {
        const btn = document.getElementById(`tab-inbox-${t}`);
        if (btn) {
            if (t === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
    applyInboxFilters();
}

function filterOutlookBySearch(query) {
    const globalInput = document.getElementById("global-search-input");
    if (globalInput) globalInput.value = query;
    applyInboxFilters();
}

function getSenderInitials(senderName, senderEmail) {
    if (senderName && senderName.trim().length > 0) {
        const parts = senderName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }
    if (senderEmail) {
        const user = senderEmail.split('@')[0];
        return user.substring(0, 2).toUpperCase();
    }
    return "IP";
}

function getAvatarColor(initials) {
    const colors = [
        "bg-[#0078D4] text-white",
        "bg-[#107C41] text-white",
        "bg-[#8764B8] text-white",
        "bg-[#D83B01] text-white",
        "bg-[#008272] text-white",
        "bg-[#038387] text-white",
        "bg-[#498205] text-white"
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
        sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
}

function applyInboxFilters() {
    const filterTech = document.getElementById("filter-tech") ? document.getElementById("filter-tech").value : "todos";
    const filterBottleneck = document.getElementById("filter-bottleneck") ? document.getElementById("filter-bottleneck").value : "todos";
    const outlookSearchEl = document.getElementById("outlook-search-input");
    const globalSearchEl = document.getElementById("global-search-input");
    const searchQuery = (outlookSearchEl ? outlookSearchEl.value : (globalSearchEl ? globalSearchEl.value : "")).trim().toLowerCase();

    // Contadores para pestañas Prioritarios vs Otros
    let countPrioritarios = 0;
    let countOtros = 0;

    activeTickets.forEach(t => {
        const isCrit = (t.suggested_points >= 4) || 
                       (t.sla_minutes && t.sla_minutes <= 20) || 
                       (t.subject && (t.subject.includes('Bridge') || t.subject.includes('OLT') || t.subject.includes('Troncal') || t.subject.includes('Caída') || t.subject.includes('Alerta')));
        if (isCrit) {
            countPrioritarios++;
        } else {
            countOtros++;
        }
    });

    const badgePrio = document.getElementById("badge-tab-prioritarios");
    if (badgePrio) badgePrio.innerText = countPrioritarios;
    const badgeOtr = document.getElementById("badge-tab-otros");
    if (badgeOtr) badgeOtr.innerText = countOtros;

    let filtered = activeTickets.filter(t => {
        // 1. Filtro por Pestaña
        const isCrit = (t.suggested_points >= 4) || 
                       (t.sla_minutes && t.sla_minutes <= 20) || 
                       (t.subject && (t.subject.includes('Bridge') || t.subject.includes('OLT') || t.subject.includes('Troncal') || t.subject.includes('Caída') || t.subject.includes('Alerta')));
        
        if (currentInboxTab === 'prioritarios' && !isCrit) return false;
        if (currentInboxTab === 'otros' && isCrit) return false;

        // 2. Filtro por Ingeniero
        if (filterTech !== "todos") {
            if ((t.claimed_by_name || "").toLowerCase() !== filterTech.toLowerCase()) {
                return false;
            }
        }

        // 3. Filtro por Diagnóstico / Cuello de Botella
        const slaMin = t.sla_minutes || 30;
        let elapsedMin = 0;
        let isOverSla = false;

        if (t.status === 'EN PROGRESO') {
            if (t.claimed_at) {
                const start = new Date(t.claimed_at.replace(' ', 'T')).getTime();
                const pausedMs = (t.total_paused_seconds || 0) * 1000;
                elapsedMin = Math.max(1, Math.round((Date.now() - start - pausedMs) / 60000));
            } else {
                elapsedMin = 14;
            }
            if (elapsedMin > slaMin) isOverSla = true;
        } else if (t.status === 'EN ESPERA') {
            elapsedMin = Math.round((t.total_paused_seconds || 600) / 60);
        } else if (t.status === 'PENDIENTE') {
            if (t.created_at) {
                const created = new Date(t.created_at.replace(' ', 'T')).getTime();
                elapsedMin = Math.max(1, Math.round((Date.now() - created) / 60000));
            } else {
                elapsedMin = 15;
            }
            if (elapsedMin > 45) isOverSla = true;
        }

        if (filterBottleneck === "estancados") {
            if (!isOverSla && t.status !== 'EN ESPERA') return false;
        } else if (filterBottleneck === "pausados") {
            if (t.status !== 'EN ESPERA') return false;
        } else if (filterBottleneck === "criticos") {
            if (!isCrit) return false;
        } else if (filterBottleneck === "pendientes") {
            if (t.status !== 'PENDIENTE') return false;
        }

        // 4. Filtro por Buscador
        if (searchQuery) {
            const rowStr = `${t.ticket_code} ${t.sender_email} ${t.subject} ${t.suggested_task_name || ''} ${t.claimed_by_name || ''} ${t.area} ${t.full_body || ''}`.toLowerCase();
            if (!rowStr.includes(searchQuery)) return false;
        }

        return true;
    });

    const countEl = document.getElementById("filter-visible-count");
    if (countEl) countEl.innerText = filtered.length;

    renderOutlookMessageList(filtered);
}

function renderOutlookMessageList(tickets) {
    const listContainer = document.getElementById("outlook-message-list");
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (tickets.length === 0) {
        listContainer.innerHTML = `
            <div class="p-8 text-center text-snow-muted italic text-xs">
                <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                No se encontraron correos con los filtros actuales.
            </div>
        `;
        lucide.createIcons();
        renderOutlookReadingPaneEmpty();
        return;
    }

    tickets.forEach((t, idx) => {
        const isSelected = (selectedTicketId !== null && t.id === selectedTicketId) || (selectedTicketId === null && idx === 0);
        if (isSelected && (selectedTicketId === null || selectedTicketId !== t.id)) {
            selectedTicketId = t.id;
        }

        const isUnread = t.status === 'PENDIENTE';
        const senderName = t.sender_email ? t.sender_email.split('@')[0].replace(/[._-]/g, ' ') : "Soporte";
        const cleanSender = senderName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const initials = getSenderInitials(cleanSender, t.sender_email);
        const avatarColor = getAvatarColor(initials);

        // Preview snippet (limita a 100 caracteres)
        const bodySnippet = (t.full_body || "Sin contenido previo...")
            .replace(/\r?\n/g, ' ')
            .substring(0, 110) + '...';

        // SLA tag / diagnóstico
        const slaMin = t.sla_minutes || 30;
        let elapsedMin = 0;
        let isOverSla = false;
        let slaPill = '';

        if (t.status === 'EN PROGRESO') {
            if (t.claimed_at) {
                const start = new Date(t.claimed_at.replace(' ', 'T')).getTime();
                const pausedMs = (t.total_paused_seconds || 0) * 1000;
                elapsedMin = Math.max(1, Math.round((Date.now() - start - pausedMs) / 60000));
            } else {
                elapsedMin = 14;
            }
            isOverSla = elapsedMin > slaMin;
            if (isOverSla) {
                slaPill = `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/40 dark:text-red-400">+${elapsedMin - slaMin}m Fuera SLA</span>`;
            } else {
                slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400">En SLA (${elapsedMin}m)</span>`;
            }
        } else if (t.status === 'EN ESPERA') {
            slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-400">Pausa Terreno</span>`;
        } else if (t.status === 'PENDIENTE') {
            slaPill = `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300">Por Atender</span>`;
        } else {
            slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Resuelto</span>`;
        }

        const card = document.createElement("div");
        card.id = `msg-item-${t.id}`;
        card.className = `outlook-msg-card p-3 cursor-pointer relative transition hover:bg-gray-50 dark:hover:bg-[#222225] ${isSelected ? 'outlook-item-selected' : 'bg-transparent'}`;
        card.onclick = () => selectOutlookMessage(t.id);

        card.innerHTML = `
            <div class="flex items-start gap-2.5">
                <!-- Avatar -->
                <div class="w-8 h-8 rounded-full ${avatarColor} shrink-0 flex items-center justify-center font-bold text-[11px] shadow-2xs">
                    ${initials}
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-hidden">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-xs ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'} truncate max-w-[170px]">
                            ${cleanSender}
                        </span>
                        <span class="text-[10px] text-snow-muted font-mono shrink-0">
                            ${t.created_at ? t.created_at.substring(11, 16) : '10:42'}
                        </span>
                    </div>

                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-[10px] font-mono font-bold text-[#0078D4]">${t.ticket_code}</span>
                        <p class="text-xs ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-300'} truncate">
                            ${t.subject}
                        </p>
                    </div>

                    <p class="text-[11px] text-snow-muted line-clamp-2 leading-relaxed mb-2 font-normal">
                        ${bodySnippet}
                    </p>

                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">${t.area}</span>
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#0078D4] dark:bg-blue-900/40 dark:text-blue-300">+${t.suggested_points || 2} pts</span>
                        ${slaPill}
                        ${t.claimed_by_name ? `<span class="text-[9px] text-snow-muted ml-auto truncate max-w-[90px] font-medium">${t.claimed_by_name}</span>` : ''}
                    </div>
                </div>

                <!-- Unread Blue Dot Indicator -->
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-[#0078D4] shrink-0 mt-1"></span>' : ''}
            </div>
        `;
        listContainer.appendChild(card);
    });

    lucide.createIcons();

    // Cargar en el panel de lectura el ticket seleccionado
    if (selectedTicketId !== null) {
        const found = tickets.find(t => t.id === selectedTicketId) || tickets[0];
        if (found) {
            loadTicketIntoReadingPane(found);
        }
    }
}

function renderOutlookReadingPaneEmpty() {
    const pane = document.getElementById("outlook-reading-pane");
    if (!pane) return;
    pane.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-[#0078D4] flex items-center justify-center mb-4">
                <i data-lucide="mail" class="w-8 h-8"></i>
            </div>
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1">Selecciona un correo para leerlo</h3>
            <p class="text-xs text-snow-muted max-w-sm">
                Haz clic en cualquier ticket de la lista de la izquierda para desplegar su ficha técnica, cuerpo del mensaje, parámetros y comenzar su atención técnica con cronómetro en vivo.
            </p>
        </div>
    `;
    lucide.createIcons();
}

async function selectOutlookMessage(ticketId) {
    selectedTicketId = ticketId;

    // Actualizar clase activa en la lista
    document.querySelectorAll(".outlook-msg-card").forEach(el => {
        el.classList.remove("outlook-item-selected");
    });
    const selectedEl = document.getElementById(`msg-item-${ticketId}`);
    if (selectedEl) selectedEl.classList.add("outlook-item-selected");

    // Fetch y carga del ticket
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
            t.claimed_by_name = "Carlos Méndez";
        }

        loadTicketIntoReadingPane(t);

    } catch (e) {
        console.error("Error fetching ticket details:", e);
    }
}

function loadTicketIntoReadingPane(t) {
    currentOpenTicket = t;
    const pane = document.getElementById("outlook-reading-pane");
    if (!pane) return;

    const senderName = t.sender_email ? t.sender_email.split('@')[0].replace(/[._-]/g, ' ') : "Soporte FibraHogar";
    const cleanSender = senderName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const initials = getSenderInitials(cleanSender, t.sender_email);
    const avatarColor = getAvatarColor(initials);

    const isBridge = (t.subject + (t.full_body || '')).toLowerCase().includes("bridge");

    // Source badge
    const src = (t.source || 'MANUAL').toUpperCase();
    let srcText = "Manual";
    let srcClass = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    if (src === 'REAL_IMAP') {
        srcText = "IMAP Real";
        srcClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900";
    } else if (src === 'SIMULATOR' || src === 'SIMULADOR') {
        srcText = "Simulador FSM";
        srcClass = "bg-blue-50 text-[#0078D4] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900";
    }

    // Status badge
    let statusText = "En Atención";
    let statusClass = "bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/30 dark:text-blue-300";
    if (t.status === 'EN ESPERA') {
        statusText = "En Espera";
        statusClass = "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-300";
    } else if (t.status === 'COMPLETADO') {
        statusText = "Completado";
        statusClass = "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300";
    }

    const fullTimestamp = t.created_at || "Hoy, 10:42 AM";

    pane.innerHTML = `
        <div class="flex-1 flex flex-col h-full overflow-hidden">
            <!-- 1. Top Ribbon of Email: Ticket info & Live Chronometer -->
            <div class="px-5 py-3 border-b border-snow-border bg-gray-50/70 dark:bg-[#1E1E20] flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2 overflow-hidden">
                    <span id="ws-ticket-code" class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-[#2C2C2E] border border-snow-border text-gray-900 dark:text-white shadow-2xs">${t.ticket_code}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded ${srcClass}">${srcText}</span>
                    <span id="ws-ticket-status-badge" class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass} flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-current ${t.status === 'EN PROGRESO' ? 'animate-pulse' : ''}"></span>
                        ${statusText}
                    </span>
                    <span id="ws-ticket-sender" class="hidden sm:inline text-xs text-snow-muted truncate max-w-xs font-mono">&lt;${t.sender_email}&gt;</span>
                </div>

                <div class="flex items-center gap-2.5">
                    <!-- CRONOMETRO EN VIVO -->
                    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#2C2C2E] border border-snow-border shadow-2xs">
                        <i data-lucide="timer" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                        <span class="text-[11px] text-snow-muted font-medium">Tiempo:</span>
                        <span id="ws-live-timer" class="font-mono font-bold text-xs text-gray-900 dark:text-white">00:00:00</span>
                    </div>

                    <button id="btn-pause-ticket" onclick="togglePauseTicket()" class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                        <i data-lucide="pause-circle" class="w-3.5 h-3.5"></i>
                        <span id="btn-pause-text">${t.status === 'EN ESPERA' ? 'Reanudar' : 'Pausar'}</span>
                    </button>
                </div>
            </div>

            <!-- 2. Email Body & Technical Content (Scrollable) -->
            <div class="flex-1 overflow-y-auto p-5 space-y-4">
                
                <!-- Subject & Badges -->
                <div>
                    <h2 id="ws-ticket-subject" class="text-base font-bold text-gray-900 dark:text-white tracking-tight">${t.subject}</h2>
                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300">${t.area}</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/40 dark:text-purple-300">${t.suggested_task_name || 'Operación'}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">+${t.suggested_points || 2} pts (P${t.suggested_points || 2})</span>
                        <span class="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">SLA: ${t.sla_minutes || 30}m</span>
                    </div>
                </div>

                <!-- Sender Profile Card (Outlook 365 style) -->
                <div class="flex items-start justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-[#242426] border border-snow-border">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${avatarColor} font-bold text-xs flex items-center justify-center shadow-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span>${cleanSender}</span>
                                <span class="text-[10px] font-normal text-snow-muted font-mono">&lt;${t.sender_email}&gt;</span>
                            </p>
                            <p class="text-[11px] text-snow-muted">Para: <span class="font-medium text-gray-700 dark:text-gray-300">Operaciones IP &lt;operaciones@inter.com.ve&gt;</span></p>
                        </div>
                    </div>
                    <span class="text-[10px] text-snow-muted font-medium">${fullTimestamp}</span>
                </div>

                <!-- Security Callout (Modo Bridge o Troncal) -->
                ${isBridge ? `
                <div id="ws-bridge-alert" class="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0 mt-0.5"></i>
                    <div>
                        <strong class="font-bold">POLÍTICA CRÍTICA DE MODO BRIDGE:</strong>
                        <span> Bajo ninguna circunstancia aplicar reaprovisionamiento ni enviar comando REFRESH por Soporte FibraHogar a esta ONT. Validar WANMAC directamente en Servidor 815.</span>
                    </div>
                </div>` : ''}

                <!-- Adaptive Card: Parámetros Técnicos Detectados -->
                <div class="bg-gray-50/80 dark:bg-[#202022] rounded-xl border border-snow-border p-3.5">
                    <div class="flex items-center justify-between mb-2.5">
                        <span class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="cpu" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                            Parámetros Técnicos Detectados (NLP Inter NOC)
                        </span>
                        <span class="text-[10px] font-mono text-gray-500 bg-white dark:bg-[#2C2C2E] px-2 py-0.5 rounded border border-snow-border">Ficha FSM</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Abonado (10 Dígitos)</span>
                            <span id="ws-param-subscriber" class="font-bold font-mono text-gray-900 dark:text-white">${t.subscriber_code || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Serial PON</span>
                            <span id="ws-param-serial" class="font-bold font-mono text-gray-900 dark:text-white">${t.serial_pon || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Nodo OLT</span>
                            <span id="ws-param-node" class="font-bold text-gray-900 dark:text-white truncate block">${t.node_name || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Slot / PON</span>
                            <span id="ws-param-slotpon" class="font-bold font-mono text-gray-900 dark:text-white">${t.slot_pon || '--'}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-snow-muted block">Dirección MAC Abonado</span>
                                <span id="ws-param-mac" class="font-bold font-mono text-gray-900 dark:text-white">${t.mac_address || '--'}</span>
                            </div>
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-gray-600 dark:text-gray-300">L2/L3</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-snow-muted block">Complejidad Ponderada</span>
                                <span id="ws-param-points-badge" class="font-bold text-[#0078D4]">+${t.suggested_points || 2} pts (P${t.suggested_points || 2})</span>
                            </div>
                            <span id="ws-param-taskname" class="text-[11px] text-gray-700 dark:text-gray-300 font-medium truncate">${t.suggested_task_name || 'Operación'}</span>
                        </div>
                    </div>
                </div>

                <!-- Full Original Message Body -->
                <div class="rounded-xl border border-snow-border p-3.5 bg-white dark:bg-[#1E1E20]">
                    <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <i data-lucide="mail-open" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                        Mensaje Original del Solicitante
                    </p>
                    <div id="ws-ticket-body" class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans whitespace-pre-wrap bg-gray-50/60 dark:bg-[#242426] p-3 rounded-lg border border-snow-border/80 select-text">
                        ${(t.full_body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </div>
                </div>

                <!-- Formulario de Respuesta y Resolución Inline (Outlook Reply Style) -->
                <form id="formCompleteTicketAutomated" onsubmit="submitCompleteAutomated(event)" class="space-y-3 pt-1">
                    <div>
                        <label class="block font-semibold text-gray-800 dark:text-gray-200 text-xs mb-1">
                            Diagnóstico Técnico y Comandos Aplicados (Respuesta de Cierre):
                        </label>
                        <textarea id="ws_resolution_notes" required rows="2" placeholder="Ej. Se validó atenuación óptica en -19.2 dBm. Demonio OLT desatascado en Slot 3 PON 4. ONT pasó a Whitelist y MAC en VERDE." class="w-full bg-gray-50 dark:bg-[#242426] border border-snow-border rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078D4]"></textarea>
                    </div>

                    <div class="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div class="flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-emerald-600"></i>
                            <span class="text-emerald-800 dark:text-emerald-300 font-medium">El cronómetro y los puntos acumulados se computarán automáticamente al resolver.</span>
                        </div>
                        <button type="submit" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs flex items-center gap-2 cursor-pointer">
                            <i data-lucide="send" class="w-3.5 h-3.5"></i>
                            <span>Resolver y Computar Puntos</span>
                        </button>
                    </div>
                </form>

            </div>
        </div>
    `;

    lucide.createIcons();

    // Iniciar cronómetro en vivo
    if (t.status === 'EN PROGRESO') {
        startLiveTimer(t.claimed_at);
    } else {
        if (liveTimerInterval) clearInterval(liveTimerInterval);
        const timerEl = document.getElementById("ws-live-timer");
        if (timerEl) {
            timerEl.innerText = t.status === 'COMPLETADO' ? `${t.net_duration || 15}:00` : "00:00:00";
        }
    }
}

function startLiveTimer(claimedAtStr) {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    
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
        
        const el = document.getElementById("ws-live-timer");
        if (el) el.innerText = `${hrs}:${mins}:${secs}`;
    }

    update();
    liveTimerInterval = setInterval(update, 1000);
}

function closeWorkspaceModal() {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    loadInbox();
}

async function togglePauseTicket() {
    if (!currentOpenTicket) return;
    
    if (currentOpenTicket.status === 'EN PROGRESO') {
        await fetch(`/api/tickets/${currentOpenTicket.id}/pause`, { method: 'POST' });
        currentOpenTicket.status = 'EN ESPERA';
        const btnText = document.getElementById("btn-pause-text");
        if (btnText) btnText.innerText = "Reanudar";
        const stBadge = document.getElementById("ws-ticket-status-badge");
        if (stBadge) {
            stBadge.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1";
            stBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> En Espera`;
        }
        if (liveTimerInterval) clearInterval(liveTimerInterval);
    } else {
        await fetch(`/api/tickets/${currentOpenTicket.id}/resume`, { method: 'POST' });
        currentOpenTicket.status = 'EN PROGRESO';
        const btnText = document.getElementById("btn-pause-text");
        if (btnText) btnText.innerText = "Pausar";
        const stBadge = document.getElementById("ws-ticket-status-badge");
        if (stBadge) {
            stBadge.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0078D4] border border-blue-100 flex items-center gap-1";
            stBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-[#0078D4] animate-pulse"></span> En Atención`;
        }
        startLiveTimer(currentOpenTicket.claimed_at);
    }
    applyInboxFilters();
}

async function submitCompleteAutomated(e) {
    e.preventDefault();
    if (!currentOpenTicket) return;
    
    const notesEl = document.getElementById("ws_resolution_notes");
    const notes = notesEl ? notesEl.value : "";
    
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
            selectedTicketId = null;
            closeWorkspaceModal();
            loadDashboardData();
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
            <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
                <td class="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">${f.ticket}</td>
                <td class="py-2.5 px-3 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#242426] text-[10px] font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center">${f.avatar}</span>
                    <span class="font-medium text-gray-900 dark:text-white">${f.user}</span>
                </td>
                <td class="py-2.5 px-3 text-snow-muted font-medium">${f.area}</td>
                <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300">${f.task}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60 font-mono">+${f.points} pts</span>
                </td>
                <td class="py-2.5 px-3 text-center font-mono text-gray-800 dark:text-gray-200">${f.duration}m</td>
                <td class="py-2.5 px-3 text-right text-snow-muted font-mono">${f.time.split(' ')[1] || ''}</td>
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
    switchDashboardView('audit');
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
        const elPoints = document.getElementById("rep-kpi-points");
        const elTasks = document.getElementById("rep-kpi-tasks");
        const elMttr = document.getElementById("rep-kpi-mttr");
        const elSla = document.getElementById("rep-kpi-sla");
        if (elPoints) elPoints.innerText = `${data.kpis.total_points} pts`;
        if (elTasks) elTasks.innerText = `${data.kpis.total_tasks}`;
        if (elMttr) elMttr.innerText = `${data.kpis.avg_mttr} min`;
        if (elSla) elSla.innerText = `${data.kpis.sla_compliance}%`;

        // 2. Llenar Tabla de Células
        const tbodyAreas = document.getElementById("rep-table-areas");
        if (tbodyAreas) {
            tbodyAreas.innerHTML = "";
            data.area_breakdown.forEach(a => {
                const badgeClass = a.status === 'Equilibrada' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' 
                    : (a.status === 'Moderada' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60' 
                        : 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700/60');
                const tr = `
                    <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
                        <td class="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">${a.area}</td>
                        <td class="py-2.5 px-3 text-center text-snow-muted font-medium">${a.techs_count}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${a.total_tasks}</td>
                        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${a.total_points} pts</td>
                        <td class="py-2.5 px-3 text-center font-semibold text-gray-700 dark:text-gray-300">${a.share_percent}%</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${a.avg_mttr} min</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${badgeClass}">
                                ${a.status}
                            </span>
                        </td>
                    </tr>
                `;
                tbodyAreas.insertAdjacentHTML('beforeend', tr);
            });
        }

        // 3. Llenar Tabla de Especialistas
        const tbodyTechs = document.getElementById("rep-table-techs");
        if (tbodyTechs) {
            tbodyTechs.innerHTML = "";
            data.tech_rankings.forEach(t => {
                const stBadge = t.status === 'Equilibrada' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' 
                    : (t.status === 'Moderada' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60' 
                        : 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700/60');
                const tr = `
                    <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition text-xs">
                        <td class="py-2.5 px-3 flex items-center gap-2">
                            <span class="w-6 h-6 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">${t.avatar}</span>
                            <span class="font-semibold text-gray-900 dark:text-white">${t.name}</span>
                        </td>
                        <td class="py-2.5 px-3 text-snow-muted font-medium">${t.area}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${t.tasks_count}</td>
                        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${t.total_points} pts</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p1}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p2}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p3}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p4}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p5}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${t.avg_mttr}m</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${stBadge}">
                                ${t.status}
                            </span>
                        </td>
                    </tr>
                `;
                tbodyTechs.insertAdjacentHTML('beforeend', tr);
            });
        }

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

        const cfg = status.config || status;
        const mode = cfg.mode || status.mode || 'SIMULATOR';
        const isEnabled = (cfg.enabled !== undefined) ? cfg.enabled : (status.enabled !== undefined ? status.enabled : true);
        const pollInterval = cfg.poll_interval || status.poll_interval || 30;

        // 1. Badge de Modo
        const modeBadge = document.getElementById("worker-mode-badge");
        const modeText = document.getElementById("worker-mode-text");
        if (modeBadge && modeText) {
            if (mode === 'REAL_IMAP') {
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

        const isRunning = status.is_running && isEnabled;

        if (stateBadge && stateText) {
            if (isRunning) {
                stateBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5";
                stateBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span id="worker-state-text">Activo (Cada ${pollInterval}s)</span>`;
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
            totalCountEl.innerText = status.total_processed ?? status.emails_processed ?? 0;
        }

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading mail worker status:", err);
    }
}

async function toggleMailWorker() {
    if (!currentWorkerStatus) return;
    const isCurrentlyEnabled = (currentWorkerStatus.config && currentWorkerStatus.config.enabled !== undefined)
        ? currentWorkerStatus.config.enabled
        : (currentWorkerStatus.enabled !== undefined ? currentWorkerStatus.enabled : true);
    const nextState = !isCurrentlyEnabled;
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


// =============================================================
// BUSCADOR RÁPIDO GLOBAL Y ACCESOS DE TECLADO
// =============================================================

function filterInboxBySearch(query) {
    const term = (query || "").trim().toLowerCase();
    const rows = document.querySelectorAll("#inbox-tbody tr");
    rows.forEach(r => {
        if (!term) {
            r.style.display = "";
            return;
        }
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(term) ? "" : "none";
    });
}

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input");
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});

// =============================================================
// GESTOR DE ACORDEÓN ANIMADO SIDEBAR (MODELO FIGMA NODE 80-1461)
// =============================================================

function toggleSidebarMenu(groupId, forceState = null) {
    const submenu = document.getElementById(`submenu-${groupId}`);
    const chevron = document.getElementById(`chevron-${groupId}`);
    if (!submenu) return;

    const isExpanded = submenu.classList.contains("expanded");
    const shouldOpen = forceState !== null ? forceState : !isExpanded;

    if (shouldOpen) {
        submenu.classList.remove("collapsed");
        submenu.classList.add("expanded");
        if (chevron) chevron.classList.add("rotate-180");
    } else {
        submenu.classList.remove("expanded");
        submenu.classList.add("collapsed");
        if (chevron) chevron.classList.remove("rotate-180");
    }
}

function handleGroupHover(groupId, isHovering) {
    // Si el usuario pasa el mouse por encima, expandir suavemente
    if (isHovering) {
        toggleSidebarMenu(groupId, true);
    } else {
        // Al quitar el mouse, solo colapsar si esta casilla NO contiene el área actualmente activa
        const isActiveAreaInGroup = checkGroupContainsActiveArea(groupId);
        if (!isActiveAreaInGroup) {
            toggleSidebarMenu(groupId, false);
        }
    }
}

function checkGroupContainsActiveArea(groupId) {
    if (groupId === "acceso") {
        return currentArea === "Acceso" || currentArea === "Redes de Acceso" || currentArea === "Soporte" || currentArea === "Cabecera";
    } else if (groupId === "telefonia") {
        return currentArea === "Telefonía";
    }
    return false;
}

// =============================================================
// GESTIÓN DE SESIÓN Y PERFIL DE USUARIO
// =============================================================

async function loadCurrentUserProfile() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const user = await res.json();
            const nameEl = document.getElementById("sidebar-user-name");
            const roleEl = document.getElementById("sidebar-user-role");
            const avatarEl = document.getElementById("sidebar-user-avatar");
            if (nameEl) nameEl.innerText = user.name;
            if (roleEl) roleEl.innerText = user.role === 'ADMINISTRADOR' ? 'Administrador NOC' : (user.role + ' - ' + user.area);
            if (avatarEl && user.avatar) avatarEl.innerText = user.avatar;
        }
    } catch (e) {
        console.error("Error loading user profile:", e);
    }
}

async function logoutSession() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) {
        window.location.href = '/login';
    }
}

// =============================================================
// CONMUTADOR DE VISTAS MODULARES (MÉTRICAS / BANDEJA / AUDITORÍA)
// =============================================================

let currentDashboardView = 'metrics'; // 'metrics' | 'inbox' | 'audit'

function switchDashboardView(viewId) {
    currentDashboardView = viewId;
    window.currentDashboardView = viewId;
    
    const viewMetrics = document.getElementById('view-metrics');
    const viewInbox = document.getElementById('view-inbox');
    const viewAudit = document.getElementById('view-audit');

    if (viewMetrics) {
        if (viewId === 'metrics') {
            viewMetrics.classList.remove('hidden');
            viewMetrics.style.display = 'block';
        } else {
            viewMetrics.classList.add('hidden');
            viewMetrics.style.display = 'none';
        }
    }
    if (viewInbox) {
        if (viewId === 'inbox') {
            viewInbox.classList.remove('hidden');
            viewInbox.style.display = 'block';
        } else {
            viewInbox.classList.add('hidden');
            viewInbox.style.display = 'none';
        }
    }
    if (viewAudit) {
        if (viewId === 'audit') {
            viewAudit.classList.remove('hidden');
            viewAudit.style.display = 'block';
        } else {
            viewAudit.classList.add('hidden');
            viewAudit.style.display = 'none';
        }
    }

    // Resaltado de botones en el sidebar
    ['metrics', 'inbox', 'audit'].forEach(v => {
        const btn = document.getElementById(`nav-view-${v}`);
        if (btn) {
            if (v === viewId) {
                btn.classList.add('sidebar-nav-active');
                btn.classList.remove('text-gray-700', 'dark:text-gray-300');
            } else {
                btn.classList.remove('sidebar-nav-active');
                btn.classList.add('text-gray-700', 'dark:text-gray-300');
            }
        }
    });

    // Actualizar breadcrumb
    const bcView = document.getElementById('breadcrumb-view-name');
    if (bcView) {
        if (viewId === 'metrics') bcView.innerText = 'Métricas & KPIs';
        else if (viewId === 'inbox') bcView.innerText = 'Bandeja de Correos';
        else if (viewId === 'audit') bcView.innerText = 'Historial y Auditoría';
    }

    // Si ingresa a auditoría, refrescar datos
    if (viewId === 'audit') {
        loadReportsData();
    } else if (viewId === 'inbox') {
        loadInbox();
        loadMailWorkerStatus();
    }

    lucide.createIcons();
}

window.switchDashboardView = switchDashboardView;
