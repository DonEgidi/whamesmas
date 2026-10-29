const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer memory storage for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

// ==========================================
// WhatsApp Client Management
// ==========================================
let waClient = null;
let waStatus = 'INITIALIZING'; // 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED' | 'AUTH_FAILURE'
let latestQrDataUrl = null;
let waUserInfo = null;

function emitStatus() {
    io.emit('wa_status', {
        status: waStatus,
        qr: latestQrDataUrl,
        user: waUserInfo
    });
}

function initWhatsAppClient() {
    console.log('[WhatsApp] Iniciando cliente WhatsApp Web...');
    waStatus = 'INITIALIZING';
    latestQrDataUrl = null;
    emitStatus();

    waClient = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    waClient.on('qr', async (qr) => {
        console.log('[WhatsApp] Código QR generado');
        try {
            latestQrDataUrl = await QRCode.toDataURL(qr, { width: 340, margin: 2 });
            waStatus = 'QR_READY';
            emitStatus();
            io.emit('log', { level: 'info', text: 'Nuevo código QR generado. Escanéalo con WhatsApp.' });
        } catch (err) {
            console.error('[WhatsApp] Error generando QR DataURL:', err);
        }
    });

    waClient.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado exitosamente');
        waStatus = 'AUTHENTICATED';
        latestQrDataUrl = null;
        emitStatus();
        io.emit('log', { level: 'success', text: 'Sesión autenticada correctamente.' });
    });

    waClient.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Fallo de autenticación:', msg);
        waStatus = 'AUTH_FAILURE';
        latestQrDataUrl = null;
        emitStatus();
        io.emit('log', { level: 'error', text: `Fallo de autenticación: ${msg}` });
    });

    waClient.on('ready', async () => {
        console.log('[WhatsApp] Cliente listo para enviar mensajes');
        waStatus = 'READY';
        latestQrDataUrl = null;
        const info = waClient.info;
        waUserInfo = {
            pushname: info?.pushname || 'Usuario',
            phone: info?.wid?.user || '',
            wid: info?.wid?._serialized || ''
        };
        emitStatus();
        io.emit('log', {
            level: 'success',
            text: `WhatsApp conectado como ${waUserInfo.pushname} (+${waUserInfo.phone})`
        });
    });

    waClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] Desconectado:', reason);
        waStatus = 'DISCONNECTED';
        latestQrDataUrl = null;
        waUserInfo = null;
        emitStatus();
        io.emit('log', { level: 'warn', text: `WhatsApp desconectado: ${reason}` });
    });

    waClient.initialize().catch((err) => {
        console.error('[WhatsApp] Error inicializando cliente:', err);
        waStatus = 'DISCONNECTED';
        emitStatus();
    });
}

// Start WA Client at boot
initWhatsAppClient();

// ==========================================
// Phone Number Utilities & Normalization
// ==========================================
function cleanDigits(phone) {
    if (phone === null || phone === undefined) return '';
    let str = String(phone).trim();
    // Remove Excel float artifact (e.g. 5492477637956.0)
    if (/^\d+\.0+$/.test(str)) {
        str = str.replace(/\.0+$/, '');
    }
    // Handle scientific notation e.g. 5.492477637956e+12
    if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
        try {
            str = BigInt(Math.round(Number(str))).toString();
        } catch (e) {
            str = str.replace(/\D/g, '');
        }
    }
    // Strip all non-numeric characters (hyphens, spaces, parens, slashes, plus signs)
    return str.replace(/\D/g, '');
}

/**
 * Normalizes phone numbers with country code rules
 */
