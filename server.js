// ==========================================
// SETOR DE TI - BACKEND SERVER
// Node.js + Express + MySQL (Railway)
// ==========================================

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

const dbConfig = {
    host:               process.env.MYSQLHOST     || 'mysql.railway.internal',
    port:               parseInt(process.env.MYSQLPORT) || 3306,
    user:               process.env.MYSQLUSER     || 'root',
    password:           process.env.MYSQLPASSWORD || 'OhogquOKFnLPXoQPaHKLyuSVOUUhQZqa',
    database:           process.env.MYSQLDATABASE || 'railway',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0
};

const pool = mysql.createPool(dbConfig);

async function columnExists(table, column) {
    try {
        const [rows] = await pool.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        return rows.length > 0;
    } catch(e) { return false; }
}

async function runMigrations() {
    const toAdd = [
        { table: 'atividades', col: 'usuario_id',    def: 'INT DEFAULT NULL' },
        { table: 'atividades', col: 'usuario_nome',  def: 'VARCHAR(100) DEFAULT NULL' },
        { table: 'atividades', col: 'snapshot',      def: 'JSON DEFAULT NULL' },
        { table: 'servicos',   col: 'criado_por',    def: 'VARCHAR(100) DEFAULT NULL' },
        { table: 'servicos',   col: 'modificado_por',def: 'VARCHAR(100) DEFAULT NULL' },
        { table: 'servicos',   col: 'usuario_id',    def: 'INT DEFAULT NULL' },
        { table: 'servicos',   col: 'concluido_por', def: 'VARCHAR(100) DEFAULT NULL' },
    ];
    // Criar tabela solicitacoes se não existir
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS solicitacoes (
                id               INT NOT NULL AUTO_INCREMENT,
                numero_so        VARCHAR(20)  NOT NULL,
                criado_por       VARCHAR(100) DEFAULT NULL,
                excluido_por     VARCHAR(100) DEFAULT NULL,
                titulo           VARCHAR(100) NOT NULL,
                cliente_setor    VARCHAR(100) DEFAULT NULL,
                descricao        TEXT         NOT NULL,
                data_solicitacao DATE         DEFAULT NULL,
                status           VARCHAR(20)  DEFAULT 'nova',
                prioridade       VARCHAR(20)  DEFAULT NULL,
                servico_id       INT          DEFAULT NULL,
                data_criacao     DATETIME     DEFAULT CURRENT_TIMESTAMP,
                data_atualizacao DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY unique_numero_so (numero_so),
                KEY idx_sol_status  (status),
                KEY idx_sol_numero  (numero_so),
                KEY idx_sol_criacao (data_criacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('  + Tabela solicitacoes OK');
        // Add new columns if upgrading existing table
        for (const col of ['criado_por VARCHAR(100) DEFAULT NULL', 'excluido_por VARCHAR(100) DEFAULT NULL']) {
            const colName = col.split(' ')[0];
            try {
                const ex = await columnExists('solicitacoes', colName);
                if (!ex) await pool.execute('ALTER TABLE solicitacoes ADD COLUMN ' + col);
            } catch(e2) {}
        }
    } catch(e) { console.error('  ! Tabela solicitacoes:', e.message); }

    // Atualizar view com coluna solicitacoes_novas
    try {
        await pool.execute(`
            CREATE OR REPLACE VIEW dashboard_resumo AS
            SELECT
                (SELECT COUNT(*) FROM estoque_itens WHERE ativo=1) AS total_itens_estoque,
                (SELECT COUNT(*) FROM estoque_itens WHERE ativo=1 AND quantidade<=estoque_minimo) AS itens_estoque_baixo,
                (SELECT COUNT(*) FROM snippets WHERE ativo=1) AS total_snippets,
                (SELECT COUNT(*) FROM servicos WHERE status='pending') AS servicos_pendentes,
                (SELECT COUNT(*) FROM servicos WHERE status='completed') AS servicos_concluidos,
                (SELECT COUNT(*) FROM solicitacoes WHERE status='nova') AS solicitacoes_novas
        `);
        console.log('  + View dashboard_resumo atualizada');
    } catch(e) { console.warn('  ! View dashboard_resumo:', e.message); }

    let applied = 0;
    for (const { table, col, def } of toAdd) {
        try {
            const exists = await columnExists(table, col);
            if (!exists) {
                await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
                console.log(`  + Added ${table}.${col}`);
                applied++;
            }
        } catch (e) {
            console.error(`  ! Failed ${table}.${col}:`, e.message);
        }
    }
    console.log(`Migrações: ${applied} coluna(s) adicionada(s).`);
    return applied;
}

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Debug endpoint — shows what headers server receives
app.get('/api/debug', requireAuth, async (req, res) => {
    res.json({
        user_nome_header: req.headers['x-user-nome'] || null,
        user_id_header:   req.headers['x-user-id']   || null,
        decoded_nome:     req.headers['x-user-nome'] ? decodeURIComponent(req.headers['x-user-nome']) : null,
        server_version:   'v2-with-user-tracking'
    });
});

// Manual migration trigger — call from browser: GET /api/migrate?token=setor-ti-authenticated
app.get('/api/migrate', async (req, res) => {
    if (req.query.token !== 'setor-ti-authenticated' && req.headers['x-auth-token'] !== 'setor-ti-authenticated')
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const applied = await runMigrations();
        res.json({ success: true, message: `Migração concluída. ${applied} coluna(s) adicionada(s).` });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

function requireAuth(req, res, next) {
    if (req.headers['x-auth-token'] === 'setor-ti-authenticated') return next();
    res.status(401).json({ error: 'Não autorizado' });
}
function getUserNome(req) {
    const h = req.headers['x-user-nome'];
    return h ? decodeURIComponent(h) : null;
}
function getUserId(req) {
    const id = req.headers['x-user-id'];
    return id ? parseInt(id) : null;
}

app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM usuarios WHERE usuario = ? AND ativo = 1', [usuario]);
        if (!rows.length) return res.status(401).json({ error: 'usuario', message: 'O usuário está errado!!' });
        const user = rows[0];
        if (user.senha !== senha) return res.status(401).json({ error: 'senha', message: 'A senha está errada!!' });
        res.json({ success: true, token: 'setor-ti-authenticated',
                   user: { id: user.id, usuario: user.usuario, nome: user.nome_completo } });
    } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
    try {
        const [summary]         = await pool.execute('SELECT * FROM dashboard_resumo');
        // Explicit columns — graceful fallback if new cols not yet migrated
        let recentInventory = [], recentServices = [];
        const COLS = 'id, tipo, acao, detalhes, data_atividade, usuario_nome, usuario_id, snapshot';
        const BASE = 'id, tipo, acao, detalhes, data_atividade';
        try {
            [recentInventory] = await pool.execute(
                `SELECT ${COLS} FROM atividades WHERE tipo = ? ORDER BY data_atividade DESC LIMIT 10`, ['inventory']);
        } catch(e1) {
            [recentInventory] = await pool.execute(
                `SELECT ${BASE} FROM atividades WHERE tipo = ? ORDER BY data_atividade DESC LIMIT 10`, ['inventory']);
        }
        try {
            [recentServices] = await pool.execute(
                `SELECT ${COLS} FROM atividades WHERE tipo = ? ORDER BY data_atividade DESC LIMIT 10`, ['services']);
        } catch(e2) {
            [recentServices] = await pool.execute(
                `SELECT ${BASE} FROM atividades WHERE tipo = ? ORDER BY data_atividade DESC LIMIT 10`, ['services']);
        }
        recentServices.forEach(a => {
            if (a.snapshot && typeof a.snapshot === 'string') {
                try { a.snapshot = JSON.parse(a.snapshot); } catch(e) { a.snapshot = null; }
            }
        });
        res.json({ summary: summary[0] || {}, recentInventory, recentServices });
    } catch (err) { res.status(500).json({ error: 'Erro ao carregar dashboard' }); }
});

