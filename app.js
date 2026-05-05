// FUNDO BINÁRIO
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d'); 

canvas.height = window.innerHeight;
canvas.width = window.innerWidth;

const letters = '01';
const fontSize = 14;
const columns = canvas.width / fontSize;

const drops = [];
for(let x=0;x<columns;x++) drops[x]=1;
function draw(){
ctx.fillStyle = 'rgba(0,0,0,0.05)';
ctx.fillRect(0,0,canvas.width,canvas.height);

ctx.fillStyle = '#00d4ff';
ctx.font = fontSize+'px monospace';

for(let i=0;i<drops.length;i++){
const text = letters[Math.floor(Math.random()*letters.length)];
ctx.fillText(text,i*fontSize,drops[i]*fontSize);

if(drops[i]*fontSize>canvas.height && Math.random()>0.975)
drops[i]=0;

 drops[i]++;
}
}

setInterval(draw,33);



// ==========================================
// SETOR DE TI - FRONTEND (API VERSION)
// Conectado ao backend MySQL via Railway
// ==========================================

const AppState = {
    inventory: [],
    snippets: [],
    services: [],
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

        Navigation.init();
        Dashboard.setupQuickActions();
        await Dashboard.update();
        await Inventory.init();
        await Snippets.init();
        await Services.init();
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
    },

    openAddModal() {
        document.getElementById('serviceModalTitle').textContent = 'Novo Serviço';
        document.getElementById('serviceForm').reset();
        document.getElementById('serviceId').value = '';
        Modal.open('serviceModal');
    },

    openEditModal(id) {
        const service = AppState.services.find(s => String(s.id) === String(id));
        if (!service) return;
        document.getElementById('serviceModalTitle').textContent = 'Editar Serviço';
        document.getElementById('serviceId').value = service.id;
        document.getElementById('serviceTitle').value = service.titulo;
        document.getElementById('serviceClient').value = service.cliente_setor || '';
        document.getElementById('servicePriority').value = service.prioridade || 'media';
        document.getElementById('serviceDate').value = service.data_servico ? service.data_servico.split('T')[0] : '';
        document.getElementById('serviceDescription').value = service.descricao || '';
        document.getElementById('serviceReport').value = service.relatorio || '';
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
            if (service.criado_por) authHtml += '<span class="service-emitido-por">Emitido por: ' + Inventory.escapeHtml(service.criado_por) + '</span>';
            if (service.modificado_por) authHtml += '<span class="service-modificado-por">Modificado por: ' + Inventory.escapeHtml(service.modificado_por) + '</span>';
            authEl.innerHTML = authHtml;
            authEl.style.display = authHtml ? 'flex' : 'none';
        }
        // Mostrar/ocultar botão Editar conforme ownership (loose equality)
        const curIdView = AppState.currentUser && AppState.currentUser.id;
        const isOwnerView = !service.usuario_id || String(service.usuario_id) === String(curIdView);
        const editFromViewBtn = document.getElementById('editFromViewBtn');
        if (editFromViewBtn) {
            editFromViewBtn.style.display = isOwnerView ? 'inline-flex' : 'none';
            const svcId = service.id;
            editFromViewBtn.onclick = () => { Modal.close('viewServiceModal'); Services.openEditModal(svcId); };
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
            descricao: document.getElementById('serviceDescription').value.trim(),
            relatorio: document.getElementById('serviceReport').value.trim()
        };

        if (!serviceData.titulo || !serviceData.descricao) {
            Toast.show('Preencha os campos obrigatórios!', 'error');
            return;
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
            const protocolo = Reports.generateProtocol();
            const emitidoPor = AppState.currentUser ? AppState.currentUser.nome || AppState.currentUser.usuario : '';
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
    </style>
</head>
<body>
    ${headerHtml}

    <div style="display:flex;justify-content:space-between;margin-bottom:18px;align-items:flex-end;">
        <h2 style="margin:0;font-size:16px;color:#1a2744;">Ordem de Serviço</h2>
        <div style="text-align:right;">
            <span style="font-size:13px;font-weight:700;color:#1a2744;display:block;letter-spacing:0.5px;">Protocolo Nº ${protocolo}</span>
            <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
            ${emitidoPor ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPor}</span>` : ''}
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
                if (isOwnerForActions) {
                    actionsHtml += '<button class="btn btn-sm btn-secondary" onclick="Services.openEditModal(\'' + service.id + '\')">Editar</button>';
                    if (service.status === 'pending') {
                        actionsHtml += '<button class="btn btn-sm btn-primary" onclick="Services.completeService(\'' + service.id + '\')">Concluir</button>';
                    }
                }
                actionsHtml += '<button class="btn btn-sm btn-pdf" onclick="Services.gerarPdfServico(\'' + service.id + '\')" title="Gerar PDF deste serviço">'
                    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:3px;">'
                    + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>'
                    + '<polyline points="7 10 12 15 17 10"/>'
                    + '<line x1="12" y1="15" x2="12" y2="3"/>'
                    + '</svg>PDF</button>';
                actionsHtml += '</div>';
                const emitidoPor = service.criado_por ? '<span class="service-emitido-por">Emitido por: ' + Inventory.escapeHtml(service.criado_por) + '</span>' : '';
                const modificadoPor = service.modificado_por ? '<span class="service-modificado-por">Modificado por: ' + Inventory.escapeHtml(service.modificado_por) + '</span>' : '';
                return '<div class="service-card" onclick="Services.viewService(\'' + service.id + '\')"><div class="service-card-header"><h4 class="service-title">' + Inventory.escapeHtml(service.titulo) + '</h4><span class="service-status-badge ' + service.status + '">' + statusLabel + '</span></div><div class="service-meta">' + (service.cliente_setor ? '<span>' + Inventory.escapeHtml(service.cliente_setor) + '</span>' : '') + '<span class="service-priority ' + service.prioridade + '">' + priorityLabel + '</span><span>' + date + '</span></div><p class="service-description">' + Inventory.escapeHtml(service.descricao) + '</p>' + (emitidoPor || modificadoPor ? '<div class="service-authorship">' + emitidoPor + modificadoPor + '</div>' : '') + actionsHtml + '</div>';
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
        this._bindFolha();
    },

    _bindSubtabs() {
        document.querySelectorAll('.report-subtab').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.report-subtab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.report-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById('report-panel-' + btn.dataset.report);
                if (panel) panel.classList.add('active');
                if (btn.dataset.report === 'salvos') SavedReports.render();
            };
        });
        const btnLimpar = document.getElementById('btnLimparSalvos');
        if (btnLimpar) btnLimpar.onclick = () => {
            if (confirm('Limpar todo o histórico de relatórios salvos?')) {
                SavedReports.clearAll();
            }
        };
    },

    _bindEstoque() {
        const btn = document.getElementById('btnGerarEstoque');
        if (btn) btn.onclick = () => this.gerarEstoque();
    },

    _bindServicos() {
        const btn = document.getElementById('btnGerarServicos');
        if (btn) btn.onclick = () => this.gerarServicos();
    },

    _bindFolha() {
        // "Folha em Branco" button that lives inside the Serviços panel
        const btnF = document.getElementById('btnGerarFolhaServicos');
        if (btnF) btnF.onclick = () => this.gerarFolhaEmBranco();
    },

    _bindPedido() {
        const btnAdd   = document.getElementById('btnAdicionarPedido');
        const btnGerar = document.getElementById('btnGerarPedido');
        if (btnAdd)   btnAdd.onclick   = () => this.adicionarItemPedido();
        if (btnGerar) btnGerar.onclick = () => this.gerarPedido();
        // Enter key on nome field adds item
        const nomeEl = document.getElementById('pedidoNome');
        if (nomeEl) nomeEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.adicionarItemPedido(); } });
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

    generateProtocol() {
        const year = new Date().getFullYear();
        // 6-digit random number padded with zeros
        const num = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0');
        return `${num}/${year}`;
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
        <div style="margin-top:14px;padding-top:4px;">
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
            const protocoloEstoque = this.generateProtocol();
            const headerHtml = await this._buildPdfHeader(brasao);
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 12px;font-size:13px;text-align:left;}th:last-child{text-align:center;width:100px;}</style></head><body>
            ${headerHtml}
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
                <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório de Estoque</h2>
                <div style="text-align:right;">
                    <span style="font-size:12px;font-weight:700;color:#1a2744;display:block;letter-spacing:0.5px;">Protocolo Nº ${protocoloEstoque}</span>
                    <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
                    ${emitidoPorEstoque ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorEstoque}</span>` : ''}
                </div>
            </div>
            <table>
                <thead><tr><th>Nome do Item</th><th style="text-align:center;">Quantidade</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            ${this._buildPdfFooter()}
            </body></html>`;

            SavedReports.save('estoque', 'Relatório de Estoque', protocoloEstoque, today, html);
            this._printHtml(html, 'Relatorio_Estoque');
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

            const protocoloServicos = this.generateProtocol();
            const headerHtml = await this._buildPdfHeader(brasao);
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 10px;font-size:12px;text-align:left;}</style></head><body>
            ${headerHtml}
            <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
                <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório de Serviços</h2>
                <div style="text-align:right;">
                    <span style="font-size:12px;font-weight:700;color:#1a2744;display:block;letter-spacing:0.5px;">Protocolo Nº ${protocoloServicos}</span>
                    <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
                    ${emitidoPorServicos ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorServicos}</span>` : ''}
                </div>
            </div>
            <table>
                <thead><tr><th>Título</th><th>Setor/Cliente</th><th style="width:110px;">Data de Solicitação</th><th style="width:110px;">Data de Conclusão</th><th style="width:90px;">Status</th><th>Descrição</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            ${this._buildPdfFooter()}
            </body></html>`;

            SavedReports.save('servicos', 'Relatório de Serviços', protocoloServicos, today, html);
            this._printHtml(html, 'Relatorio_Servicos');
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

        const protocoloPedido = this.generateProtocol();
        const headerHtml = await this._buildPdfHeader(brasao);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:40px;color:#222;}table{width:100%;border-collapse:collapse;}th{background:#1a2744;color:#fff;padding:10px 12px;font-size:13px;text-align:left;}</style></head><body>
        ${headerHtml}
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:flex-end;">
            <h2 style="margin:0;font-size:16px;color:#1a2744;">Pedido de Reposição de Estoque</h2>
            <div style="text-align:right;">
                <span style="font-size:12px;font-weight:700;color:#1a2744;display:block;letter-spacing:0.5px;">Protocolo Nº ${protocoloPedido}</span>
                <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
                ${emitidoPorPedido ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPorPedido}</span>` : ''}
            </div>
        </div>
        <table>
            <thead><tr><th style="width:40px;">#</th><th>Nome do Produto</th><th>Especificações</th><th>Descrição</th><th style="width:80px;text-align:center;">Qtd</th><th style="width:110px;text-align:center;">Nível</th></tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
        ${this._buildPdfFooter()}
        </body></html>`;

        this._printHtml(html, 'Pedido_Reposicao');
    },

    async gerarFolhaEmBranco() {
        const brasao = await this.loadBrasao();
        const today = new Date().toLocaleDateString('pt-BR');
        const protocolo = this.generateProtocol();
        const emitidoPor = AppState.currentUser ? AppState.currentUser.nome || AppState.currentUser.usuario : '';
        const headerHtml = await this._buildPdfHeader(brasao);

        const mkLinhas = (n, h = 26) => Array.from({length: n}, () =>
            `<div style="border-bottom:1px solid #ccc;height:${h}px;"></div>`).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 36px; color: #222; }
        .sec { border:1px solid #1a2744;border-radius:4px;padding:10px 12px;margin-bottom:16px; }
        .sec-obs { border:1px solid #ccc;border-radius:4px;padding:10px 12px;margin-bottom:16px; }
        .sec-lbl { font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#1a2744;
                   font-weight:700;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;display:block; }
        .sec-obs-lbl { font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;
                       margin-bottom:8px;display:block; }
        @media print { body { margin:28px; } }
    </style>
</head>
<body>
    ${headerHtml}

    <div style="display:flex;justify-content:space-between;margin-bottom:20px;align-items:flex-end;">
        <h2 style="margin:0;font-size:16px;color:#1a2744;">Relatório / Ordem de Serviço</h2>
        <div style="text-align:right;">
            <span style="font-size:13px;font-weight:700;color:#1a2744;display:block;letter-spacing:0.5px;">Protocolo Nº ${protocolo}</span>
            <span style="font-size:11px;color:#777;display:block;">Emitido em: ${today}</span>
            ${emitidoPor ? `<span style="font-size:11px;color:#777;display:block;">Emitido por: ${emitidoPor}</span>` : ''}
        </div>
    </div>

    <!-- Cabeçalho -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
            <td style="padding:6px 8px;border:1px solid #ccc;width:50%;">
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Setor / Solicitante</span>
                <div style="height:20px;"></div>
            </td>
            <td style="padding:6px 8px;border:1px solid #ccc;width:25%;">
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Data de Solicitação</span>
                <div style="height:20px;"></div>
            </td>
            <td style="padding:6px 8px;border:1px solid #ccc;width:25%;">
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Prioridade</span>
                <div style="height:20px;"></div>
            </td>
        </tr>
        <tr>
            <td colspan="3" style="padding:6px 8px;border:1px solid #ccc;">
                <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Título / Assunto</span>
                <div style="height:20px;"></div>
            </td>
        </tr>
    </table>
    <!-- Descrição -->
    <div class="sec">
        <span class="sec-lbl">Descrição do Serviço / Problema Relatado</span>
        ${mkLinhas(7)}
    </div>
    <!-- Atividades Realizadas -->
    <div class="sec">
        <span class="sec-lbl">Atividades Realizadas</span>
        ${mkLinhas(9)}
    </div>
    ${this._buildPdfFooter()}
</body>
</html>`;

        this._printHtml(html, 'Folha_Servico');
    },

    _printHtml(html, filename) {
        const win = window.open('', '_blank', 'width=960,height=750');
        if (!win) { Toast.show('Permita popups para gerar o PDF!', 'error'); return; }
        win.document.open();
        win.document.write(html);
        win.document.close();
        // onload is unreliable after document.write — use timeout instead
        setTimeout(() => {
            try { win.focus(); win.print(); } catch(e) { console.error('print error:', e); }
        }, 800);
    }
};