function normalizePhoneNumber(rawNumber, defaultPrefix = '549') {
    let digits = cleanDigits(rawNumber);
    if (!digits) return '';

    // Remove leading zeros (e.g. 02477 -> 2477, 011 -> 11)
    if (digits.startsWith('0')) {
        digits = digits.replace(/^0+/, '');
    }

    const prefix = cleanDigits(defaultPrefix);

    // Specific rules for Argentina (prefix 549 or 54)
    if (prefix === '549' || prefix === '54' || digits.startsWith('549') || (digits.startsWith('54') && digits.length > 10)) {
        // If it starts with 54 but not 549 (e.g. 5411...)
        if (digits.startsWith('54') && !digits.startsWith('549')) {
            digits = '549' + digits.slice(2);
        } else if (!digits.startsWith('549')) {
            digits = '549' + digits;
        }

        // Handle local "15" in Argentina:
        // WhatsApp expects 549 + Area Code + Number (WITHOUT 15).
        // e.g., 549 2477 15 637956 -> 549 2477 637956
        const afterPrefix = digits.slice(3); // e.g. 247715637956 or 111512345678
        // Buenos Aires 11:
        if (afterPrefix.startsWith('1115') && afterPrefix.length === 12) {
            digits = '54911' + afterPrefix.slice(4);
        } else if (afterPrefix.length >= 11) {
            // Check for area code (2, 3, or 4 digits) followed by 15
            for (let codeLen of [2, 3, 4]) {
                const area = afterPrefix.slice(0, codeLen);
                const rest = afterPrefix.slice(codeLen);
                if (rest.startsWith('15') && rest.length >= 8) {
                    digits = '549' + area + rest.slice(2);
                    break;
                }
            }
        }
        return digits;
    }

    // Generic prefix application: if digits doesn't start with prefix, prepend it
    if (prefix && !digits.startsWith(prefix)) {
        digits = prefix + digits;
    }

    return digits;
}


/**
 * Resolves whether number is on WhatsApp and retrieves its canonical JID
 */
async function resolveWhatsAppJid(client, cleanNumber) {
    if (!client) {
        throw new Error('Cliente de WhatsApp no inicializado');
    }

    try {
        // Run with a 6-second timeout so it never hangs if WhatsApp Web is syncing
        const numberDetails = await Promise.race([
            client.getNumberId(cleanNumber),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de verificación (6s)')), 6000))
        ]);

        if (numberDetails && numberDetails._serialized) {
            return {
                registered: true,
                jid: numberDetails._serialized,
                user: numberDetails.user
            };
        }
        return {
            registered: false,
            jid: null,
            user: cleanNumber
        };
    } catch (err) {
        console.warn(`[WA JID] Falló o demoró verificación de ${cleanNumber} (${err.message}). Usando formato directo.`);
        // Fallback: assume registered with standard format
        return {
            registered: true,
            jid: `${cleanNumber}@c.us`,
            user: cleanNumber
        };
    }
}

/**
 * Extract phone number from contact row, checking preferred column first
 * and then fuzzy-matching any phone-related column (plural, case-insensitive, etc.)
 */
function extractContactPhone(contact, preferredCol) {
    if (!contact) return '';
    // 1. Exact match with preferredCol
    if (preferredCol && contact[preferredCol] !== undefined && contact[preferredCol] !== null && String(contact[preferredCol]).trim() !== '') {
        return String(contact[preferredCol]).trim();
    }
    // 2. Case-insensitive match on preferredCol
    if (preferredCol) {
        const lowerPref = preferredCol.toLowerCase().trim();
        for (const [k, v] of Object.entries(contact)) {
            if (k.toLowerCase().trim() === lowerPref && v !== undefined && v !== null && String(v).trim() !== '') {
                return String(v).trim();
            }
        }
    }
    // 3. Known phone header names (telefonos, telefono, cel, celular, etc.)
    for (const [k, v] of Object.entries(contact)) {
        if (/^(telefonos?|teléfonos?|celulares?|phones?|numeros?|números?|mobile|whatsapp)$/i.test(k.trim()) && v) {
            return String(v).trim();
        }
    }
    // 4. Any header containing 'tel' or 'cel' or 'phone' or 'num'
    for (const [k, v] of Object.entries(contact)) {
        if (/tel|cel|phone|num/i.test(k) && v) {
            return String(v).trim();
        }
    }
    // 5. Any field that looks like a phone number (6 to 15 digits)
    for (const [k, v] of Object.entries(contact)) {
        if (typeof v === 'string' || typeof v === 'number') {
            const digits = String(v).replace(/\D/g, '');
            if (digits.length >= 7 && digits.length <= 15) {
                return String(v).trim();
            }
        }
    }
    return '';
}

/**
 * Extract name from contact row
 */
