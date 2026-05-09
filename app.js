// ==========================================
// FUNDO BINÁRIO — com toggle on/off
// ==========================================
const canvas = document.getElementById('matrix');
const ctx    = canvas.getContext('2d');

canvas.height = window.innerHeight;
canvas.width  = window.innerWidth;

const letters  = '01';
const fontSize = 14;

let matrixDrops    = [];
let matrixInterval = null;
let matrixActive   = localStorage.getItem('setor_ti_matrix') !== 'off';

function matrixInitDrops() {
    const cols = Math.floor(canvas.width / fontSize);
    matrixDrops = [];
    for (let x = 0; x < cols; x++) matrixDrops[x] = 1;
}

function draw() {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00d4ff';
    ctx.font = fontSize + 'px monospace';
    for (let i = 0; i < matrixDrops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, matrixDrops[i] * fontSize);
        if (matrixDrops[i] * fontSize > canvas.height && Math.random() > 0.975) matrixDrops[i] = 0;
        matrixDrops[i]++;
    }
}

function matrixStart() {
    if (matrixInterval) return;
    canvas.style.opacity = '';
    matrixInitDrops();
    matrixInterval = setInterval(draw, 33);
}

function matrixStop() {
    if (matrixInterval) { clearInterval(matrixInterval); matrixInterval = null; }
    // Fade canvas to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.opacity = '0';
}

function matrixSetState(active, save = true) {
    matrixActive = active;
    if (save) localStorage.setItem('setor_ti_matrix', active ? 'on' : 'off');
    const toggle = document.getElementById('matrixToggle');
    if (toggle) toggle.checked = active;
    active ? matrixStart() : matrixStop();
}

// Init on load
matrixInitDrops();
if (matrixActive) {
    matrixInterval = setInterval(draw, 33);
} else {
    canvas.style.opacity = '0';
}

window.addEventListener('resize', () => {
    canvas.height = window.innerHeight;
    canvas.width  = window.innerWidth;
    matrixInitDrops();
});



// ==========================================
// SETOR DE TI - FRONTEND (API VERSION)
// Conectado ao backend MySQL via Railway
// ==========================================

const AppState = {
    inventory: [],
    snippets: [],
    services: [],
    solicitacoes: [],
    inventoryActivities: [],
    servicesActivities: [],
    settings: { theme: 'dark' },
    authToken: null,
    currentUser: null   // { id, usuario, nome }
};

// ==========================================
// CLIENTE DE API
// ==========================================
const API = {
    BASE: '', // Mesmo domínio — Railway serve tudo junto

    headers() {
        const h = {
            'Content-Type': 'application/json',
            'x-auth-token': AppState.authToken || ''
        };
        if (AppState.currentUser) {
            h['x-user-id']   = String(AppState.currentUser.id || '');
            h['x-user-nome'] = encodeURIComponent(AppState.currentUser.nome || AppState.currentUser.usuario || '');
        }
        // Debug: log user being sent (remove after confirming works)
        if (AppState.currentUser) {
            console.debug('[API] user header:', AppState.currentUser.nome || AppState.currentUser.usuario, '| id:', AppState.currentUser.id);
        } else {
            console.warn('[API] NO currentUser — headers will not include user info');
        }
        return h;
    },

    async get(path) {
        const res = await fetch(this.BASE + path, { headers: this.headers() });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async post(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async put(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'PUT',
            headers: this.headers(),
            body: JSON.stringify(body)
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async patch(path, body) {
        const res = await fetch(this.BASE + path, {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify(body || {})
        });
        if (!res.ok) throw await res.json();
        return res.json();
    },

    async delete(path) {
        const res = await fetch(this.BASE + path, {
            method: 'DELETE',
            headers: this.headers()
        });
        if (!res.ok) throw await res.json();
        return res.json();
    }
};

// ==========================================
// GERENCIADOR DE LOGIN
// ==========================================
const LoginManager = {
    inactivityTimer: null,
    INACTIVITY_TIMEOUT: 3600000,

    init() {
        this.setupEventListeners();
        this.checkSession();
    },

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('passwordToggle').addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        document.getElementById('loginUser').addEventListener('input', () => this.hideError());
        document.getElementById('loginPassword').addEventListener('input', () => this.hideError());

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },

    checkSession() {
        const token = sessionStorage.getItem('setorTI_token');
        if (token) {
            AppState.authToken = token;
            const savedUser = sessionStorage.getItem('setorTI_user');
            if (savedUser) {
                try { AppState.currentUser = JSON.parse(savedUser); } catch(e) {}
            }
            this.showApp();
        }
    },

    async handleLogin() {
        const user = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPassword').value;

        const btn = document.querySelector('#loginForm button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Entrando...';

        try {
            const data = await API.post('/api/login', { usuario: user, senha: password });
            AppState.authToken = data.token;
            AppState.currentUser = data.user;
            sessionStorage.setItem('setorTI_token', data.token);
            sessionStorage.setItem('setorTI_user', JSON.stringify(data.user));
            this.showApp();
            Toast.show('Login realizado com sucesso!', 'success');
        } catch (err) {
            const msg = err.message || 'Usuário ou senha inválidos!';
            this.showError(msg);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    },

    logout() {
        sessionStorage.removeItem('setorTI_token');
        sessionStorage.removeItem('setorTI_user');
        AppState.authToken = null;
        AppState.currentUser = null;
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginForm').reset();
        this.hideError();
        Toast.show('Logout realizado com sucesso!', 'info');
    },

    resetInactivityTimer() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        this.inactivityTimer = setTimeout(() => {
            Toast.show('Sessão expirada por inatividade!', 'info');
            this.logout();
        }, this.INACTIVITY_TIMEOUT);
    },

    showError(message) {
        const errorEl = document.getElementById('loginError');
        document.getElementById('loginErrorMessage').textContent = message;
        errorEl.classList.add('visible');
        errorEl.style.animation = 'none';
        errorEl.offsetHeight;
        errorEl.style.animation = 'shake 0.3s ease';
    },

    hideError() {
        document.getElementById('loginError').classList.remove('visible');
    },

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('loginPassword');
        const toggleBtn = document.getElementById('passwordToggle');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
            passwordInput.type = 'password';
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        this.resetInactivityTimer();
        this.renderUserAvatar();
        ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, () => this.resetInactivityTimer(), { passive: true });
        });
        this.initializeApp();
    },

    renderUserAvatar() {
        const user = AppState.currentUser;
        if (!user) return;
        const initial = (user.nome || user.usuario || '?').charAt(0).toUpperCase();
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            avatarEl.textContent = initial;
            avatarEl.title = user.nome || user.usuario;
        }
        const userNameEl = document.getElementById('userAvatarName');
        if (userNameEl) {
            userNameEl.textContent = user.nome || user.usuario;
        }
    },

    async initializeApp() {
        try {
            // Carregar configurações do banco
            const config = await API.get('/api/configuracoes');
            if (config.tema) {
                AppState.settings.theme = config.tema;
            }
        } catch (e) { /* usa padrão dark */ }

        const themeToggle = document.getElementById('themeToggle');
        if (AppState.settings.theme === 'light') {
            themeToggle.checked = true;
            document.documentElement.setAttribute('data-theme', 'light');
        }

        themeToggle.addEventListener('change', async () => {
            const tema = themeToggle.checked ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', tema);
            AppState.settings.theme = tema;
            try { await API.put('/api/configuracoes/tema', { valor: tema }); } catch(e) {}
        });

        // Matrix toggle — ligar/desligar animação binária
        const matrixToggleEl = document.getElementById('matrixToggle');
        if (matrixToggleEl) {
            matrixToggleEl.checked = matrixActive;
            matrixToggleEl.addEventListener('change', () => {
                matrixSetState(matrixToggleEl.checked);
            });
        }

        Navigation.init();
        Dashboard.setupQuickActions();
        await Dashboard.update();
        await Inventory.init();
        await Snippets.init();
        await Services.init();
        await Solicitacoes.init();
        await ActivityLogger.renderInventory();
        await ActivityLogger.renderServices();

        console.log('✅ Setor de TI (MySQL) inicializado com sucesso!');
    }
};

// ==========================================
// SISTEMA DE NOTIFICAÇÕES
// ==========================================
const Toast = {
    show(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        toast.innerHTML = '<div class="toast-icon">' + icons[type] + '</div><span class="toast-message">' + message + '</span><button class="toast-close">&times;</button>';
        container.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', () => this.remove(toast));
        setTimeout(() => this.remove(toast), 4000);
    },
    remove(toast) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }
};

// ==========================================
// SISTEMA DE MODAIS
// ==========================================
const Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) { modal.classList.add('visible'); document.body.style.overflow = 'hidden'; }
    },
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) { modal.classList.remove('visible'); document.body.style.overflow = ''; }
    },
    closeAll() {
        document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
            modal.classList.remove('visible');
        });
        document.body.style.overflow = '';
    },
    confirm(title, message, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        const confirmBtn = document.getElementById('confirmAction');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        newBtn.addEventListener('click', () => { this.close('confirmModal'); onConfirm(); });
        this.open('confirmModal');
    }
};