// ==========================================
// RELATÓRIOS SALVOS (localStorage)
// ==========================================
const SavedReports = {
    KEY: 'setorTI_savedReports',

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    },

    save(tipo, titulo, protocolo, data, html) {
        const list = this.load();
        // Limit to 30 saved reports
        if (list.length >= 30) list.splice(0, list.length - 29);
        list.push({
            id:        Date.now(),
            tipo,
            titulo,
            protocolo,
            data,
            geradoEm:  new Date().toISOString(),
            html
        });
        try {
            localStorage.setItem(this.KEY, JSON.stringify(list));
            Toast.show('Relatório salvo no histórico!', 'success');
        } catch(e) {
            Toast.show('Não foi possível salvar (armazenamento cheio).', 'error');
        }
    },

    remove(id) {
        const list = this.load().filter(r => r.id !== id);
        localStorage.setItem(this.KEY, JSON.stringify(list));
        this.render();
    },

    clearAll() {
        localStorage.removeItem(this.KEY);
        this.render();
        Toast.show('Histórico limpo!', 'info');
    },

    reopen(id) {
        const item = this.load().find(r => r.id === id);
        if (!item) return;
        Reports._printHtml(item.html, item.titulo.replace(/\s+/g,'_'));
    },

    render() {
        const container = document.getElementById('savedReportsList');
        if (!container) return;
        const list = this.load();
        if (list.length === 0) {
            container.innerHTML = `
                <div class="report-preview-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                    </svg>
                    <p>Nenhum relatório salvo ainda. Gere um relatório de estoque ou serviços.</p>
                </div>`;
            return;
        }
        const icons = {
            estoque:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
            servicos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
        };
        // Newest first
        const sorted = [...list].reverse();
        container.innerHTML = sorted.map(r => {
            const dt = new Date(r.geradoEm).toLocaleString('pt-BR');
            const icon = icons[r.tipo] || icons.servicos;
            const tagClass = r.tipo === 'estoque' ? 'tag-estoque' : 'tag-servicos';
            return `<div class="saved-report-item">
                <div class="saved-report-icon ${r.tipo}">${icon}</div>
                <div class="saved-report-info">
                    <span class="saved-report-title">${r.titulo}</span>
                    <span class="saved-report-meta">
                        <span class="saved-report-tag ${tagClass}">${r.tipo === 'estoque' ? 'Estoque' : 'Serviços'}</span>
                        Protocolo <strong>${r.protocolo}</strong> &nbsp;·&nbsp; ${dt}
                    </span>
                </div>
                <div class="saved-report-actions">
                    <button class="btn btn-sm btn-primary" onclick="SavedReports.reopen(${r.id})" title="Reabrir PDF">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Abrir
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="SavedReports.remove(${r.id})" title="Excluir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>`;
        }).join('');
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