function extractContactName(contact, preferredCol) {
    if (!contact) return '';
    if (preferredCol && contact[preferredCol]) return String(contact[preferredCol]).trim();
    for (const [k, v] of Object.entries(contact)) {
        if (/^(nombres?|names?|contactos?|clientes?|destinatarios?)$/i.test(k.trim()) && v) {
            return String(v).trim();
        }
    }
    return '';
}

/**
 * Replace {variable} in template with contact properties
 */
function interpolateVariables(template, contact) {
    if (!template) return '';
    return template.replace(/\{([^{}]+)\}/g, (match, rawKey) => {
        const key = rawKey.trim();
        // Exact match
        if (contact[key] !== undefined && contact[key] !== null) {
            return String(contact[key]);
        }
        // Case-insensitive match
        const lowerKey = key.toLowerCase();
        for (const [k, v] of Object.entries(contact)) {
            if (k.toLowerCase() === lowerKey && v !== undefined && v !== null) {
                return String(v);
            }
        }
        return match;
    });
}

// ==========================================
// Campaign Manager State
// ==========================================
let campaignState = 'IDLE'; // 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED'
let currentCampaign = null;
let pausePromiseResolve = null;
let isStopping = false;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWithCountdown(seconds, onTick) {
    let remaining = seconds;
    while (remaining > 0) {
        if (isStopping || campaignState === 'STOPPED') break;
        if (campaignState === 'PAUSED') {
            await new Promise((resolve) => { pausePromiseResolve = resolve; });
            pausePromiseResolve = null;
            if (isStopping || campaignState === 'STOPPED') break;
        }
        if (onTick) onTick(remaining);
        await sleep(1000);
        remaining--;
    }
    if (onTick) onTick(0);
}