// ==========================================
// LOGGER DE ATIVIDADES
// ==========================================
const ActivityLogger = {
    async renderInventory() {
        const container = document.getElementById('inventoryActivity');
        if (!container) return;
        try {
            const data = await API.get('/api/dashboard');
            const activities = data.recentInventory || [];
            if (activities.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nenhuma atividade recente</p>';
                return;
            }
            const icons = {
                add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
                edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
                delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
                complete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            };
            container.innerHTML = activities.map(a => {
                const time = this.formatTime(a.data_atividade);
                const icon = icons[a.acao] || icons.add;
                const acaoLabels = { add:'Adicionou', edit:'Editou', delete:'Excluiu', complete:'Concluiu' };
                const acaoLabel = acaoLabels[a.acao] || a.acao;
                const userLine = a.usuario_nome
                    ? '<span class="activity-user-line"><span class="activity-action-verb ' + a.acao + '">' + acaoLabel + '</span> <strong>' + a.usuario_nome + '</strong></span>'
                    : '';
                return '<div class="activity-item"><div class="activity-icon ' + a.acao + '">' + icon + '</div><div class="activity-content"><span class="activity-text">' + a.detalhes + '</span>' + userLine + '<span class="activity-time">' + time + '</span></div></div>';
            }).join('');
        } catch (e) { console.error('ActivityLogger.renderInventory error:', e); container.innerHTML = '<p style="color: var(--text-muted)">Erro ao carregar atividades</p>'; }
    },

    async renderServices() {
        const container = document.getElementById('servicesActivity');
        if (!container) return;
        try {
            const data = await API.get('/api/dashboard');
            const activities = data.recentServices || [];
            if (activities.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nenhuma atividade recente</p>';
                return;
            }
            const icons = {
                add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
                edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
                complete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            };
            container.innerHTML = activities.map(a => {
                const time = this.formatTime(a.data_atividade);
                const icon = icons[a.acao] || icons.add;
                const userTag = a.usuario_nome ? '<span class="activity-user">por ' + a.usuario_nome + '</span>' : '';
                let snapshotBtn = '';
                if (a.acao === 'delete' && a.snapshot && typeof a.snapshot === 'object') {
                    const snap = a.snapshot;
                    const snapId = 'snap-' + a.id;
                    const priorityLabels = { baixa:'Baixa', media:'Média', alta:'Alta', urgente:'Urgente' };
                    const statusLabel = snap.status === 'pending' ? 'Pendente' : 'Concluído';
                    snapshotBtn = '<button class="activity-snapshot-btn" onclick="document.getElementById(\'' + snapId + '\').classList.toggle(\' visible\')">Ver dados</button>'
                        + '<div class="activity-snapshot" id="' + snapId + '">'
                        + '<div class="snap-row"><span class="snap-lbl">Título</span><span>' + (snap.titulo||'-') + '</span></div>'
                        + '<div class="snap-row"><span class="snap-lbl">Setor/Cliente</span><span>' + (snap.cliente_setor||'-') + '</span></div>'
                        + '<div class="snap-row"><span class="snap-lbl">Prioridade</span><span>' + (priorityLabels[snap.prioridade]||snap.prioridade||'-') + '</span></div>'
                        + '<div class="snap-row"><span class="snap-lbl">Status</span><span>' + statusLabel + '</span></div>'
                        + '<div class="snap-row"><span class="snap-lbl">Emitido por</span><span>' + (snap.criado_por||'-') + '</span></div>'
                        + '<div class="snap-row full"><span class="snap-lbl">Descrição</span><span>' + (snap.descricao||'-') + '</span></div>'
                        + '<div class="snap-row full"><span class="snap-lbl">Relatório</span><span>' + (snap.relatorio||'-') + '</span></div>'
                        + '</div>';
                }
                const acaoLabelsSvc = { add:'Adicionou', edit:'Editou', delete:'Excluiu', complete:'Concluiu' };
                const acaoLabelSvc = acaoLabelsSvc[a.acao] || a.acao;
                const userLineSvc = a.usuario_nome
                    ? '<span class="activity-user-line"><span class="activity-action-verb ' + a.acao + '">' + acaoLabelSvc + '</span> <strong>' + a.usuario_nome + '</strong></span>'
                    : '';
                return '<div class="activity-item"><div class="activity-icon ' + a.acao + '">' + icon + '</div><div class="activity-content"><span class="activity-text">' + a.detalhes + '</span>' + userLineSvc + '<span class="activity-time">' + time + '</span>' + snapshotBtn + '</div></div>';
            }).join('');
        } catch (e) { console.error('ActivityLogger.renderServices error:', e); container.innerHTML = '<p style="color: var(--text-muted)">Erro ao carregar atividades</p>'; }
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Agora mesmo';
        if (diff < 3600000) return 'Há ' + Math.floor(diff / 60000) + ' min';
        if (diff < 86400000) return 'Há ' + Math.floor(diff / 3600000) + ' horas';
        return date.toLocaleDateString('pt-BR');
    }
};

// ==========================================
// DASHBOARD
// ==========================================
const Dashboard = {
    async update() {
        try {
            const data = await API.get('/api/dashboard');
            const s = data.summary || {};
            document.getElementById('totalItems').textContent = s.total_itens_estoque || 0;
            document.getElementById('totalSnippets').textContent = s.total_snippets || 0;
            const pending = s.servicos_pendentes || 0;
            const lowStock = s.itens_estoque_baixo || 0;
            document.getElementById('pendingServices').textContent = pending;
            document.getElementById('lowStockItems').textContent = lowStock;
            document.getElementById('inventoryBadge').textContent = lowStock;
            document.getElementById('inventoryBadge').style.display = lowStock > 0 ? 'inline' : 'none';
            document.getElementById('servicesBadge').textContent = pending;
            document.getElementById('servicesBadge').style.display = pending > 0 ? 'inline' : 'none';
            const solNovas = s.solicitacoes_novas || 0;
            const solBadge = document.getElementById('solicitacoesBadge');
            if (solBadge) {
                solBadge.textContent = solNovas;
                solBadge.style.display = solNovas > 0 ? 'inline' : 'none';
            }
        } catch (e) {
            console.error('Erro ao atualizar dashboard:', e);
        }
    },

    setupQuickActions() {
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'add-item') Inventory.openAddModal();
                else if (action === 'add-snippet') Snippets.openAddModal();
                else if (action === 'add-service') Services.openAddModal();
                else if (action === 'export-data') this.exportData();
            });
        });
    },

    async exportData() {
        try {
            const [inventory, snippets, services] = await Promise.all([
                API.get('/api/estoque'),
                API.get('/api/snippets'),
                API.get('/api/servicos')
            ]);
            const dataStr = JSON.stringify({ inventory, snippets, services }, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'setor-ti-backup-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            Toast.show('Dados exportados com sucesso!', 'success');
        } catch (e) {
            Toast.show('Erro ao exportar dados!', 'error');
        }
    }
};

// ==========================================
// GERENCIADOR DE ESTOQUE
// ==========================================
const Inventory = {
    async init() {
        this.setupEventListeners();
        await this.render();
    },

    setupEventListeners() {
        document.getElementById('addItemBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('addFirstItemBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('itemForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveItem(); });
        document.getElementById('inventorySearch').addEventListener('input', (e) => this.render(e.target.value));
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.render(document.getElementById('inventorySearch').value, e.target.value);
        });
    },

    openAddModal() {
        document.getElementById('itemModalTitle').textContent = 'Adicionar Item';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('itemQuantity').value = '1';
        document.getElementById('itemMinStock').value = '5';
        Modal.open('itemModal');
    },

    openEditModal(id) {
        const item = AppState.inventory.find(i => String(i.id) === String(id));
        if (!item) return;
        document.getElementById('itemModalTitle').textContent = 'Editar Item';
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.nome;
        document.getElementById('itemCategory').value = item.categoria;
        document.getElementById('itemQuantity').value = item.quantidade;
        document.getElementById('itemMinStock').value = item.estoque_minimo || 5;
        document.getElementById('itemLocation').value = item.localizacao || '';
        document.getElementById('itemDescription').value = item.descricao || '';
        Modal.open('itemModal');
    },

    async saveItem() {
        const id = document.getElementById('itemId').value;
        const itemData = {
            nome: document.getElementById('itemName').value.trim(),
            categoria: document.getElementById('itemCategory').value,
            quantidade: parseInt(document.getElementById('itemQuantity').value) || 0,
            estoque_minimo: parseInt(document.getElementById('itemMinStock').value) || 5,
            localizacao: document.getElementById('itemLocation').value.trim(),
            descricao: document.getElementById('itemDescription').value.trim()
        };

        if (!itemData.nome || !itemData.categoria) {
            Toast.show('Preencha os campos obrigatórios!', 'error');
            return;
        }

        try {
            if (id) {
                await API.put('/api/estoque/' + id, itemData);
                Toast.show('Item atualizado com sucesso!', 'success');
            } else {
                await API.post('/api/estoque', itemData);
                Toast.show('Item adicionado com sucesso!', 'success');
            }
            Modal.close('itemModal');
            await this.render();
            await Dashboard.update();
            await ActivityLogger.renderInventory();
        } catch (e) {
            Toast.show('Erro ao salvar item!', 'error');
        }
    },

    deleteItem(id) {
        const item = AppState.inventory.find(i => String(i.id) === String(id));
        if (!item) return;
        Modal.confirm('Excluir Item', 'Tem certeza que deseja excluir "' + item.nome + '"?', async () => {
            try {
                await API.delete('/api/estoque/' + id);
                Toast.show('Item excluído com sucesso!', 'success');
                await this.render();
                await Dashboard.update();
                await ActivityLogger.renderInventory();
            } catch (e) {
                Toast.show('Erro ao excluir item!', 'error');
            }
        });
    },

    getStockStatus(item) {
        const qty = parseInt(item.quantidade) || 0;
        const min = parseInt(item.estoque_minimo) || 5;
        if (qty === 0) return { class: 'out', text: 'Esgotado' };
        if (qty <= min) return { class: 'low', text: 'Baixo (' + qty + ')' };
        return { class: 'ok', text: 'OK' };
    },

    getCategoryLabel(category) {
        const labels = { hardware: 'Hardware', software: 'Software', perifericos: 'Periféricos', cabos: 'Cabos', rede: 'Rede', outros: 'Outros' };
        return labels[category] || category;
    },

    async render(searchTerm = '', categoryFilter = '') {
        try {
            AppState.inventory = await API.get('/api/estoque');
        } catch (e) { AppState.inventory = []; }

        const tbody = document.getElementById('inventoryBody');
        const emptyState = document.getElementById('inventoryEmpty');
        const table = document.getElementById('inventoryTable');

        let items = [...AppState.inventory];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item =>
                (item.nome || '').toLowerCase().includes(term) ||
                (item.descricao || '').toLowerCase().includes(term) ||
                (item.localizacao || '').toLowerCase().includes(term)
            );
        }
        if (categoryFilter) items = items.filter(item => item.categoria === categoryFilter);

        if (items.length === 0) {
            table.style.display = 'none';
            emptyState.classList.add('visible');
        } else {
            table.style.display = 'table';
            emptyState.classList.remove('visible');
            tbody.innerHTML = items.map(item => {
                const status = this.getStockStatus(item);
                return '<tr><td><strong>' + this.escapeHtml(item.nome) + '</strong>' + (item.descricao ? '<br><small style="color: var(--text-muted)">' + this.escapeHtml((item.descricao || '').substring(0, 50)) + '...</small>' : '') + '</td><td><span class="snippet-tag">' + this.getCategoryLabel(item.categoria) + '</span></td><td>' + item.quantidade + '</td><td>' + (item.localizacao || '-') + '</td><td><span class="stock-status ' + status.class + '">' + status.text + '</span></td><td><div class="action-buttons"><button class="btn btn-sm btn-secondary btn-icon" onclick="Inventory.openEditModal(\'' + item.id + '\')" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-sm btn-danger btn-icon" onclick="Inventory.deleteItem(\'' + item.id + '\')" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></td></tr>';
            }).join('');
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
};