app.get('/api/estoque', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM estoque_itens WHERE ativo = 1 ORDER BY data_criacao DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar estoque' }); }
});

app.post('/api/estoque', requireAuth, async (req, res) => {
    const { nome, categoria, quantidade, estoque_minimo, localizacao, descricao } = req.body;
    if (!nome || !categoria) return res.status(400).json({ error: 'Nome e categoria obrigatórios' });
    try {
        const [result] = await pool.execute(
            'INSERT INTO estoque_itens (nome,categoria,quantidade,estoque_minimo,localizacao,descricao) VALUES (?,?,?,?,?,?)',
            [nome, categoria, quantidade||0, estoque_minimo||5, localizacao||'', descricao||'']
        );
        await logActivity('inventory','add','Adicionado: '+nome, getUserNome(req), getUserId(req), null);
        const [item] = await pool.execute('SELECT * FROM estoque_itens WHERE id=?',[result.insertId]);
        res.status(201).json(item[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao adicionar item' }); }
});

app.put('/api/estoque/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { nome, categoria, quantidade, estoque_minimo, localizacao, descricao } = req.body;
    try {
        await pool.execute(
            'UPDATE estoque_itens SET nome=?,categoria=?,quantidade=?,estoque_minimo=?,localizacao=?,descricao=? WHERE id=? AND ativo=1',
            [nome, categoria, quantidade, estoque_minimo, localizacao||'', descricao||'', id]
        );
        await logActivity('inventory','edit','Editado: '+nome, getUserNome(req), getUserId(req), null);
        const [updated] = await pool.execute('SELECT * FROM estoque_itens WHERE id=?',[id]);
        res.json(updated[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao editar item' }); }
});

app.delete('/api/estoque/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const [item] = await pool.execute('SELECT nome FROM estoque_itens WHERE id=?',[id]);
        await pool.execute('UPDATE estoque_itens SET ativo=0 WHERE id=?',[id]);
        if (item[0]) await logActivity('inventory','delete','Excluído: '+item[0].nome, getUserNome(req), getUserId(req), null);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao excluir item' }); }
});

app.get('/api/snippets', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM snippets WHERE ativo=1 ORDER BY data_criacao DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar snippets' }); }
});

app.post('/api/snippets', requireAuth, async (req, res) => {
    const { titulo, categoria, tipo, tags, descricao, codigo } = req.body;
    if (!titulo||!categoria||!tipo||!codigo) return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    try {
        const [result] = await pool.execute(
            'INSERT INTO snippets (titulo,categoria,tipo,tags,descricao,codigo) VALUES (?,?,?,?,?,?)',
            [titulo, categoria, tipo, tags||'', descricao||'', codigo]
        );
        const [s] = await pool.execute('SELECT * FROM snippets WHERE id=?',[result.insertId]);
        res.status(201).json(s[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao adicionar snippet' }); }
});

app.put('/api/snippets/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { titulo, categoria, tipo, tags, descricao, codigo } = req.body;
    try {
        await pool.execute(
            'UPDATE snippets SET titulo=?,categoria=?,tipo=?,tags=?,descricao=?,codigo=? WHERE id=? AND ativo=1',
            [titulo, categoria, tipo, tags||'', descricao||'', codigo, id]
        );
        const [u] = await pool.execute('SELECT * FROM snippets WHERE id=?',[id]);
        res.json(u[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao editar snippet' }); }
});

app.delete('/api/snippets/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE snippets SET ativo=0 WHERE id=?',[id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao excluir snippet' }); }
});

app.get('/api/servicos', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM servicos ORDER BY data_criacao DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar serviços' }); }
});

app.post('/api/servicos', requireAuth, async (req, res) => {
    const { titulo, cliente_setor, prioridade, data_servico, descricao, relatorio } = req.body;
    if (!titulo||!descricao) return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    try {
        let result;
        try {
            [result] = await pool.execute(
                'INSERT INTO servicos (titulo,cliente_setor,prioridade,data_servico,descricao,relatorio,status,criado_por,usuario_id) VALUES (?,?,?,?,?,?,?,?,?)',
                [titulo, cliente_setor||'', prioridade||'media', data_servico||null, descricao, relatorio||'', 'pending', nomeUsr, idUsr]
            );
        } catch (e2) {
            [result] = await pool.execute(
                'INSERT INTO servicos (titulo,cliente_setor,prioridade,data_servico,descricao,relatorio,status) VALUES (?,?,?,?,?,?,?)',
                [titulo, cliente_setor||'', prioridade||'media', data_servico||null, descricao, relatorio||'', 'pending']
            );
        }
        await logActivity('services','add','Adicionado serviço: '+titulo, nomeUsr, idUsr, null);
        const [s] = await pool.execute('SELECT * FROM servicos WHERE id=?',[result.insertId]);
        res.status(201).json(s[0]);
    } catch (err) {
        console.error('Serviços POST error:', err);
        res.status(500).json({ error: 'Erro ao adicionar serviço' });
    }
});

app.put('/api/servicos/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { titulo, cliente_setor, prioridade, data_servico, descricao, relatorio } = req.body;
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    try {
        const [existing] = await pool.execute(
            'SELECT criado_por, usuario_id, titulo, cliente_setor, prioridade, data_servico, descricao FROM servicos WHERE id=?', [id]
        );
        if (!existing.length) return res.status(404).json({ error: 'Serviço não encontrado' });
        const svc = existing[0];
        const isDono = !svc.usuario_id || String(svc.usuario_id) === String(idUsr);

        if (isDono) {
            // Dono — pode editar tudo
            try {
                await pool.execute(
                    'UPDATE servicos SET titulo=?,cliente_setor=?,prioridade=?,data_servico=?,descricao=?,relatorio=?,modificado_por=? WHERE id=?',
                    [titulo, cliente_setor||'', prioridade||'media', data_servico||null, descricao, relatorio||'', nomeUsr, id]
                );
            } catch (e2) {
                await pool.execute(
                    'UPDATE servicos SET titulo=?,cliente_setor=?,prioridade=?,data_servico=?,descricao=?,relatorio=? WHERE id=?',
                    [titulo, cliente_setor||'', prioridade||'media', data_servico||null, descricao, relatorio||'', id]
                );
            }
            await logActivity('services', 'edit', 'Editado serviço: ' + titulo, nomeUsr, idUsr, null);
        } else {
            // Outro usuário — edita APENAS o campo relatorio, preserva todo o resto
            try {
                await pool.execute(
                    'UPDATE servicos SET relatorio=?,modificado_por=? WHERE id=?',
                    [relatorio||'', nomeUsr, id]
                );
            } catch (e2) {
                await pool.execute('UPDATE servicos SET relatorio=? WHERE id=?', [relatorio||'', id]);
            }
            await logActivity('services', 'edit', 'Relatório editado: ' + svc.titulo, nomeUsr, idUsr, null);
        }
        const [u] = await pool.execute('SELECT * FROM servicos WHERE id=?', [id]);
        res.json(u[0]);
    } catch (err) {
        console.error('PUT servicos error:', err);
        res.status(500).json({ error: 'Erro ao editar serviço' });
    }
});

app.patch('/api/servicos/:id/concluir', requireAuth, async (req, res) => {
    const { id } = req.params;
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    try {
        const [existing] = await pool.execute('SELECT titulo FROM servicos WHERE id=?', [id]);
        if (!existing.length) return res.status(404).json({ error: 'Serviço não encontrado' });
        const titulo = existing[0].titulo;
        // Qualquer usuário autenticado pode concluir — salva concluido_por
        try {
            await pool.execute(
                'UPDATE servicos SET status=?, data_conclusao=NOW(), concluido_por=? WHERE id=?',
                ['completed', nomeUsr, id]
            );
        } catch (e2) {
            await pool.execute('UPDATE servicos SET status=?, data_conclusao=NOW() WHERE id=?', ['completed', id]);
        }
        await logActivity('services', 'complete', 'Concluído por ' + nomeUsr + ': ' + titulo, nomeUsr, idUsr, null);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao concluir serviço' }); }
});

app.delete('/api/servicos/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    try {
        const [rows] = await pool.execute('SELECT * FROM servicos WHERE id=?',[id]);
        if (!rows.length) return res.status(404).json({ error: 'Serviço não encontrado' });
        const svc = rows[0];
        if (svc.usuario_id && svc.usuario_id !== idUsr)
            return res.status(403).json({ error: 'Apenas o responsável pode excluir este serviço.' });
        const snapshot = {
            titulo: svc.titulo, cliente_setor: svc.cliente_setor,
            prioridade: svc.prioridade, status: svc.status,
            descricao: svc.descricao, relatorio: svc.relatorio,
            criado_por: svc.criado_por || nomeUsr, data_servico: svc.data_servico
        };
        await pool.execute('DELETE FROM servicos WHERE id=?',[id]);
        await logActivity('services','delete','Excluído: '+svc.titulo, nomeUsr, idUsr, snapshot);
        res.json({ success: true });
    } catch (err) {
        console.error('Serviços DELETE error:', err);
        res.status(500).json({ error: 'Erro ao excluir serviço' });
    }
});

app.get('/api/configuracoes', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM configuracoes');
        const config = {};
        rows.forEach(r => { config[r.chave] = r.valor; });
        res.json(config);
    } catch (err) { res.status(500).json({ error: 'Erro ao carregar configurações' }); }
});

app.put('/api/configuracoes/:chave', requireAuth, async (req, res) => {
    const { chave } = req.params;
    const { valor } = req.body;
    try {
        await pool.execute(
            'INSERT INTO configuracoes (chave,valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=?',
            [chave, valor, valor]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao salvar configuração' }); }
});

// Cache das colunas existentes em 'atividades' para evitar INSERT duplo
let _atividadesColsVerified = false;
let _atividadesHasExtras    = false;

async function logActivity(tipo, acao, detalhes, usuarioNome, usuarioId, snapshot) {
    try {
        // Verificar colunas uma única vez por sessão do servidor
        if (!_atividadesColsVerified) {
            try {
                const [cols] = await pool.execute(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS " +
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'atividades' AND COLUMN_NAME = 'usuario_nome'"
                );
                _atividadesHasExtras    = cols.length > 0;
                _atividadesColsVerified = true;
            } catch(e) { _atividadesColsVerified = true; }
        }

        if (_atividadesHasExtras) {
            await pool.execute(
                'INSERT INTO atividades (tipo,acao,detalhes,usuario_nome,usuario_id) VALUES (?,?,?,?,?)',
                [tipo, acao, detalhes, usuarioNome||null, usuarioId||null]
            );
        } else {
            await pool.execute(
                'INSERT INTO atividades (tipo,acao,detalhes) VALUES (?,?,?)',
                [tipo, acao, detalhes]
            );
        }
    } catch (err) { console.error('Erro ao registrar atividade:', err.message); }
}

// ==========================================
// ROTAS DE SOLICITAÇÕES
// ==========================================

// Próximo número O.S. — sem auth (usado pelo portal público)
app.get('/api/solicitacoes/proximo-numero', async (req, res) => {
    try {
        const ano = new Date().getFullYear();
        const [rows] = await pool.execute(
            `SELECT numero_so FROM solicitacoes WHERE numero_so LIKE ? ORDER BY id DESC LIMIT 1`,
            [`%/${ano}`]
        );
        let proximo = 1;
        if (rows.length > 0) {
            const seq = parseInt(rows[0].numero_so.split('/')[0]);
            if (!isNaN(seq)) proximo = seq + 1;
        }
        res.json({ numero: String(proximo).padStart(6, '0') + '/' + ano });
    } catch (err) {
        console.error('Erro ao gerar número SO:', err.message);
        res.status(500).json({ error: 'Erro ao gerar número' });
    }
});

// Criar solicitação — sem auth (recebida do portal público)
app.post('/api/solicitacoes', async (req, res) => {
    const { numero_so, titulo, cliente_setor, descricao, data_solicitacao } = req.body;
    if (!titulo || !descricao || !numero_so)
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    try {
        const [existe] = await pool.execute('SELECT id FROM solicitacoes WHERE numero_so=?', [numero_so]);
        if (existe.length > 0)
            return res.status(409).json({ error: 'Número O.S. já utilizado. Tente novamente.' });
        await pool.execute(
            `INSERT INTO solicitacoes (numero_so,titulo,cliente_setor,descricao,data_solicitacao,status) VALUES (?,?,?,?,?,'nova')`,
            [numero_so, titulo, cliente_setor||'', descricao, data_solicitacao||null]
        );
        // Log activity — usuario info not available on public POST, leave null
        await logActivity('services', 'add', 'O.S. criada: ' + numero_so + ' — ' + titulo, null, null, null);
        res.status(201).json({ success: true, numero_so });
    } catch (err) {
        console.error('Erro ao criar solicitação:', err.message);
        res.status(500).json({ error: 'Erro ao registrar solicitação', detail: err.message });
    }
});

// Listar solicitações — requer auth
app.get('/api/solicitacoes', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT * FROM solicitacoes WHERE status != 'excluido' ORDER BY data_criacao DESC`
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar solicitações' }); }
});

// Salvar solicitação como serviço — requer auth
app.post('/api/solicitacoes/:id/salvar-servico', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { prioridade } = req.body;
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    if (!prioridade) return res.status(400).json({ error: 'Prioridade é obrigatória' });
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM solicitacoes WHERE id=? AND status='nova'", [id]
        );
        if (!rows.length)
            return res.status(404).json({ error: 'Solicitação não encontrada ou já processada' });
        const sol = rows[0];
        let result;
        try {
            [result] = await pool.execute(
                `INSERT INTO servicos (titulo,cliente_setor,prioridade,data_servico,descricao,relatorio,status,criado_por,usuario_id)
                 VALUES (?,?,?,?,?,'','pending',?,?)`,
                [sol.titulo, sol.cliente_setor, prioridade, sol.data_solicitacao,
                 `[O.S. ${sol.numero_so}] ${sol.descricao}`, nomeUsr, idUsr]
            );
        } catch(e2) {
            [result] = await pool.execute(
                `INSERT INTO servicos (titulo,cliente_setor,prioridade,data_servico,descricao,relatorio,status)
                 VALUES (?,?,?,?,?,'','pending')`,
                [sol.titulo, sol.cliente_setor, prioridade, sol.data_solicitacao,
                 `[O.S. ${sol.numero_so}] ${sol.descricao}`]
            );
        }
        await pool.execute(
            `UPDATE solicitacoes SET status='salvo', prioridade=?, servico_id=? WHERE id=?`,
            [prioridade, result.insertId, id]
        );
        await logActivity('services', 'add',
            `Serviço criado via O.S. ${sol.numero_so}: ${sol.titulo}`, nomeUsr, idUsr, null);
        res.json({ success: true, servico_id: result.insertId });
    } catch (err) {
        console.error('Erro ao salvar serviço:', err.message);
        res.status(500).json({ error: 'Erro ao salvar como serviço', detail: err.message });
    }
});

// Excluir solicitação (soft delete) — requer auth
app.delete('/api/solicitacoes/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const nomeUsr = getUserNome(req);
    const idUsr   = getUserId(req);
    try {
        const [rows] = await pool.execute('SELECT numero_so, titulo FROM solicitacoes WHERE id=?', [id]);
        await pool.execute("UPDATE solicitacoes SET status='excluido', excluido_por=? WHERE id=?", [nomeUsr, id]);
        if (rows[0]) {
            await logActivity('services', 'delete',
                'O.S. excluída: ' + rows[0].numero_so + ' — ' + rows[0].titulo,
                nomeUsr, idUsr, null);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Erro ao excluir solicitação' }); }
});

// ==========================================
// MIGRAÇÃO DA TABELA SOLICITACOES
// Já inclusa no runMigrations() abaixo
// ==========================================

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;

// Migrate FIRST, then start server — ensures columns exist before any request
async function startServer() {
    try {
        const conn = await pool.getConnection();
        console.log('Conectado ao MySQL (Railway)');
        conn.release();
        await runMigrations();
        // Pré-aquecer cache do logActivity após migração
        _atividadesColsVerified = true;
        _atividadesHasExtras    = true; // migração garante que as colunas existem
    } catch (err) {
        console.error('Banco indisponível no boot:', err.message);
        // Start anyway — health check must respond
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log('Setor de TI rodando na porta ' + PORT);
    });
}

startServer();