async function runCampaign() {
    if (!currentCampaign) return;

    campaignState = 'RUNNING';
    isStopping = false;
    io.emit('campaign_state', { state: campaignState });
    io.emit('log', { level: 'info', text: `Iniciando campaña con ${currentCampaign.contacts.length} contactos.` });

    const { contacts, messageTemplate, settings } = currentCampaign;
    const minDelay = Math.max(1, parseInt(settings.minDelay, 10) || 10);
    const maxDelay = Math.max(minDelay, parseInt(settings.maxDelay, 10) || 25);
    const defaultPrefix = settings.defaultPrefix || '';
    const phoneColumn = settings.phoneColumn || 'telefono';

    for (let i = 0; i < contacts.length; i++) {
        if (isStopping || campaignState === 'STOPPED') {
            console.log('[Campaign] Campaña detenida por el usuario.');
            io.emit('log', { level: 'warn', text: 'Campaña detenida manualmente.' });
            break;
        }

        // Handle PAUSED state
        if (campaignState === 'PAUSED') {
            io.emit('log', { level: 'info', text: 'Campaña en pausa. Esperando reanudación...' });
            await new Promise((resolve) => { pausePromiseResolve = resolve; });
            pausePromiseResolve = null;
            if (isStopping || campaignState === 'STOPPED') break;
        }

        const contact = contacts[i];
        const rawPhone = extractContactPhone(contact, phoneColumn);
        const contactName = extractContactName(contact, settings.nameColumn);
        const normalizedPhone = normalizePhoneNumber(rawPhone, defaultPrefix);

        currentCampaign.progress.currentIndex = i;
        currentCampaign.progress.currentPhone = normalizedPhone;

        const personalizedMessage = interpolateVariables(messageTemplate, contact);

        io.emit('campaign_progress', {
            index: i,
            total: contacts.length,
            contact,
            phone: normalizedPhone,
            message: personalizedMessage,
            status: 'SENDING',
            counts: currentCampaign.progress
        });

        // Validation
        if (!normalizedPhone || normalizedPhone.length < 8) {
            currentCampaign.progress.failed++;
            const resultItem = {
                index: i + 1,
                phone: rawPhone || 'Vacío',
                name: contact.nombre || contact.Nombre || '',
                status: 'ERROR',
                message: 'Número de teléfono inválido o vacío',
                timestamp: new Date().toLocaleTimeString()
            };
            currentCampaign.results.push(resultItem);
            io.emit('contact_result', resultItem);
            io.emit('log', {
                level: 'error',
                text: `[${i + 1}/${contacts.length}] Número inválido (${rawPhone}). Saltando.`
            });
            continue;
        }

        // WhatsApp Registration Check
        try {
            const jidResult = await resolveWhatsAppJid(waClient, normalizedPhone);

            if (!jidResult.registered) {
                currentCampaign.progress.unregistered++;
                const resultItem = {
                    index: i + 1,
                    phone: normalizedPhone,
                    name: contactName || '',
                    status: 'UNREGISTERED',
                    message: 'No está registrado en WhatsApp',
                    timestamp: new Date().toLocaleTimeString()
                };
                currentCampaign.results.push(resultItem);
                io.emit('contact_result', resultItem);
                io.emit('log', {
                    level: 'warn',
                    text: `[${i + 1}/${contacts.length}] ${normalizedPhone}: No tiene cuenta de WhatsApp activa.`
                });
                // Small sleep before next contact
                await sleep(1500);
                continue;
            }

            // Send WhatsApp message
            console.log(`[Campaign] Enviando a ${jidResult.jid}...`);
            await Promise.race([
                waClient.sendMessage(jidResult.jid, personalizedMessage),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout enviando mensaje (25s)')), 25000))
            ]);

            currentCampaign.progress.sent++;
            const resultItem = {
                index: i + 1,
                phone: normalizedPhone,
                name: contactName || '',
                status: 'SENT',
                message: 'Enviado exitosamente',
                timestamp: new Date().toLocaleTimeString()
            };
            currentCampaign.results.push(resultItem);
            io.emit('contact_result', resultItem);
            io.emit('log', {
                level: 'success',
                text: `[${i + 1}/${contacts.length}] Enviado con éxito a +${normalizedPhone}`
            });

        } catch (sendErr) {
            console.error(`[Campaign] Error enviando a ${normalizedPhone}:`, sendErr);
            currentCampaign.progress.failed++;
            const resultItem = {
                index: i + 1,
                phone: normalizedPhone,
                name: contact.nombre || contact.Nombre || '',
                status: 'ERROR',
                message: sendErr.message || 'Error desconocido al enviar',
                timestamp: new Date().toLocaleTimeString()
            };
            currentCampaign.results.push(resultItem);
            io.emit('contact_result', resultItem);
            io.emit('log', {
                level: 'error',
                text: `[${i + 1}/${contacts.length}] Error enviando a +${normalizedPhone}: ${sendErr.message}`
            });
        }

        // Delay countdown if not the last item
        if (i < contacts.length - 1 && !isStopping && campaignState !== 'STOPPED') {
            const delaySec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            io.emit('log', {
                level: 'info',
                text: `Pausa anti-baneo: esperando ${delaySec}s antes del próximo envío...`
            });
            await waitWithCountdown(delaySec, (remaining) => {
                io.emit('delay_countdown', { remaining, total: delaySec });
            });
        }
    }

    if (!isStopping && campaignState !== 'STOPPED') {
        campaignState = 'COMPLETED';
        io.emit('log', {
            level: 'success',
            text: `¡Campaña finalizada! Enviados: ${currentCampaign.progress.sent}, Sin WhatsApp: ${currentCampaign.progress.unregistered}, Errores: ${currentCampaign.progress.failed}.`
        });
    }

    io.emit('campaign_state', { state: campaignState });
    io.emit('delay_countdown', { remaining: 0, total: 0 });
}

// ==========================================
// REST API Endpoints
// ==========================================

// Get current system status
app.get('/api/status', (req, res) => {
    res.json({
        waStatus,
        qr: latestQrDataUrl,
        user: waUserInfo,
        campaignState,
        campaign: currentCampaign ? {
            progress: currentCampaign.progress,
            total: currentCampaign.contacts?.length || 0,
            results: currentCampaign.results
        } : null
    });
});