// ==========================================
// GERENCIADOR DE SNIPPETS
// ==========================================
const Snippets = {
    currentViewSnippet: null,

    async init() {
        this.setupEventListeners();
        await this.render();
    },

    setupEventListeners() {
        document.getElementById('addSnippetBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('addFirstSnippetBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('snippetForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveSnippet(); });
        document.getElementById('snippetsSearch').addEventListener('input', (e) => this.render(e.target.value));
        document.getElementById('snippetCategoryFilter').addEventListener('change', () => {
            this.render(document.getElementById('snippetsSearch').value, document.getElementById('snippetCategoryFilter').value, document.getElementById('snippetTypeFilter').value);
        });
        document.getElementById('snippetTypeFilter').addEventListener('change', () => {
            this.render(document.getElementById('snippetsSearch').value, document.getElementById('snippetCategoryFilter').value, document.getElementById('snippetTypeFilter').value);
        });
        document.getElementById('copyCodeBtn').addEventListener('click', () => {
            if (this.currentViewSnippet) {
                navigator.clipboard.writeText(this.currentViewSnippet.codigo).then(() => Toast.show('Código copiado!', 'success'));
            }
        });
    },

    openAddModal() {
        document.getElementById('snippetModalTitle').textContent = 'Adicionar Código';
        document.getElementById('snippetForm').reset();
        document.getElementById('snippetId').value = '';
        Modal.open('snippetModal');
    },

    openEditModal(id) {
        const snippet = AppState.snippets.find(s => String(s.id) === String(id));
        if (!snippet) return;
        document.getElementById('snippetModalTitle').textContent = 'Editar Código';
        document.getElementById('snippetId').value = snippet.id;
        document.getElementById('snippetTitle').value = snippet.titulo;
        document.getElementById('snippetCategory').value = snippet.categoria;
        document.getElementById('snippetType').value = snippet.tipo;
        document.getElementById('snippetTags').value = snippet.tags || '';
        document.getElementById('snippetDescription').value = snippet.descricao || '';
        document.getElementById('snippetCode').value = snippet.codigo;
        Modal.open('snippetModal');
    },

    viewSnippet(id) {
        const snippet = AppState.snippets.find(s => String(s.id) === String(id));
        if (!snippet) return;
        this.currentViewSnippet = snippet;
        document.getElementById('viewSnippetTitle').textContent = snippet.titulo;
        document.getElementById('viewSnippetType').textContent = snippet.tipo.toUpperCase();
        document.getElementById('viewSnippetCode').textContent = snippet.codigo;
        const categoryLabels = { sistema: 'Sistema', impressora: 'Impressora', rede: 'Rede' };
        const tags = snippet.tags ? snippet.tags.split(',').map(t => '<span class="snippet-tag">' + t.trim() + '</span>').join('') : '';
        document.getElementById('viewSnippetMeta').innerHTML = '<span class="snippet-type-badge ' + snippet.tipo + '">' + snippet.tipo.toUpperCase() + '</span><span class="snippet-tag">' + (categoryLabels[snippet.categoria] || snippet.categoria) + '</span>' + tags;
        Modal.open('viewSnippetModal');
    },

    async saveSnippet() {
        const id = document.getElementById('snippetId').value;
        const snippetData = {
            titulo: document.getElementById('snippetTitle').value.trim(),
            categoria: document.getElementById('snippetCategory').value,
            tipo: document.getElementById('snippetType').value,
            tags: document.getElementById('snippetTags').value.trim(),
            descricao: document.getElementById('snippetDescription').value.trim(),
            codigo: document.getElementById('snippetCode').value
        };

        if (!snippetData.titulo || !snippetData.categoria || !snippetData.tipo || !snippetData.codigo) {
            Toast.show('Preencha os campos obrigatórios!', 'error');
            return;
        }

        try {
            if (id) {
                await API.put('/api/snippets/' + id, snippetData);
                Toast.show('Código atualizado com sucesso!', 'success');
            } else {
                await API.post('/api/snippets', snippetData);
                Toast.show('Código adicionado com sucesso!', 'success');
            }
            Modal.close('snippetModal');
            await this.render();
            await Dashboard.update();
        } catch (e) {
            Toast.show('Erro ao salvar código!', 'error');
        }
    },

    deleteSnippet(id) {
        const snippet = AppState.snippets.find(s => String(s.id) === String(id));
        if (!snippet) return;
        Modal.confirm('Excluir Código', 'Tem certeza que deseja excluir "' + snippet.titulo + '"?', async () => {
            try {
                await API.delete('/api/snippets/' + id);
                Toast.show('Código excluído com sucesso!', 'success');
                await this.render();
                await Dashboard.update();
            } catch (e) {
                Toast.show('Erro ao excluir código!', 'error');
            }
        });
    },

    async render(searchTerm = '', categoryFilter = '', typeFilter = '') {
        try {
            AppState.snippets = await API.get('/api/snippets');
        } catch (e) { AppState.snippets = []; }

        const grid = document.getElementById('snippetsGrid');
        const emptyState = document.getElementById('snippetsEmpty');

        let snippets = [...AppState.snippets];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            snippets = snippets.filter(s =>
                (s.titulo || '').toLowerCase().includes(term) ||
                (s.descricao || '').toLowerCase().includes(term) ||
                (s.tags || '').toLowerCase().includes(term) ||
                (s.codigo || '').toLowerCase().includes(term)
            );
        }
        if (categoryFilter) snippets = snippets.filter(s => s.categoria === categoryFilter);
        if (typeFilter) snippets = snippets.filter(s => s.tipo === typeFilter);

        if (snippets.length === 0) {
            grid.style.display = 'none';
            emptyState.classList.add('visible');
        } else {
            grid.style.display = 'grid';
            emptyState.classList.remove('visible');
            const categoryLabels = { sistema: 'Sistema', impressora: 'Impressora', rede: 'Rede' };
            grid.innerHTML = snippets.map(snippet => {
                const tags = snippet.tags ? snippet.tags.split(',').map(t => '<span class="snippet-tag">' + t.trim() + '</span>').join('') : '';
                return '<div class="snippet-card" onclick="Snippets.viewSnippet(\'' + snippet.id + '\')"><div class="snippet-card-header"><h4 class="snippet-title">' + Inventory.escapeHtml(snippet.titulo) + '</h4><span class="snippet-type-badge ' + snippet.tipo + '">' + snippet.tipo.toUpperCase() + '</span></div><p class="snippet-description">' + Inventory.escapeHtml(snippet.descricao || '') + '</p><div class="snippet-tags"><span class="snippet-tag">' + (categoryLabels[snippet.categoria] || snippet.categoria) + '</span>' + tags + '</div><pre class="snippet-preview">' + Inventory.escapeHtml((snippet.codigo || '').substring(0, 100)) + '</pre></div>';
            }).join('');
        }
    }
};

// ==========================================
// GERENCIADOR DE SERVIÇOS
// ==========================================
const Services = {
    currentViewService: null,

    async init() {
        this.setupEventListeners();
        await this.render();
    },

    setupEventListeners() {
        document.getElementById('addServiceBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('addFirstServiceBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('serviceForm').addEventListener('submit', (e) => { e.preventDefault(); this.saveService(); });
        document.getElementById('servicesSearch').addEventListener('input', (e) => this.render(e.target.value));
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.render(document.getElementById('servicesSearch').value, e.target.value);
        });

        // Proteger prefixo O.S. na descrição contra edição
        document.getElementById('serviceDescription').addEventListener('input', function() {
            const prefix = this.getAttribute('data-os-prefix');
            if (prefix && !this.value.startsWith(prefix)) {
                // Restaurar prefixo se o usuário tentou deletar
                const cur = this.selectionStart;
                this.value = prefix + this.value.replace(/^\[O\.S\.[^\]]*\] ?/, '');
                const newPos = Math.max(prefix.length, cur);
                this.setSelectionRange(newPos, newPos);
            }
        });
        document.getElementById('serviceDescription').addEventListener('keydown', function(e) {
            const prefix = this.getAttribute('data-os-prefix');
            if (!prefix) return;
            const sel = this.selectionStart;
            // Bloquear backspace/delete dentro do prefixo
            if ((e.key === 'Backspace' && sel <= prefix.length) ||
                (e.key === 'Delete'    && sel < prefix.length)) {
                e.preventDefault();
            }
            // Bloquear posicionamento do cursor antes do prefixo
            if (sel < prefix.length && !['ArrowRight','ArrowDown','End','Tab'].includes(e.key)) {
                setTimeout(() => this.setSelectionRange(prefix.length, prefix.length), 0);
            }
        });
        document.getElementById('serviceDescription').addEventListener('click', function() {
            const prefix = this.getAttribute('data-os-prefix');
            if (prefix && this.selectionStart < prefix.length) {
                this.setSelectionRange(prefix.length, prefix.length);
            }
        });
    },

    openAddModal() {
        document.getElementById('serviceModalTitle').textContent = 'Novo Serviço';
        document.getElementById('serviceForm').reset();
        document.getElementById('serviceId').value = '';
        // Gerar O.S. automática para novo serviço
        const os = Services._gerarOS();
        const prefix = '[O.S. ' + os + '] ';
        Services._currentOsPrefix = prefix;
        const badge = document.getElementById('osDescBadge');
        if (badge) badge.textContent = 'O.S. ' + os;
        const descEl = document.getElementById('serviceDescription');
        descEl.value = prefix;
        descEl.setAttribute('data-os-prefix', prefix);
        // Posicionar cursor após o prefixo
        setTimeout(() => {
            descEl.focus();
            descEl.setSelectionRange(prefix.length, prefix.length);
        }, 100);
        Modal.open('serviceModal');
    },

    _gerarOS() {
        const ano  = new Date().getFullYear();
        const seq  = String(Date.now()).slice(-6);
        return seq + '/' + ano;
    },

    openEditModal(id) {
        const service = AppState.services.find(s => String(s.id) === String(id));
        if (!service) return;

        const curId  = AppState.currentUser && AppState.currentUser.id;
        const isDono = !service.usuario_id || String(service.usuario_id) === String(curId);

        document.getElementById('serviceModalTitle').textContent = isDono ? 'Editar Serviço' : 'Adicionar Relatório';
        document.getElementById('serviceId').value = service.id;

        // Campos bloqueados para não-donos
        const lockedFields = ['serviceTitle','serviceClient','servicePriority','serviceDate'];
        lockedFields.forEach(fId => {
            const el = document.getElementById(fId);
            if (!el) return;
            if (isDono) {
                el.removeAttribute('disabled');
                el.removeAttribute('readonly');
                el.style.opacity = '';
                el.style.cursor  = '';
            } else {
                el.setAttribute('disabled', 'true');
                el.style.opacity = '0.55';
                el.style.cursor  = 'not-allowed';
            }
        });

        document.getElementById('serviceTitle').value    = service.titulo;
        document.getElementById('serviceClient').value   = service.cliente_setor || '';
        document.getElementById('servicePriority').value = service.prioridade || 'media';
        document.getElementById('serviceDate').value     = service.data_servico ? service.data_servico.split('T')[0] : '';

        // O.S. badge na descrição
        const rawDesc = service.descricao || '';
        const osMatch = rawDesc.match(/^\[O\.S\. ([^\]]+)\] ?/);
        const badge   = document.getElementById('osDescBadge');
        if (osMatch) {
            const prefix = osMatch[0];
            Services._currentOsPrefix = prefix;
            if (badge) badge.textContent = 'O.S. ' + osMatch[1];
            document.getElementById('serviceDescription').value = rawDesc;
            document.getElementById('serviceDescription').setAttribute('data-os-prefix', prefix);
        } else {
            const os     = Services._gerarOS();
            const prefix = '[O.S. ' + os + '] ';
            Services._currentOsPrefix = prefix;
            if (badge) badge.textContent = 'O.S. ' + os;
            document.getElementById('serviceDescription').value = prefix + rawDesc;
            document.getElementById('serviceDescription').setAttribute('data-os-prefix', prefix);
        }

        // Descrição: bloqueada para não-donos (além do guard de O.S.)
        const descEl = document.getElementById('serviceDescription');
        if (!isDono) {
            descEl.setAttribute('disabled', 'true');
            descEl.style.opacity = '0.55';
            descEl.style.cursor  = 'not-allowed';
        } else {
            descEl.removeAttribute('disabled');
            descEl.style.opacity = '';
            descEl.style.cursor  = '';
        }

        // Relatório
        const reportEl = document.getElementById('serviceReport');
        const reportExistingEl = document.getElementById('serviceReportExisting');
        const reportAddBox     = document.getElementById('serviceReportAddBox');
        const reportAddEl      = document.getElementById('serviceReportAdd');

        if (isDono) {
            // Dono: campo único editável normalmente
            reportEl.removeAttribute('disabled');
            reportEl.style.opacity = '';
            reportEl.style.cursor  = '';
            reportEl.value = service.relatorio || '';
            if (reportAddBox) reportAddBox.style.display = 'none';
            document.getElementById('serviceReportGroup').style.display = 'block';
        } else {
            // Não-dono: exibir conteúdo existente em readonly + caixa de adição
            document.getElementById('serviceReportGroup').style.display = 'none';
            if (reportAddBox) {
                reportAddBox.style.display = 'block';
                // Conteúdo atual (readonly)
                if (reportExistingEl) {
                    reportExistingEl.textContent = service.relatorio || 'Nenhum relatório registrado ainda.';
                }
                // Limpar caixa de adição
                if (reportAddEl) reportAddEl.value = '';
                // Guardar relatorio atual para concatenar no save
                reportAddBox.setAttribute('data-existing', service.relatorio || '');
            }
        }

        // Aviso visual para não-donos
        const hint = document.getElementById('serviceEditHint');
        if (hint) hint.style.display = isDono ? 'none' : 'flex';

        Modal.open('serviceModal');
    },

    viewService(id) {
        const service = AppState.services.find(s => String(s.id) === String(id));
        if (!service) return;
        this.currentViewService = service;
        document.getElementById('viewServiceTitle').textContent = service.titulo;
        const statusLabel = service.status === 'pending' ? 'Pendente' : 'Concluído';
        const priorityLabels = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
        document.getElementById('viewServiceMeta').innerHTML = '<span class="service-status-badge ' + service.status + '">' + statusLabel + '</span><span class="service-priority ' + service.prioridade + '">' + (priorityLabels[service.prioridade] || service.prioridade) + '</span>' + (service.cliente_setor ? '<span>' + Inventory.escapeHtml(service.cliente_setor) + '</span>' : '') + (service.data_servico ? '<span>' + new Date(service.data_servico).toLocaleDateString('pt-BR') + '</span>' : '');
        document.getElementById('viewServiceDescription').textContent = service.descricao;
        document.getElementById('viewServiceReport').textContent = service.relatorio || 'Nenhum relatório registrado.';
        const authEl = document.getElementById('viewServiceAuthorship');
        if (authEl) {
            let authHtml = '';
            if (service.criado_por)   authHtml += '<span class="service-auth-tag auth-criado">✦ Criado por: '    + Inventory.escapeHtml(service.criado_por)   + '</span>';
            if (service.modificado_por) authHtml += '<span class="service-auth-tag auth-editado">✎ Editado por: ' + Inventory.escapeHtml(service.modificado_por) + '</span>';
            if (service.concluido_por)  authHtml += '<span class="service-auth-tag auth-concluido">✔ Concluído por: ' + Inventory.escapeHtml(service.concluido_por) + '</span>';
            authEl.innerHTML = authHtml;
            authEl.style.display = authHtml ? 'flex' : 'none';
        }
        // Botão Editar: todos podem abrir (não-donos verão campos bloqueados)
        const curIdView    = AppState.currentUser && AppState.currentUser.id;
        const isOwnerView  = !service.usuario_id || String(service.usuario_id) === String(curIdView);
        const editFromViewBtn = document.getElementById('editFromViewBtn');
        if (editFromViewBtn) {
            editFromViewBtn.style.display = 'inline-flex';
            editFromViewBtn.textContent   = isOwnerView ? 'Editar' : 'Adicionar Relatório';
            const svcId = service.id;
            editFromViewBtn.onclick = () => { Modal.close('viewServiceModal'); Services.openEditModal(svcId); };
        }
        // Botão Concluir no modal de visualização
        const concludeViewBtn = document.getElementById('concludeFromViewBtn');
        if (concludeViewBtn) {
            concludeViewBtn.style.display = service.status === 'pending' ? 'inline-flex' : 'none';
            concludeViewBtn.onclick = () => { Modal.close('viewServiceModal'); Services.completeService(service.id); };
        }
        Modal.open('viewServiceModal');
    },

    async saveService() {
        const id = document.getElementById('serviceId').value;
        const serviceData = {
            titulo: document.getElementById('serviceTitle').value.trim(),
            cliente_setor: document.getElementById('serviceClient').value.trim(),
            prioridade: document.getElementById('servicePriority').value,
            data_servico: document.getElementById('serviceDate').value || null,
            descricao: (() => {
                const el    = document.getElementById('serviceDescription');
                const val   = el.value;
                const pfx   = el.getAttribute('data-os-prefix') || '';
                // Garantir que o prefixo O.S. nunca foi removido pelo usuário
                return pfx && !val.startsWith(pfx) ? pfx + val.replace(/^\[O\.S\.[^\]]*\] ?/, '') : val;
            })().trim(),
            relatorio: (() => {
                const isDono2 = (() => {
                    const svc = AppState.services.find(s => String(s.id) === String(document.getElementById('serviceId').value));
                    if (!svc) return true;
                    const cId = AppState.currentUser && AppState.currentUser.id;
                    return !svc.usuario_id || String(svc.usuario_id) === String(cId);
                })();
                if (isDono2) {
                    return document.getElementById('serviceReport').value.trim();
                } else {
                    // Não-dono: concatenar novo texto ao existente
                    const addBox  = document.getElementById('serviceReportAddBox');
                    const addEl   = document.getElementById('serviceReportAdd');
                    const existing = (addBox && addBox.getAttribute('data-existing')) || '';
                    const newText  = addEl ? addEl.value.trim() : '';
                    if (!newText) return existing;
                    const user = AppState.currentUser ? (AppState.currentUser.nome || AppState.currentUser.usuario) : 'Usuário';
                    const now  = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                    const sep  = '\n\n─── ' + user + ' · ' + now + ' ───\n';
                    return existing ? existing + sep + newText : newText;
                }
            })()
        };

        const svcForVal = AppState.services.find(s => String(s.id) === String(id));
        const isDonoVal = !id || !svcForVal || !svcForVal.usuario_id ||
            String(svcForVal.usuario_id) === String(AppState.currentUser && AppState.currentUser.id);
        if (isDonoVal && (!serviceData.titulo || !serviceData.descricao)) {
            Toast.show('Preencha os campos obrigatórios!', 'error');
            return;
        }
        if (!isDonoVal) {
            const addEl = document.getElementById('serviceReportAdd');
            if (!addEl || !addEl.value.trim()) {
                Toast.show('Escreva algo no campo de adição ao relatório!', 'error');
                return;
            }
        }

        try {
            if (id) {
                await API.put('/api/servicos/' + id, serviceData);
                Toast.show('Serviço atualizado com sucesso!', 'success');
            } else {
                await API.post('/api/servicos', serviceData);
                Toast.show('Serviço adicionado com sucesso!', 'success');
            }
            Modal.close('serviceModal');
            await this.render();
            await Dashboard.update();
            await ActivityLogger.renderServices();
        } catch (e) {
            const msg = (e && e.error) ? e.error : 'Erro ao salvar serviço!';
            Toast.show(msg, 'error');
        }
    },

    async completeService(id) {
        try {
            await API.patch('/api/servicos/' + id + '/concluir');
            Toast.show('Serviço concluído com sucesso!', 'success');
            await this.render();
            await Dashboard.update();
            await ActivityLogger.renderServices();
        } catch (e) {
            const msg = (e && e.error) ? e.error : 'Erro ao concluir serviço!';
            Toast.show(msg, 'error');
        }
    },

    deleteService(id) {
        const service = AppState.services.find(s => String(s.id) === String(id));
        if (!service) return;
        Modal.confirm('Excluir Serviço', 'Tem certeza que deseja excluir "' + service.titulo + '"?', async () => {
            try {
                await API.delete('/api/servicos/' + id);
                Toast.show('Serviço excluído com sucesso!', 'success');
                await this.render();
                await Dashboard.update();
            } catch (e) {
                Toast.show('Erro ao excluir serviço!', 'error');
            }
        });
    },

    getStatusLabel(status) { return status === 'pending' ? 'Pendente' : 'Concluído'; },

    getPriorityLabel(priority) {
        const labels = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
        return labels[priority] || priority;
    },

    // ==========================================
    // GERADOR DE PDF INDIVIDUAL POR SERVIÇO
    // ==========================================
    async gerarPdfServico(id) {
        const service = AppState.services.find(s => String(s.id) === String(id));
        if (!service) { Toast.show('Serviço não encontrado!', 'error'); return; }
        try {
            const brasao = await Reports.loadBrasao();
            const today = new Date().toLocaleDateString('pt-BR');
            const dataSolic = service.data_servico   ? new Date(service.data_servico).toLocaleDateString('pt-BR')   : '-';
            const dataConc  = service.data_conclusao ? new Date(service.data_conclusao).toLocaleDateString('pt-BR') : '-';
            const statusLabel = service.status === 'pending' ? 'Pendente' : 'Concluído';
            const statusColor = service.status === 'pending' ? '#d97706' : '#059669';
            const priorityLabels = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };
            const priorityColors = { baixa: '#059669', media: '#0ea5e9', alta: '#d97706', urgente: '#dc2626' };
            const prioridade = service.prioridade || 'media';
            const headerHtml = await Reports._buildPdfHeader(brasao);

            const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #222; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a2744; color: #fff; padding: 10px 12px; font-size: 13px; text-align: left; }
        td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
        .sec-title { background: #1a2744; color: #fff; font-weight: 700; font-size: 12px;
                     padding: 7px 12px; letter-spacing: 0.5px; margin-top: 18px; }
        .text-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;
                      padding: 12px 14px; font-size: 13px; line-height: 1.75; white-space: pre-wrap;
                      word-break: break-word; color: #333; margin: 0; }
        .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
               color: #888; display: block; margin-bottom: 2px; }
        .val { font-size: 13px; color: #222; font-weight: 600; }
    </style>
</head>
<body>
    ${headerHtml}

    <div style="display:flex;justify-content:space-between;margin-bottom:18px;align-items:flex-end;">
        <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório de Serviço</h2>
        <div style="text-align:right;">
            <span style="font-size:12px;color:#1a2744;font-weight:700;display:block;">Protocolo Nº ${Reports._gerarProtocolo()}</span>
            <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
            ${AppState.currentUser ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${AppState.currentUser.nome || AppState.currentUser.usuario}</span>` : ''}
            ${service.concluido_por ? `<span style="font-size:11px;color:#777;display:block;">Concluído por: ${Inventory.escapeHtml(service.concluido_por)}</span>` : ''}
        </div>
    </div>

    <!-- Tabela de metadados -->
    <table>
        <thead>
            <tr>
                <th>Título do Serviço</th>
                <th style="width:130px;">Setor / Cliente</th>
                <th style="width:110px;">Data de Solicitação</th>
                <th style="width:110px;">Data de Conclusão</th>
                <th style="width:90px;">Status</th>
                <th style="width:90px;">Prioridade</th>
            </tr>
        </thead>
        <tbody>
            <tr style="background:#f9fafb;">
                <td style="font-weight:700;font-size:14px;">${Inventory.escapeHtml(service.titulo)}</td>
                <td>${Inventory.escapeHtml(service.cliente_setor || '-')}</td>
                <td style="white-space:nowrap;">${dataSolic}</td>
                <td style="white-space:nowrap;">${dataConc}</td>
                <td><span style="color:${statusColor};font-weight:700;">${statusLabel}</span></td>
                <td><span style="color:${priorityColors[prioridade]};font-weight:700;">${priorityLabels[prioridade] || prioridade}</span></td>
            </tr>
        </tbody>
    </table>

    <!-- Descrição -->
    <div class="sec-title">Descrição do Serviço</div>
    <div class="text-block">${Inventory.escapeHtml(service.descricao || 'Nenhuma descrição registrada.')}</div>

    <!-- Relatório -->
    <div class="sec-title">Relatório de Atividades Realizadas</div>
    <div class="text-block">${Inventory.escapeHtml(service.relatorio || 'Nenhum relatório registrado.')}</div>

    ${Reports._buildPdfFooter()}
</body>
</html>`;

            Reports._printHtml(html, 'Servico_' + (service.titulo || 'sem_titulo').replace(/\s+/g, '_').substring(0, 40));
        } catch (e) {
            Toast.show('Erro ao gerar PDF do serviço!', 'error');
        }
    },

    async render(searchTerm = '', statusFilter = '') {
        try {
            AppState.services = await API.get('/api/servicos');
        } catch (e) { AppState.services = []; }

        const list = document.getElementById('servicesList');
        const emptyState = document.getElementById('servicesEmpty');

        let services = [...AppState.services];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            services = services.filter(service =>
                (service.titulo || '').toLowerCase().includes(term) ||
                (service.descricao || '').toLowerCase().includes(term) ||
                (service.cliente_setor || '').toLowerCase().includes(term) ||
                (service.relatorio || '').toLowerCase().includes(term)
            );
        }
        if (statusFilter) services = services.filter(service => service.status === statusFilter);

        if (services.length === 0) {
            list.style.display = 'none';
            emptyState.classList.add('visible');
        } else {
            list.style.display = 'flex';
            emptyState.classList.remove('visible');
            list.innerHTML = services.map(service => {
                const statusLabel = this.getStatusLabel(service.status);
                const priorityLabel = this.getPriorityLabel(service.prioridade);
                const date = service.data_servico ? new Date(service.data_servico).toLocaleDateString('pt-BR') : '-';
                // Dono = sem usuario_id registrado (legado) OU mesmo id
                const curId = AppState.currentUser && AppState.currentUser.id;
                // Use == (loose equality) — usuario_id may come as string or number
                const isOwnerForActions = !service.usuario_id || String(service.usuario_id) === String(curId);
                let actionsHtml = '<div class="service-card-actions" onclick="event.stopPropagation()">';
                // Editar: todos podem — não-donos só editam relatório
                actionsHtml += '<button class="btn btn-sm btn-secondary" onclick="Services.openEditModal(\'' + service.id + '\')">' + (isOwnerForActions ? 'Editar' : 'Relatório') + '</button>';
                // Concluir: qualquer usuário pode
                if (service.status === 'pending') {
                    actionsHtml += '<button class="btn btn-sm btn-primary" onclick="Services.completeService(\'' + service.id + '\')">Concluir</button>';
                }
                // Excluir: apenas dono
                if (isOwnerForActions) {
                }
                actionsHtml += '<button class="btn btn-sm btn-pdf" onclick="Services.gerarPdfServico(\'' + service.id + '\')" title="Gerar PDF deste serviço">'
                    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:3px;">'
                    + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
                    + '<polyline points="7 10 12 15 17 10"/>'
                    + '<line x1="12" y1="15" x2="12" y2="3"/>'
                    + '</svg>PDF</button>';
                actionsHtml += '</div>';
                const authTags = [
                    service.criado_por   ? '<span class="service-auth-tag auth-criado">✦ Criado por: '    + Inventory.escapeHtml(service.criado_por)   + '</span>' : '',
                    service.modificado_por ? '<span class="service-auth-tag auth-editado">✎ Editado por: ' + Inventory.escapeHtml(service.modificado_por) + '</span>' : '',
                    service.concluido_por  ? '<span class="service-auth-tag auth-concluido">✔ Concluído por: ' + Inventory.escapeHtml(service.concluido_por) + '</span>' : '',
                ].filter(Boolean).join('');
                return '<div class="service-card" onclick="Services.viewService(\'' + service.id + '\')"><div class="service-card-header"><h4 class="service-title">' + Inventory.escapeHtml(service.titulo) + '</h4><span class="service-status-badge ' + service.status + '">' + statusLabel + '</span></div><div class="service-meta">' + (service.cliente_setor ? '<span>' + Inventory.escapeHtml(service.cliente_setor) + '</span>' : '') + '<span class="service-priority ' + service.prioridade + '">' + priorityLabel + '</span><span>' + date + '</span></div><p class="service-description">' + Inventory.escapeHtml(service.descricao) + '</p>' + (authTags ? '<div class="service-authorship">' + authTags + '</div>' : '') + actionsHtml + '</div>';
            }).join('');
        }
    }
};

// ==========================================
// RELATÓRIOS
// ==========================================
const Reports = {
    pedidoItems: [],
    pedidoEditId: null,

    BRASAO_B64: null,

    async loadBrasao() {
        if (this.BRASAO_B64) return this.BRASAO_B64;
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this.BRASAO_B64 = canvas.toDataURL('image/jpeg', 0.9);
                resolve(this.BRASAO_B64);
            };
            img.onerror = () => resolve(null);
            img.src = '/Brasao_japaratuba_se.jpg';
        });
    },

    init() {
        this._bindSubtabs();
        this._bindEstoque();
        this._bindServicos();
        this._bindPedido();
        this._bindSalvos();
    },

    _bindSubtabs() {
        document.querySelectorAll('.report-subtab').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.report-subtab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.report-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('report-panel-' + btn.dataset.report).classList.add('active');
                if (btn.dataset.report === 'salvos') this.renderSalvos();
            };
        });
    },

    _bindEstoque() {
        const btn = document.getElementById('btnGerarEstoque');
        if (btn) btn.onclick = () => this.gerarEstoque();
    },

    _bindServicos() {
        const btn = document.getElementById('btnGerarServicos');
        if (btn) btn.onclick = () => this.gerarServicos();
        const btnFolha = document.getElementById('btnFolhaEmBranco');
        if (btnFolha) btnFolha.onclick = () => this.gerarFolhaEmBranco();
    },

    _bindPedido() {
        const btnAdd   = document.getElementById('btnAdicionarPedido');
        const btnGerar = document.getElementById('btnGerarPedido');
        if (btnAdd)   btnAdd.onclick   = () => this.adicionarItemPedido();
        if (btnGerar) btnGerar.onclick = () => this.gerarPedido();
        const nomeEl = document.getElementById('pedidoNome');
        if (nomeEl) nomeEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.adicionarItemPedido(); } });
    },

    _bindSalvos() {
        const btnLimpar = document.getElementById('btnLimparSalvos');
        if (btnLimpar) btnLimpar.onclick = () => {
            Modal.confirm('Limpar Histórico', 'Deseja remover todos os relatórios salvos?', () => {
                this.savedReports = [];
                this.renderSalvos();
                Toast.show('Histórico limpo!', 'info');
            });
        };
    },

    // ── RELATÓRIOS SALVOS ──
    get savedReports() {
        try { return JSON.parse(localStorage.getItem('setor_ti_salvos') || '[]'); } catch(e) { return []; }
    },
    set savedReports(val) {
        try { localStorage.setItem('setor_ti_salvos', JSON.stringify(val)); } catch(e) {}
    },

    _persistSalvos() {
        // savedReports setter handles persistence automatically
    },

    _salvarRelatorio(tipo, titulo, html) {
        const entry = {
            id:      Date.now(),
            tipo,
            titulo,
            data:    new Date().toLocaleDateString('pt-BR'),
            hora:    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            usuario: AppState.currentUser ? (AppState.currentUser.nome || AppState.currentUser.usuario) : '',
            html
        };
        // Getter retorna cópia nova a cada leitura — ler, modificar e gravar explicitamente
        const lista = this.savedReports;
        lista.unshift(entry);
        if (lista.length > 50) lista.splice(50);
        this.savedReports = lista; // setter grava no localStorage
        Toast.show('Relatório salvo!', 'success');
    },

    renderSalvos() {
        const container = document.getElementById('salvosListContainer');
        if (!container) return;
        if (this.savedReports.length === 0) {
            container.innerHTML = '<div class="report-preview-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>Nenhum relatório salvo ainda</p></div>';
            return;
        }
        const tipoIcons = {
            estoque:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
            servicos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            pedido:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>',
        };
        container.innerHTML = this.savedReports.map(r => `
            <div class="salvos-item">
                <div class="salvos-icon">${tipoIcons[r.tipo] || tipoIcons.servicos}</div>
                <div class="salvos-info">
                    <span class="salvos-titulo">${Inventory.escapeHtml(r.titulo)}</span>
                    <span class="salvos-meta">${r.data} às ${r.hora}${r.usuario ? ' · ' + Inventory.escapeHtml(r.usuario) : ''}</span>
                </div>
                <div class="salvos-actions">
                    <button class="btn btn-sm btn-primary" onclick="Reports.reabrirRelatorio(${r.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Abrir
                    </button>
                    <button class="btn btn-sm btn-danger btn-icon" onclick="Reports.excluirSalvo(${r.id})" title="Remover">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    reabrirRelatorio(id) {
        const r = this.savedReports.find(x => x.id === id);
        if (!r) return;
        this._printHtml(r.html, r.titulo.replace(/\s+/g, '_'));
    },

    excluirSalvo(id) {
        const lista = this.savedReports.filter(x => x.id !== id);
        this.savedReports = lista;
        this.renderSalvos();
    },

    adicionarItemPedido() {
        const nomeEl  = document.getElementById('pedidoNome');
        const qtdEl   = document.getElementById('pedidoQtd');
        const nivelEl = document.getElementById('pedidoNivel');
        const especEl = document.getElementById('pedidoEspec');
        const descEl  = document.getElementById('pedidoDesc');
        if (!nomeEl) { console.error('pedidoNome not found'); return; }
        const nome  = nomeEl.value.trim();
        const qtd   = parseInt(qtdEl ? qtdEl.value : '1') || 1;
        const nivel = nivelEl ? nivelEl.value : 'Média';
        const espec = especEl ? especEl.value.trim() : '';
        const desc  = descEl  ? descEl.value.trim()  : '';
        if (!nome) { Toast.show('Informe o nome do produto!', 'error'); return; }
        this.pedidoItems.push({ id: Date.now(), nome, qtd, nivel, espec, desc });
        nomeEl.value  = '';
        if (qtdEl)   qtdEl.value   = '1';
        if (nivelEl) nivelEl.value = 'Média';
        if (especEl) especEl.value = '';
        if (descEl)  descEl.value  = '';
        this.renderPedidoList();
    },

    renderPedidoList() {
        const list = document.getElementById('pedidoItemsList');
        const badge = document.getElementById('pedidoBadge');
        const btnGerar = document.getElementById('btnGerarPedido');
        badge.textContent = this.pedidoItems.length;
        btnGerar.disabled = this.pedidoItems.length === 0;

        if (this.pedidoItems.length === 0) {
            list.innerHTML = '<div class="report-preview-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><p>Nenhum item adicionado ainda</p></div>';
            return;
        }

        list.innerHTML = this.pedidoItems.map(item => `
            <div class="pedido-item-row" id="pedido-row-${item.id}">
                <div class="pedido-item-row-wrap">
                    <div style="display:flex;align-items:center;gap:0.75rem;flex:1">
                        <span class="pedido-item-name">${Inventory.escapeHtml(item.nome)}</span>
                        <span class="pedido-item-qty">Qtd: ${item.qtd}</span>
                        <span class="pedido-item-nivel ${item.nivel}">${item.nivel}</span>
                        ${item.espec ? `<span class="pedido-item-espec" title="Especificações">${Inventory.escapeHtml(item.espec)}</span>` : ''}
                        ${item.desc  ? `<span class="pedido-item-desc"  title="Descrição">${Inventory.escapeHtml(item.desc)}</span>` : ''}
                        <div class="pedido-item-actions" style="margin-left:auto">
                            <button class="btn btn-sm btn-secondary" onclick="Reports.editarItem(${item.id})">Editar</button>
                            <button class="btn btn-sm btn-danger" onclick="Reports.excluirItem(${item.id})">Excluir</button>
                        </div>
                    </div>
                    <div class="pedido-edit-inline" id="pedido-edit-${item.id}">
                        <input type="text" value="${Inventory.escapeHtml(item.nome)}" id="edit-nome-${item.id}" placeholder="Nome" style="flex:1;min-width:120px">
                        <input type="number" value="${item.qtd}" id="edit-qtd-${item.id}" min="1" style="width:60px">
                        <select id="edit-nivel-${item.id}">
                            ${['Baixa','Média','Alta','Urgente'].map(n => `<option value="${n}"${n===item.nivel?' selected':''}>${n}</option>`).join('')}
                        </select>
                        <input type="text" value="${Inventory.escapeHtml(item.espec||'')}" id="edit-espec-${item.id}" placeholder="Especificações" style="flex:1;min-width:120px">
                        <input type="text" value="${Inventory.escapeHtml(item.desc||'')}"  id="edit-desc-${item.id}"  placeholder="Descrição" style="flex:1;min-width:120px">
                        <button class="btn btn-sm btn-primary" onclick="Reports.salvarEdicao(${item.id})">Salvar</button>
                        <button class="btn btn-sm btn-secondary" onclick="Reports.cancelarEdicao(${item.id})">Cancelar</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    editarItem(id) {
        document.querySelectorAll('.pedido-item-row').forEach(r => r.classList.remove('editing'));
        const row = document.getElementById('pedido-row-' + id);
        if (row) row.classList.add('editing');
    },

    cancelarEdicao(id) {
        const row = document.getElementById('pedido-row-' + id);
        if (row) row.classList.remove('editing');
    },

    salvarEdicao(id) {
        const item = this.pedidoItems.find(i => i.id === id);
        if (!item) return;
        const nome = document.getElementById('edit-nome-' + id).value.trim();
        const qtd = parseInt(document.getElementById('edit-qtd-' + id).value) || 1;
        const nivel = document.getElementById('edit-nivel-' + id).value;
        const espec = document.getElementById('edit-espec-' + id).value.trim();
        const desc  = document.getElementById('edit-desc-' + id) ? document.getElementById('edit-desc-' + id).value.trim() : (item.desc||'');
        if (!nome) { Toast.show('Nome não pode ser vazio!', 'error'); return; }
        item.nome = nome; item.qtd = qtd; item.nivel = nivel; item.espec = espec; item.desc = desc;
        this.renderPedidoList();
    },

    excluirItem(id) {
        this.pedidoItems = this.pedidoItems.filter(i => i.id !== id);
        this.renderPedidoList();
    },

    // ---- PDF GENERATION ----


    _gerarProtocolo() {
        const ano = new Date().getFullYear();
        const ts  = Date.now();
        const seq = String(ts).slice(-6);
        return seq + '/' + ano;
    },

    async _buildPdfHeader(brasao) {
        let headerHtml = '<div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #1a2744;padding-bottom:16px;">';
        if (brasao) {
            headerHtml += `<img src="${brasao}" style="height:90px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto">`;
        }
        headerHtml += '<h1 style="margin:0;font-size:22px;font-weight:700;color:#1a2744;letter-spacing:1px;">SETOR DE TI</h1>';
        headerHtml += '<p style="margin:4px 0 0 0;font-size:12px;color:#555;">Prefeitura Municipal de Japaratuba — Sergipe</p>';
        headerHtml += '</div>';
        return headerHtml;
    },

    _buildPdfFooter() {
        return `
        <div style="margin-top:48px;padding-top:24px;">
            <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;">
                <div style="flex:1;min-width:160px;text-align:center;">
                    <div style="border-top:1px solid #333;padding-top:8px;margin-top:40px;font-size:12px;color:#333;">Assinatura do Responsável</div>
                </div>
                <div style="flex:1;min-width:120px;text-align:center;">
                    <div style="padding-top:8px;margin-top:40px;font-size:12px;color:#333;border:1px solid #ccc;border-radius:4px;padding:8px;">Data: ___/___/______</div>
                </div>
                <div style="flex:1;min-width:160px;text-align:center;">
                    <div style="border-top:1px solid #333;padding-top:8px;margin-top:40px;font-size:12px;color:#333;">Assinatura de Recebido por</div>
                </div>
            </div>
        </div>`;
    },

    async gerarEstoque() {
        try {
            let items = [...AppState.inventory];
            if (items.length === 0) {
                try { items = await API.get('/api/estoque'); } catch(e) { items = []; }
            }
            const brasao = await this.loadBrasao();
            const categorias = ['hardware', 'software', 'perifericos', 'cabos', 'rede', 'outros'];
            const catLabels = { hardware: 'Hardware', software: 'Software', perifericos: 'Periféricos', cabos: 'Cabos', rede: 'Rede', outros: 'Outros' };
            const grouped = {};
            categorias.forEach(c => { grouped[c] = []; });
            items.forEach(item => {
                const cat = (item.categoria || 'outros').toLowerCase();
                if (grouped[cat]) grouped[cat].push(item); else grouped['outros'].push(item);
            });

            let tableRows = '';
            categorias.forEach((cat, catIndex) => {
                if (grouped[cat].length === 0) return;
                if (catIndex > 0 && tableRows !== '') {
                    tableRows += `<tr><td colspan="2" style="padding:6px 0;background:transparent;border:none;"></td></tr>`;
                }
                tableRows += `<tr><td colspan="2" style="background:#1a2744;color:#fff;font-weight:700;font-size:13px;padding:8px 12px;letter-spacing:0.5px;">${catLabels[cat]}</td></tr>`;
                grouped[cat].forEach((item, i) => {
                    const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
                    tableRows += `<tr style="background:${bg}"><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${Inventory.escapeHtml(item.nome)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;width:100px;">${item.quantidade}</td></tr>`;
                });
            });

            const today = new Date().toLocaleDateString('pt-BR');
            const emitidoPorEstoque = AppState.currentUser ? AppState.currentUser.nome || AppState.currentUser.usuario : '';
            const headerHtml = await this._buildPdfHeader(brasao);
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 12px;font-size:13px;text-align:left;}th:last-child{text-align:center;width:100px;}</style></head><body>
            ${headerHtml}
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
                <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório de Estoque</h2>
                <div style="text-align:right;"><span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>${emitidoPorEstoque ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorEstoque}</span>` : ''}</div>
            </div>
            <table>
                <thead><tr><th>Nome do Item</th><th style="text-align:center;">Quantidade</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            ${this._buildPdfFooter()}
            </body></html>`;

            this._printHtml(html, 'Relatorio_Estoque');
            this._salvarRelatorio('estoque', 'Relatório de Estoque — ' + today, html);
        } catch(e) {
            Toast.show('Erro ao gerar relatório!', 'error');
        }
    },

    async gerarServicos() {
        try {
            let services = [...AppState.services];
            if (services.length === 0) {
                try { services = await API.get('/api/servicos'); } catch(e) { services = []; }
            }
            const filterVal = document.getElementById('reportServicosFilter').value;
            if (filterVal) services = services.filter(s => s.status === filterVal);
            const brasao = await this.loadBrasao();
            const today = new Date().toLocaleDateString('pt-BR');
            const emitidoPorServicos = AppState.currentUser ? AppState.currentUser.nome || AppState.currentUser.usuario : '';

            let tableRows = services.map((s, i) => {
                const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
                const dataSolic = s.data_servico ? new Date(s.data_servico).toLocaleDateString('pt-BR') : '-';
                const dataConc  = s.data_conclusao ? new Date(s.data_conclusao).toLocaleDateString('pt-BR') : '-';
                const statusLabel = s.status === 'pending' ? 'Pendente' : 'Concluído';
                const statusColor = s.status === 'pending' ? '#d97706' : '#059669';
                return `<tr style="background:${bg}">
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;">${Inventory.escapeHtml(s.titulo)}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${Inventory.escapeHtml(s.cliente_setor||'-')}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;white-space:nowrap;">${dataSolic}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;white-space:nowrap;">${dataConc}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;"><span style="color:${statusColor};font-weight:700;">${statusLabel}</span></td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${Inventory.escapeHtml(s.descricao||'')}</td>
                </tr>`;
            }).join('');

            if (!tableRows) tableRows = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;font-size:13px;">Nenhum serviço encontrado</td></tr>';

            const headerHtml = await this._buildPdfHeader(brasao);
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 10px;font-size:12px;text-align:left;}</style></head><body>
            ${headerHtml}
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
                <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório de Serviços</h2>
                <div style="text-align:right;"><span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>${emitidoPorServicos ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorServicos}</span>` : ''}</div>
            </div>
            <table>
                <thead><tr><th>Título</th><th>Setor/Cliente</th><th style="width:110px;">Data de Solicitação</th><th style="width:110px;">Data de Conclusão</th><th style="width:90px;">Status</th><th>Descrição</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            ${this._buildPdfFooter()}
            </body></html>`;

            this._printHtml(html, 'Relatorio_Servicos');
            this._salvarRelatorio('servicos', 'Relatório de Serviços — ' + today, html);
        } catch(e) {
            Toast.show('Erro ao gerar relatório!', 'error');
        }
    },

    async gerarPedido() {
        if (this.pedidoItems.length === 0) { Toast.show('Adicione itens ao pedido!', 'error'); return; }
        const brasao = await this.loadBrasao();
        const today = new Date().toLocaleDateString('pt-BR');
        const emitidoPorPedido = AppState.currentUser ? AppState.currentUser.nome || AppState.currentUser.usuario : '';

        const nivelColor = { Baixa: '#059669', Média: '#d97706', Alta: '#ea580c', Urgente: '#dc2626' };

        let tableRows = this.pedidoItems.map((item, i) => {
            const bg = i % 2 === 0 ? '#f9fafb' : '#fff';
            const cor = nivelColor[item.nivel] || '#333';
            return `<tr style="background:${bg}">
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${i+1}</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">${Inventory.escapeHtml(item.nome)}</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#555;">${Inventory.escapeHtml(item.espec||'-')}</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#555;">${Inventory.escapeHtml(item.desc||'-')}</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.qtd}</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;"><span style="color:${cor};font-weight:700;">${item.nivel}</span></td>
            </tr>`;
        }).join('');

        const headerHtml = await this._buildPdfHeader(brasao);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 12px;font-size:13px;text-align:left;}</style></head><body>
        ${headerHtml}
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
            <h2 style="margin:0;font-size:16px;color:#1a2744;">Pedido de Reposição de Estoque</h2>
            <div style="text-align:right;"><span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>${emitidoPorPedido ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorPedido}</span>` : ''}</div>
        </div>
        <table>
            <thead><tr><th style="width:40px;">#</th><th>Nome do Produto</th><th>Especificações</th><th>Descrição</th><th style="width:80px;text-align:center;">Qtd</th><th style="width:110px;text-align:center;">Nível</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
        ${this._buildPdfFooter()}
        </body></html>`;

        this._printHtml(html, 'Pedido_Reposicao');
        this._salvarRelatorio('pedido', 'Pedido de Reposição — ' + today, html);
    },


    async gerarFolhaEmBranco() {
        const brasao   = await this.loadBrasao();
        const today    = new Date().toLocaleDateString('pt-BR');
        const user     = AppState.currentUser ? (AppState.currentUser.nome || AppState.currentUser.usuario) : '';
        const protocolo = this._gerarProtocolo();
        const headerHtml = await this._buildPdfHeader(brasao);

        const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;}
  body{font-family:Arial,sans-serif;margin:36px 40px;color:#222;font-size:13px;}
  .header-sep{border-top:2px solid #1a2744;margin:16px 0 20px;}
  .proto-block{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
  .proto-title{font-size:15px;font-weight:700;color:#1a2744;}
  .proto-info{text-align:right;font-size:11px;color:#555;line-height:1.7;}
  .proto-info strong{color:#1a2744;font-size:12px;}
  table.meta{width:100%;border-collapse:collapse;margin-bottom:14px;}
  table.meta td{border:1px solid #ccc;padding:8px 10px;font-size:11px;text-transform:uppercase;
                letter-spacing:0.4px;color:#555;vertical-align:top;}
  table.meta td .val{display:block;min-height:20px;margin-top:4px;color:#222;text-transform:none;
                     letter-spacing:0;font-size:13px;}
  .sec-box{border:1px solid #ccc;border-radius:3px;margin-bottom:14px;overflow:hidden;}
  .sec-box-label{background:#f3f4f6;border-bottom:1px solid #ccc;padding:6px 10px;
                 font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#555;font-weight:700;}
  .sec-box-lines{padding:10px;}
  .write-line{border-bottom:1px solid #ddd;height:26px;margin-bottom:0;}
  .footer-row{display:flex;justify-content:space-between;gap:16px;margin-top:32px;padding-top:16px;border-top:0px solid #ccc;}
  .footer-cell{flex:1;text-align:center;font-size:11px;color:#444;}
  .footer-cell .sig-line{border-top:1px solid #666;margin-bottom:5px;margin-top:36px;}
  .footer-cell .date-box{border:1px solid #aaa;border-radius:3px;padding:4px 10px;
                         display:inline-block;font-size:12px;letter-spacing:1px;text-align:center;margin-top:15px;}
</style>
</head><body>
${headerHtml}

<div class="proto-block">
  <div class="proto-title">Relatório / Ordem de Serviço</div>
  <div class="proto-info">
    <strong>Protocolo Nº ${protocolo}</strong><br>
    Emitido em: ${today}<br>
    ${user ? 'Emitido por: ' + user : ''}
  </div>
</div>

<table class="meta">
  <tr>
    <td style="width:50%">Setor / Solicitante<span class="val"></span></td>
    <td style="width:28%">Data de Solicitação<span class="val"></span></td>
    <td style="width:22%">Prioridade<span class="val"></span></td>
  </tr>
  <tr>
    <td colspan="3">Título / Assunto<span class="val"></span></td>
  </tr>
</table>

<div class="sec-box">
  <div class="sec-box-label">Descrição do Serviço / Problema Relatado</div>
  <div class="sec-box-lines">
    ${'<div class="write-line"></div>'.repeat(7)}
  </div>
</div>

<div class="sec-box">
  <div class="sec-box-label">Atividades Realizadas</div>
  <div class="sec-box-lines">
    ${'<div class="write-line"></div>'.repeat(7)}
  </div>
</div>

<div class="footer-row">
  <div class="footer-cell"><div class="sig-line"></div>Assinatura do Responsável</div>
  <div class="footer-cell" style="flex:0.6;"><span class="date-box">___/___/______<br>Data</span></div>
  <div class="footer-cell"><div class="sig-line"></div>Assinatura de Recebido por</div>
</div>
</body></html>`;

        this._printHtml(html, 'Folha_Relatorio_' + protocolo.replace('/', '_'));
    },

    _printHtml(html, filename) {
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { Toast.show('Permita popups para gerar o PDF!', 'error'); return; }
        win.document.write(html);
        win.document.close();
        win.onload = () => {
            setTimeout(() => {
                win.print();
            }, 500);
        };
    }
};

// ==========================================
// GERENCIADOR DE SOLICITAÇÕES
// ==========================================
const Solicitacoes = {
    currentId: null,

    async init() {
        this.setupEventListeners();
        await this.render();
    },

    setupEventListeners() {
        document.getElementById('solicitacoesSearch').addEventListener('input', (e) => {
            this.render(e.target.value, document.getElementById('solicitacoesStatusFilter').value);
        });
        document.getElementById('solicitacoesStatusFilter').addEventListener('change', (e) => {
            this.render(document.getElementById('solicitacoesSearch').value, e.target.value);
        });
        document.getElementById('solSalvarBtn').addEventListener('click', () => this.salvarComoServico());
        document.getElementById('solExcluirBtn').addEventListener('click', () => this.excluirSolicitacao());
    },

    async render(searchTerm = '', statusFilter = '') {
        try {
            AppState.solicitacoes = await API.get('/api/solicitacoes');
        } catch (e) { AppState.solicitacoes = []; }

        const list       = document.getElementById('solicitacoesList');
        const emptyState = document.getElementById('solicitacoesEmpty');

        let items = [...AppState.solicitacoes];
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(s =>
                (s.titulo || '').toLowerCase().includes(term) ||
                (s.numero_os || '').toLowerCase().includes(term) ||
                (s.cliente_setor || '').toLowerCase().includes(term) ||
                (s.descricao || '').toLowerCase().includes(term)
            );
        }
        if (statusFilter) items = items.filter(s => s.status === statusFilter);

        const totalNovas = AppState.solicitacoes.filter(s => s.status === 'nova').length;
        const badge = document.getElementById('solicitacoesBadge');
        if (badge) { badge.textContent = totalNovas; badge.style.display = totalNovas > 0 ? 'inline' : 'none'; }

        if (items.length === 0) {
            list.style.display = 'none';
            emptyState.classList.add('visible');
            return;
        }

        list.style.display = 'flex';
        emptyState.classList.remove('visible');

        list.innerHTML = items.map(sol => {
            const isNova  = sol.status === 'nova';
            const data    = sol.data_solicitacao
                ? new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')
                : new Date(sol.data_criacao).toLocaleDateString('pt-BR');
            const statusHtml = isNova
                ? '<span class="sol-status-badge nova">Nova</span>'
                : '<span class="sol-status-badge salva">Convertida</span>';
            const prioHtml = sol.prioridade
                ? '<span class="service-priority ' + sol.prioridade + '">' + this.getPrioLabel(sol.prioridade) + '</span>'
                : '';
            return '<div class="sol-card ' + (isNova ? 'sol-card--nova' : '') + '" onclick="Solicitacoes.openModal(\'' + sol.id + '\')">'
                + '<div class="sol-card-left">'
                + '<span class="sol-so-number">' + Inventory.escapeHtml(sol.numero_so) + '</span>'
                + '<div class="sol-card-meta">' + statusHtml + prioHtml + '<span class="sol-date">' + data + '</span></div>'
                + '</div>'
                + '<div class="sol-card-body">'
                + '<h4 class="sol-title">' + Inventory.escapeHtml(sol.titulo) + '</h4>'
                + '<p class="sol-setor">' + Inventory.escapeHtml(sol.cliente_setor || '—') + '</p>'
                + '<p class="sol-desc-preview">' + Inventory.escapeHtml((sol.descricao || '').substring(0, 120)) + (sol.descricao && sol.descricao.length > 120 ? '...' : '') + '</p>'
                + '</div>'
                + '<div class="sol-card-actions" onclick="event.stopPropagation()">'
                + (isNova ? '<button class="btn btn-sm btn-primary" onclick="Solicitacoes.openModal(\'' + sol.id + '\')">Analisar</button>' : '')
                + '<button class="btn btn-sm btn-danger btn-icon" onclick="Solicitacoes.confirmarExcluir(\'' + sol.id + '\',\'' + Inventory.escapeHtml(sol.numero_so) + '\')" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>'
                + '</div>'
                + '</div>';
        }).join('');
    },

    openModal(id) {
        this.currentId = id;
        const sol = AppState.solicitacoes.find(s => String(s.id) === String(id));
        if (!sol) return;
        const isNova = sol.status === 'nova';
        const data   = sol.data_solicitacao
            ? new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')
            : new Date(sol.data_criacao).toLocaleDateString('pt-BR');

        document.getElementById('solModalTitle').textContent = sol.numero_so;
        document.getElementById('solModalMeta').innerHTML =
            '<div class="sol-modal-so">' + Inventory.escapeHtml(sol.numero_so) + '</div>'
            + '<div class="sol-modal-info">'
            + '<span class="sol-status-badge ' + (isNova ? 'nova' : 'salva') + '">' + (isNova ? 'Nova' : 'Convertida') + '</span>'
            + (sol.prioridade ? '<span class="service-priority ' + sol.prioridade + '">' + this.getPrioLabel(sol.prioridade) + '</span>' : '')
            + '<span class="sol-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' + Inventory.escapeHtml(sol.cliente_setor || '—') + '</span>'
            + '<span class="sol-info-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + data + '</span>'
            + (sol.servico_id ? '<span class="sol-info-item sol-info-item--link">✓ Serviço #' + sol.servico_id + ' criado</span>' : '')
            + '</div>';

        document.getElementById('solModalDescricao').textContent = sol.descricao;
        document.getElementById('solModalAcoes').style.display   = isNova ? 'block' : 'none';
        document.getElementById('solSalvarBtn').style.display    = isNova ? 'inline-flex' : 'none';
        document.getElementById('solExcluirBtn').style.display   = 'inline-flex';
        if (isNova) document.getElementById('solPrioridade').value = 'media';
        Modal.open('solicitacaoModal');
    },

    async salvarComoServico() {
        const prioridade = document.getElementById('solPrioridade').value;
        if (!prioridade) { Toast.show('Selecione a prioridade!', 'error'); return; }
        const btn = document.getElementById('solSalvarBtn');
        btn.disabled = true;
        btn.textContent = 'Salvando...';
        try {
            await API.post('/api/solicitacoes/' + this.currentId + '/salvar-servico', { prioridade });
            Toast.show('Serviço criado com sucesso!', 'success');
            Modal.close('solicitacaoModal');
            await this.render();
            await Dashboard.update();
            await Services.render();
            await ActivityLogger.renderServices();
        } catch (e) {
            Toast.show((e && e.error) ? e.error : 'Erro ao salvar serviço!', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar como Serviço';
        }
    },

    excluirSolicitacao() {
        if (!this.currentId) return;
        Modal.close('solicitacaoModal');
        Modal.confirm('Excluir Solicitação', 'Tem certeza que deseja excluir esta solicitação?', async () => {
            try {
                await API.delete('/api/solicitacoes/' + this.currentId);
                Toast.show('Solicitação excluída!', 'success');
                await this.render();
                await Dashboard.update();
            } catch (e) { Toast.show('Erro ao excluir!', 'error'); }
        });
    },

    confirmarExcluir(id, numeroSo) {
        Modal.confirm('Excluir Solicitação', 'Excluir a solicitação ' + numeroSo + '?', async () => {
            try {
                await API.delete('/api/solicitacoes/' + id);
                Toast.show('Solicitação excluída!', 'success');
                await this.render();
                await Dashboard.update();
            } catch (e) { Toast.show('Erro ao excluir!', 'error'); }
        });
    },

    getPrioLabel(p) {
        return { baixa:'Baixa', media:'Média', alta:'Alta', urgente:'Urgente' }[p] || p;
    }
};

// ==========================================
// NAVEGAÇÃO
// ==========================================
const Navigation = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(item.dataset.tab);
            });
        });

        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => Modal.close(btn.dataset.close));
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) Modal.closeAll();
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { Modal.closeAll(); this.closeSidebar(); }
        });

        // Mobile sidebar
        const menuBtn  = document.getElementById('mobileMenuBtn');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (menuBtn)  menuBtn.addEventListener('click', () => this.toggleSidebar());
        if (backdrop) backdrop.addEventListener('click', () => this.closeSidebar());
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar && sidebar.classList.contains('open') ? this.closeSidebar() : this.openSidebar();
    },
    openSidebar() {
        const s = document.getElementById('sidebar');
        const b = document.getElementById('sidebarBackdrop');
        if (s) s.classList.add('open');
        if (b) b.classList.add('visible');
        document.body.style.overflow = 'hidden';
    },
    closeSidebar() {
        const s = document.getElementById('sidebar');
        const b = document.getElementById('sidebarBackdrop');
        if (s) s.classList.remove('open');
        if (b) b.classList.remove('visible');
        if (!document.querySelector('.modal-overlay.visible')) document.body.style.overflow = '';
    },

    switchTab(tabId) {
        this.closeSidebar();
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const targetTab = document.getElementById(tabId + '-tab');
        if (targetTab) targetTab.classList.add('active');

        switch (tabId) {
            case 'dashboard':
                Dashboard.update();
                ActivityLogger.renderInventory();
                ActivityLogger.renderServices();
                break;
            case 'inventory': Inventory.render(); break;
            case 'snippets': Snippets.render(); break;
            case 'services': Services.render(); break;
            case 'solicitacoes': Solicitacoes.render(); break;
            case 'reports': Reports.init(); break;
        }
    }
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    LoginManager.init();
});