// Restart WhatsApp Client
app.post('/api/whatsapp/restart', async (req, res) => {
    try {
        if (waClient) {
            await waClient.destroy().catch(() => {});
        }
        initWhatsAppClient();
        res.json({ success: true, message: 'Cliente reiniciado con éxito' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Logout WhatsApp Client
app.post('/api/whatsapp/logout', async (req, res) => {
    try {
        if (waClient) {
            await waClient.logout().catch(() => {});
            await waClient.destroy().catch(() => {});
        }
        // Remove saved session
        const authPath = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
        initWhatsAppClient();
        res.json({ success: true, message: 'Sesión cerrada correctamente' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// File Upload: parse Excel (.xlsx, .xls) and CSV
app.post('/api/upload-contacts', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío o no contiene filas de datos' });
        }

        // Sanitize values
        rawJson.forEach((row) => {
            Object.keys(row).forEach((col) => {
                let val = row[col];
                if (typeof val === 'number') {
                    val = String(val);
                } else if (typeof val === 'string') {
                    val = val.trim();
                }
                row[col] = val;
            });
        });

        // Discover columns from all rows
        const columnsSet = new Set();
        rawJson.forEach((row) => {
            Object.keys(row).forEach((col) => columnsSet.add(col.trim()));
        });
        const columns = Array.from(columnsSet);

        // Detect default phone column
        let detectedPhoneCol = columns.find((c) =>
            /telefono|teléfono|celular|phone|numero|número|whatsapp|mobile/i.test(c)
        ) || columns[0];

        // Detect default name column
        let detectedNameCol = columns.find((c) =>
            /nombre|name|contacto|cliente|destinatario/i.test(c)
        ) || (columns.length > 1 ? columns[1] : columns[0]);

        res.json({
            success: true,
            filename: req.file.originalname,
            rowCount: rawJson.length,
            columns,
            detectedPhoneCol,
            detectedNameCol,
            preview: rawJson.slice(0, 10),
            allRows: rawJson
        });
    } catch (err) {
        console.error('Error procesando archivo:', err);
        res.status(500).json({ error: 'Error al leer el archivo: ' + err.message });
    }
});

// Check available excel/csv files in project folder
app.get('/api/workspace-files', (req, res) => {
    try {
        const files = fs.readdirSync(__dirname)
            .filter((f) => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith('~$'));
        res.json({ files });
    } catch (err) {
        res.json({ files: [] });
    }
});

// Load a workspace file directly
app.post('/api/load-workspace-file', (req, res) => {
    try {
        const filename = req.body.filename || 'WhatsApp Contactos.xlsx';
        const filePath = path.join(__dirname, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `El archivo "${filename}" no existe en la carpeta.` });
        }

        const workbook = XLSX.readFile(filePath);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rawJson || rawJson.length === 0) {
            return res.status(400).json({ error: 'El archivo está vacío' });
        }

        rawJson.forEach((row) => {
            Object.keys(row).forEach((col) => {
                let val = row[col];
                if (typeof val === 'number') val = String(val);
                else if (typeof val === 'string') val = val.trim();
                row[col] = val;
            });
        });

        const columnsSet = new Set();
        rawJson.forEach((row) => Object.keys(row).forEach((col) => columnsSet.add(col.trim())));
        const columns = Array.from(columnsSet);

        const detectedPhoneCol = columns.find((c) =>
            /^(telefonos?|teléfonos?|celulares?|phones?|numeros?|números?|mobile|whatsapp)$/i.test(c.trim())
        ) || columns.find((c) => /tel|cel|phone|num/i.test(c)) || columns[0];

        const detectedNameCol = columns.find((c) =>
            /^(nombres?|names?|contacto|cliente)/i.test(c.trim())
        ) || (columns.length > 1 ? columns[1] : columns[0]);

        res.json({
            success: true,
            filename,
            rowCount: rawJson.length,
            columns,
            detectedPhoneCol,
            detectedNameCol,
            preview: rawJson.slice(0, 10),
            allRows: rawJson
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send a single test message
app.post('/api/test-message', async (req, res) => {
    try {
        if (waStatus !== 'READY' || !waClient) {
            return res.status(400).json({ error: 'WhatsApp no está conectado todavía' });
        }

        const { phone, message, defaultPrefix } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Faltan el teléfono o el mensaje' });
        }

        const normalized = normalizePhoneNumber(phone, defaultPrefix);
        const jidInfo = await resolveWhatsAppJid(waClient, normalized);

        if (!jidInfo.registered) {
            return res.status(400).json({
                error: `El número +${normalized} no está registrado en WhatsApp`
            });
        }

        await Promise.race([
            waClient.sendMessage(jidInfo.jid, message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al enviar mensaje de prueba (25s)')), 25000))
        ]);
        res.json({ success: true, message: `Mensaje de prueba enviado a +${normalized}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Campaign
app.post('/api/campaign/start', async (req, res) => {
    try {
        if (waStatus !== 'READY' || !waClient) {
            return res.status(400).json({ error: 'WhatsApp no está conectado' });
        }

        if (campaignState === 'RUNNING') {
            return res.status(400).json({ error: 'Ya hay una campaña en ejecución' });
        }

        const { contacts, messageTemplate, settings } = req.body;

        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ error: 'La lista de contactos está vacía' });
        }

        if (!messageTemplate || !messageTemplate.trim()) {
            return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
        }

        currentCampaign = {
            id: 'camp_' + Date.now(),
            contacts,
            messageTemplate,
            settings: settings || {},
            progress: {
                total: contacts.length,
                currentIndex: 0,
                currentPhone: '',
                sent: 0,
                unregistered: 0,
                failed: 0
            },
            results: []
        };

        // Start asynchronously
        runCampaign();

        res.json({ success: true, campaignId: currentCampaign.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pause Campaign
app.post('/api/campaign/pause', (req, res) => {
    if (campaignState !== 'RUNNING') {
        return res.status(400).json({ error: 'No hay ninguna campaña activa para pausar' });
    }
    campaignState = 'PAUSED';
    io.emit('campaign_state', { state: campaignState });
    io.emit('log', { level: 'info', text: 'Campaña pausada por el usuario.' });
    res.json({ success: true });
});

// Resume Campaign
app.post('/api/campaign/resume', (req, res) => {
    if (campaignState !== 'PAUSED') {
        return res.status(400).json({ error: 'La campaña no está pausada' });
    }
    campaignState = 'RUNNING';
    if (pausePromiseResolve) {
        pausePromiseResolve();
    }
    io.emit('campaign_state', { state: campaignState });
    io.emit('log', { level: 'info', text: 'Campaña reanudada.' });
    res.json({ success: true });
});

// Stop Campaign
app.post('/api/campaign/stop', (req, res) => {
    if (campaignState !== 'RUNNING' && campaignState !== 'PAUSED') {
        return res.status(400).json({ error: 'No hay campaña en ejecución para detener' });
    }
    isStopping = true;
    campaignState = 'STOPPED';
    if (pausePromiseResolve) {
        pausePromiseResolve();
    }
    io.emit('campaign_state', { state: campaignState });
    io.emit('log', { level: 'warn', text: 'Campaña detenida por el usuario.' });
    res.json({ success: true });
});

// Download sample Excel template
app.get('/api/download-template', (req, res) => {
    const sampleData = [
        {
            Telefono: '+54 9 2477 63-7956',
            Nombre: 'Agustín',
            Empresa: 'Pergamino Agro',
            Monto: '$15.000',
            Vencimiento: '10/11/2026'
        },
        {
            Telefono: '(011) 15-9988-7766',
            Nombre: 'Maria Garcia',
            Empresa: 'Estudio Creativo',
            Monto: '$24.500',
            Vencimiento: '15/11/2026'
        },
        {
            Telefono: '2477 63-7956',
            Nombre: 'Carlos Lopez',
            Empresa: 'Distribuidora Norte',
            Monto: '$8.200',
            Vencimiento: '12/11/2026'
        }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_contactos.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

// Socket.io connection
io.on('connection', (socket) => {
    // Send immediate initial state
    socket.emit('wa_status', {
        status: waStatus,
        qr: latestQrDataUrl,
        user: waUserInfo
    });
    socket.emit('campaign_state', { state: campaignState });
    if (currentCampaign) {
        socket.emit('campaign_sync', {
            progress: currentCampaign.progress,
            results: currentCampaign.results
        });
    }
});

// Start HTTP server
server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 WP Sender Pro iniciado en: http://localhost:${PORT}`);
    console.log(`===============================================`);
});
