// ========================================================
// WhatsSender PRO - Client Application Logic
// ========================================================

document.addEventListener('DOMContentLoaded', () => {
    // State
    let socket = null;
    let waStatus = 'INITIALIZING';
    let currentContacts = [];
    let currentColumns = [];
    let campaignResults = [];
    let selectedContactIndex = 0;
    let confirmCallback = null;

    // DOM Elements - Status & Session
    const waStatusBadge = document.getElementById('waStatusBadge');
    const waStatusText = document.getElementById('waStatusText');
    const btnShowQr = document.getElementById('btnShowQr');
    const btnSessionMenu = document.getElementById('btnSessionMenu');
    const sessionDropdownMenu = document.getElementById('sessionDropdownMenu');
    const btnRestartClient = document.getElementById('btnRestartClient');
    const btnLogoutClient = document.getElementById('btnLogoutClient');

    // Modals
    const qrModal = document.getElementById('qrModal');
    const btnCloseQrModal = document.getElementById('btnCloseQrModal');
    const qrImageWrapper = document.getElementById('qrImageWrapper');
    const qrCodeImg = document.getElementById('qrCodeImg');
    const qrSpinner = document.getElementById('qrSpinner');

    const confirmModal = document.getElementById('confirmModal');
    const confirmModalTitle = document.getElementById('confirmModalTitle');
    const confirmModalMessage = document.getElementById('confirmModalMessage');
    const confirmModalDetails = document.getElementById('confirmModalDetails');
    const btnConfirmCancel = document.getElementById('btnConfirmCancel');
    const btnCancelConfirm = document.getElementById('btnCancelConfirm');
    const btnConfirmProceed = document.getElementById('btnConfirmProceed');
    const btnConfirmProceedText = document.getElementById('btnConfirmProceedText');

    const toastContainer = document.getElementById('toastContainer');

    // Cards
    const cardContacts = document.getElementById('cardContacts');
    const cardMessage = document.getElementById('cardMessage');
    const cardSettings = document.getElementById('cardSettings');

    // Tabs & File Input
    const tabUploadFileBtn = document.getElementById('tabUploadFileBtn');
    const tabManualInputBtn = document.getElementById('tabManualInputBtn');
    const tabUpload = document.getElementById('tabUpload');
    const tabManual = document.getElementById('tabManual');
    const fileDropzone = document.getElementById('fileDropzone');
    const contactFileInput = document.getElementById('contactFileInput');
    const manualNumbersInput = document.getElementById('manualNumbersInput');
    const btnProcessManual = document.getElementById('btnProcessManual');

    // Column Mapping & File Meta
    const fileLoadedArea = document.getElementById('fileLoadedArea');
    const loadedFileName = document.getElementById('loadedFileName');
    const loadedRowCount = document.getElementById('loadedRowCount');
    const btnClearFile = document.getElementById('btnClearFile');
    const selectPhoneCol = document.getElementById('selectPhoneCol');
    const selectCountryPrefix = document.getElementById('selectCountryPrefix');

    // Message Editor & Variable Chips
    const variableChipsContainer = document.getElementById('variableChipsContainer');
    const messageTemplateInput = document.getElementById('messageTemplateInput');
    const charCount = document.getElementById('charCount');

    // Preview
    const previewContactSelect = document.getElementById('previewContactSelect');
    const waPreviewName = document.getElementById('waPreviewName');
    const waPreviewPhone = document.getElementById('waPreviewPhone');
    const waBubbleContent = document.getElementById('waBubbleContent');
    const waBubbleTime = document.getElementById('waBubbleTime');

    // Settings & Test
    const minDelayInput = document.getElementById('minDelayInput');
    const maxDelayInput = document.getElementById('maxDelayInput');
    const testPhoneInput = document.getElementById('testPhoneInput');
    const btnSendTestMessage = document.getElementById('btnSendTestMessage');

    // Campaign Controls & Monitoring
    const campaignBadgeState = document.getElementById('campaignBadgeState');
    const btnStartCampaign = document.getElementById('btnStartCampaign');
    const btnPauseCampaign = document.getElementById('btnPauseCampaign');
    const btnResumeCampaign = document.getElementById('btnResumeCampaign');
    const btnStopCampaign = document.getElementById('btnStopCampaign');
    const progressPercent = document.getElementById('progressPercent');
    const progressBarFill = document.getElementById('progressBarFill');
    const countdownBox = document.getElementById('countdownBox');
    const countdownSeconds = document.getElementById('countdownSeconds');

    const metricTotal = document.getElementById('metricTotal');
    const metricSent = document.getElementById('metricSent');
    const metricUnregistered = document.getElementById('metricUnregistered');
    const metricFailed = document.getElementById('metricFailed');

    const resultsTableBody = document.getElementById('resultsTableBody');
    const btnExportCsv = document.getElementById('btnExportCsv');
    const logsTerminal = document.getElementById('logsTerminal');
    const btnClearLogs = document.getElementById('btnClearLogs');

    // Set preview current time
    const now = new Date();
    waBubbleTime.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    // ==========================================
    // Custom Toast Notification System
    // ==========================================
    function showToast(title, message, type = 'info', duration = 6000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconSvg = {
            error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        }[type] || '';

        toast.innerHTML = `
            ${iconSvg}
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-body">${message}</div>
            </div>
            <button class="toast-close-btn">&times;</button>
        `;

        toast.querySelector('.toast-close-btn').addEventListener('click', () => {
            dismissToast(toast);
        });

        toastContainer.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => {
                dismissToast(toast);
            }, duration);
        }
    }

    function dismissToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
    }

    function highlightCardError(cardElement, title, message) {
        cardElement.classList.remove('card-error');
        // Force reflow
        void cardElement.offsetWidth;
        cardElement.classList.add('card-error');
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(title, message, 'warning', 7000);
        appendLog('warn', `[Validación] ${title}: ${message}`);
        setTimeout(() => {
            cardElement.classList.remove('card-error');
        }, 3000);
    }

    // ==========================================
    // Custom Confirmation Modal
    // ==========================================
    function showConfirmModal({ title, message, details = '', buttonText = 'Confirmar', onConfirm }) {
        confirmModalTitle.textContent = title;
        confirmModalMessage.textContent = message;

        if (details) {
            confirmModalDetails.innerHTML = details;
            confirmModalDetails.classList.remove('hidden');
        } else {
            confirmModalDetails.classList.add('hidden');
        }

        btnConfirmProceedText.textContent = buttonText;
        confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
    }

    function closeConfirmModal() {
        confirmModal.classList.add('hidden');
        confirmCallback = null;
    }

    btnConfirmCancel.addEventListener('click', closeConfirmModal);
    btnCancelConfirm.addEventListener('click', closeConfirmModal);

    btnConfirmProceed.addEventListener('click', () => {
        const cb = confirmCallback;
        closeConfirmModal();
        if (typeof cb === 'function') cb();
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
    });

    // Escape listener for all modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!confirmModal.classList.contains('hidden')) closeConfirmModal();
            if (!qrModal.classList.contains('hidden')) qrModal.classList.add('hidden');
        }
    });

    // ==========================================
    // Socket.io Connection & Events
    // ==========================================
    function setupSocket() {
        socket = io();

        socket.on('connect', () => {
            appendLog('info', '[Socket] Conectado al servidor en tiempo real.');
        });

        socket.on('wa_status', (data) => {
            waStatus = data.status;
            updateWaStatusUI(data);
        });

        socket.on('campaign_state', (data) => {
            updateCampaignStateUI(data.state);
        });

        socket.on('campaign_progress', (data) => {
            updateCampaignProgressUI(data);
        });

        socket.on('contact_result', (result) => {
            addResultRow(result);
            campaignResults.push(result);
            btnExportCsv.disabled = false;
        });

        socket.on('delay_countdown', (data) => {
            if (data.remaining > 0) {
                countdownBox.classList.remove('hidden');
                countdownSeconds.textContent = data.remaining;
            } else {
                countdownBox.classList.add('hidden');
            }
        });

        socket.on('campaign_sync', (data) => {
            if (data.progress) {
                metricTotal.textContent = data.progress.total || 0;
                metricSent.textContent = data.progress.sent || 0;
                metricUnregistered.textContent = data.progress.unregistered || 0;
                metricFailed.textContent = data.progress.failed || 0;
            }
            if (data.results && data.results.length > 0) {
                campaignResults = data.results;
                resultsTableBody.innerHTML = '';
                data.results.forEach(addResultRow);
                btnExportCsv.disabled = false;
            }
        });

        socket.on('log', (data) => {
            appendLog(data.level, data.text);
        });
    }

    function updateWaStatusUI(data) {
        waStatusBadge.className = 'status-badge';

        switch (data.status) {
            case 'INITIALIZING':
                waStatusBadge.classList.add('status-initializing');
                waStatusText.textContent = 'Iniciando WhatsApp...';
                break;
            case 'QR_READY':
                waStatusBadge.classList.add('status-qr');
                waStatusText.textContent = 'Escanear Código QR';
                if (data.qr) {
                    qrCodeImg.src = data.qr;
                    qrSpinner.classList.add('hidden');
                    qrImageWrapper.classList.remove('hidden');
                }
                break;
            case 'AUTHENTICATED':
                waStatusBadge.classList.add('status-initializing');
                waStatusText.textContent = 'Autenticado, sincronizando...';
                qrModal.classList.add('hidden');
                break;
            case 'READY':
                waStatusBadge.classList.add('status-ready');
                const name = data.user?.pushname || 'Usuario';
                const phone = data.user?.phone ? `(+${data.user.phone})` : '';
                waStatusText.textContent = `Conectado: ${name} ${phone}`;
                qrModal.classList.add('hidden');
                break;
            case 'AUTH_FAILURE':
            case 'DISCONNECTED':
            default:
                waStatusBadge.classList.add('status-disconnected');
                waStatusText.textContent = 'WhatsApp Desconectado';
                break;
        }
    }

    function updateCampaignStateUI(state) {
        campaignBadgeState.className = 'badge';
        campaignBadgeState.classList.add('badge-' + state.toLowerCase());
        campaignBadgeState.textContent = state;

        switch (state) {
            case 'RUNNING':
                btnStartCampaign.classList.add('hidden');
                btnPauseCampaign.classList.remove('hidden');
                btnResumeCampaign.classList.add('hidden');
                btnStopCampaign.classList.remove('hidden');
                break;
            case 'PAUSED':
                btnStartCampaign.classList.add('hidden');
                btnPauseCampaign.classList.add('hidden');
                btnResumeCampaign.classList.remove('hidden');
                btnStopCampaign.classList.remove('hidden');
                break;
            case 'STOPPED':
            case 'COMPLETED':
            case 'IDLE':
            default:
                btnStartCampaign.classList.remove('hidden');
                btnPauseCampaign.classList.add('hidden');
                btnResumeCampaign.classList.add('hidden');
                btnStopCampaign.classList.add('hidden');
                countdownBox.classList.add('hidden');
                break;
        }
    }

    function updateCampaignProgressUI(data) {
        const total = data.total || 1;
        const current = (data.index + 1);
        const percent = Math.min(100, Math.round((current / total) * 100));

        progressPercent.textContent = `${percent}% (${current}/${total})`;
        progressBarFill.style.width = `${percent}%`;

        if (data.counts) {
            metricTotal.textContent = total;
            metricSent.textContent = data.counts.sent;
            metricUnregistered.textContent = data.counts.unregistered;
            metricFailed.textContent = data.counts.failed;
        }
    }

    function addResultRow(item) {
        if (resultsTableBody.querySelector('.empty-row')) {
            resultsTableBody.innerHTML = '';
        }

        const tr = document.createElement('tr');
        let badgeClass = 'badge-tag';
        let badgeText = item.status;

        if (item.status === 'SENT') {
            badgeClass += ' sent';
            badgeText = 'Enviado';
        } else if (item.status === 'UNREGISTERED') {
            badgeClass += ' unregistered';
            badgeText = 'Sin WhatsApp';
        } else if (item.status === 'ERROR') {
            badgeClass += ' error';
            badgeText = 'Error';
        }

        tr.innerHTML = `
            <td>${item.index || '-'}</td>
            <td><b>+${item.phone}</b></td>
            <td>${item.name || '-'}</td>
            <td><span class="${badgeClass}">${badgeText}</span></td>
            <td>${item.message || '-'}</td>
            <td>${item.timestamp || '-'}</td>
        `;

        resultsTableBody.appendChild(tr);
        const container = resultsTableBody.closest('.table-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function appendLog(level, text) {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${level}`;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${text}`;
        logsTerminal.appendChild(entry);
        logsTerminal.scrollTop = logsTerminal.scrollHeight;
    }

    btnClearLogs.addEventListener('click', () => {
        logsTerminal.innerHTML = '';
    });

    // ==========================================
    // QR Modal & Session Menu
    // ==========================================
    btnShowQr.addEventListener('click', () => {
        qrModal.classList.remove('hidden');
    });

    btnCloseQrModal.addEventListener('click', () => {
        qrModal.classList.add('hidden');
    });

    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) qrModal.classList.add('hidden');
    });

    btnSessionMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        sessionDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        sessionDropdownMenu.classList.add('hidden');
    });

    btnRestartClient.addEventListener('click', () => {
        showConfirmModal({
            title: 'Reiniciar WhatsApp',
            message: '¿Deseas reiniciar la conexión de WhatsApp Web?',
            buttonText: 'Reiniciar',
            onConfirm: async () => {
                try {
                    appendLog('info', 'Reiniciando WhatsApp Web...');
                    const res = await fetch('/api/whatsapp/restart', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        showToast('WhatsApp reiniciado', 'El cliente se reinició correctamente.', 'info');
                    }
                } catch (err) {
                    showToast('Error', err.message, 'error');
                }
            }
        });
    });

    btnLogoutClient.addEventListener('click', () => {
        showConfirmModal({
            title: 'Cerrar Sesión (Desvincular)',
            message: '¿Seguro que deseas desvincular tu cuenta de WhatsApp de este panel?',
            details: 'Se borrarán los datos de autenticación local y deberás escanear el código QR nuevamente.',
            buttonText: 'Desvincular',
            onConfirm: async () => {
                try {
                    appendLog('warn', 'Cerrando sesión de WhatsApp...');
                    const res = await fetch('/api/whatsapp/logout', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        showToast('Sesión cerrada', 'Escanea el nuevo código QR para volver a vincularte.', 'info');
                    }
                } catch (err) {
                    showToast('Error', err.message, 'error');
                }
            }
        });
    });

    // ==========================================
    // Tabs Navigation
    // ==========================================
    tabUploadFileBtn.addEventListener('click', () => {
        tabUploadFileBtn.classList.add('active');
        tabManualInputBtn.classList.remove('active');
        tabUpload.classList.add('active');
        tabManual.classList.remove('active');
    });

    tabManualInputBtn.addEventListener('click', () => {
        tabManualInputBtn.classList.add('active');
        tabUploadFileBtn.classList.remove('active');
        tabManual.classList.add('active');
        tabUpload.classList.remove('active');
    });

    // ==========================================
    // File Upload & Drag and Drop
    // ==========================================
    fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropzone.classList.add('drag-over');
    });

    fileDropzone.addEventListener('dragleave', () => {
        fileDropzone.classList.remove('drag-over');
    });

    fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });

    contactFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    });

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        appendLog('info', `Subiendo y procesando archivo ${file.name}...`);

        try {
            const res = await fetch('/api/upload-contacts', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al procesar el archivo');
            }

            processLoadedContacts(data.allRows, data.columns, data.filename, data.detectedPhoneCol);
            showToast('¡Archivo Cargado!', `Se cargaron ${data.rowCount} contactos desde ${data.filename}`, 'success');
        } catch (err) {
            appendLog('error', `Error cargando archivo: ${err.message}`);
            showToast('Error de archivo', err.message, 'error');
        }
    }

    // ==========================================
    // Manual Input Parsing (Auto-Detect Support)
    // ==========================================
    function parseManualNumbers(showFeedback = true) {
        const text = manualNumbersInput.value.trim();
        if (!text) {
            if (showFeedback) {
                showToast('Campo vacío', 'Por favor escribe o pega al menos un número telefónico.', 'warning');
            }
            return false;
        }

        const lines = text.split('\n');
        const rows = [];

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            // Support "phone, name, details" or just "phone"
            const parts = trimmed.split(/,|;|\t/);
            const phone = parts[0]?.trim() || '';
            const name = parts[1]?.trim() || '';
            if (phone) {
                rows.push({
                    telefono: phone,
                    nombre: name
                });
            }
        });

        if (rows.length === 0) {
            if (showFeedback) {
                showToast('Sin números válidos', 'No se detectaron números telefónicos válidos.', 'warning');
            }
            return false;
        }

        processLoadedContacts(rows, ['telefono', 'nombre'], 'Entrada Manual', 'telefono');
        if (showFeedback) {
            showToast('Contactos cargados', `Se procesaron ${rows.length} contacto(s) correctamente.`, 'success');
        }
        return true;
    }

    btnProcessManual.addEventListener('click', () => {
        parseManualNumbers(true);
    });

    // Auto-parse on blur or after typing in manual input
    let manualInputTimer = null;
    manualNumbersInput.addEventListener('input', () => {
        clearTimeout(manualInputTimer);
        manualInputTimer = setTimeout(() => {
            if (manualNumbersInput.value.trim()) {
                parseManualNumbers(false);
            }
        }, 800);
    });

    // Normalization helper on client
    function clientNormalizePhone(rawNumber, defaultPrefix = '549') {
        if (!rawNumber) return '';
        let str = String(rawNumber).trim();
        if (/^\d+\.0+$/.test(str)) str = str.replace(/\.0+$/, '');
        if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
            try { str = BigInt(Math.round(Number(str))).toString(); } catch(e){}
        }
        let digits = str.replace(/\D/g, '');
        if (!digits) return '';
        if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
        const prefix = String(defaultPrefix || '').replace(/\D/g, '');

        if (prefix === '549' || prefix === '54' || digits.startsWith('549') || (digits.startsWith('54') && digits.length > 10)) {
            if (digits.startsWith('54') && !digits.startsWith('549')) {
                digits = '549' + digits.slice(2);
            } else if (!digits.startsWith('549')) {
                digits = '549' + digits;
            }
            const afterPrefix = digits.slice(3);
            if (afterPrefix.startsWith('1115') && afterPrefix.length === 12) {
                digits = '54911' + afterPrefix.slice(4);
            } else if (afterPrefix.length >= 11) {
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
        if (prefix && !digits.startsWith(prefix)) digits = prefix + digits;
        return digits;
    }

    function processLoadedContacts(rows, columns, fileName, detectedPhoneCol) {
        currentContacts = rows;
        currentColumns = columns;

        loadedFileName.textContent = fileName;
        loadedRowCount.textContent = `${rows.length} contactos`;
        fileLoadedArea.classList.remove('hidden');

        // Populate phone column dropdown
        selectPhoneCol.innerHTML = '';
        columns.forEach((col) => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            if (col === detectedPhoneCol) opt.selected = true;
            selectPhoneCol.appendChild(opt);
        });

        // Populate variable chips
        variableChipsContainer.innerHTML = '';
        columns.forEach((col) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'var-chip';
            chip.textContent = `+ {${col}}`;
            chip.title = `Haz clic para insertar {${col}}`;
            chip.addEventListener('click', () => {
                insertVariableAtCursor(`{${col}}`);
            });
            variableChipsContainer.appendChild(chip);
        });

        refreshPreviewDropdown();

        selectedContactIndex = 0;
        updatePreview();
        metricTotal.textContent = rows.length;
    }

    function refreshPreviewDropdown() {
        previewContactSelect.innerHTML = '';
        const phoneCol = selectPhoneCol.value || 'telefono';
        const prefix = selectCountryPrefix.value;

        currentContacts.slice(0, 50).forEach((row, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            const name = row.nombre || row.Nombre || row.name || '';
            const rawPhone = row[phoneCol] || row.telefono || row.Telefono || `Contacto #${idx + 1}`;
            const cleanPhone = clientNormalizePhone(rawPhone, prefix);
            opt.textContent = name ? `${name} (+${cleanPhone})` : `+${cleanPhone}`;
            previewContactSelect.appendChild(opt);
        });
    }

    btnClearFile.addEventListener('click', () => {
        currentContacts = [];
        currentColumns = [];
        fileLoadedArea.classList.add('hidden');
        contactFileInput.value = '';
        manualNumbersInput.value = '';
        variableChipsContainer.innerHTML = '<span class="no-vars-hint">Carga un archivo o escribe un número para ver las variables...</span>';
        previewContactSelect.innerHTML = '';
        metricTotal.textContent = '0';
        updatePreview();
        showToast('Lista limpiada', 'Se borraron los contactos cargados.', 'info');
    });

    selectPhoneCol.addEventListener('change', () => {
        refreshPreviewDropdown();
        updatePreview();
    });

    selectCountryPrefix.addEventListener('change', () => {
        refreshPreviewDropdown();
        updatePreview();
    });

    // ==========================================
    // Message Editor & Variable Insertion
    // ==========================================
    function insertVariableAtCursor(tag) {
        const start = messageTemplateInput.selectionStart;
        const end = messageTemplateInput.selectionEnd;
        const text = messageTemplateInput.value;

        messageTemplateInput.value = text.substring(0, start) + tag + text.substring(end);
        messageTemplateInput.focus();
        messageTemplateInput.selectionStart = messageTemplateInput.selectionEnd = start + tag.length;
        updatePreview();
    }

    // Format toolbar (Bold, Italic, Strikethrough, Code)
    document.querySelectorAll('.tool-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const wrap = btn.getAttribute('data-format');
            const start = messageTemplateInput.selectionStart;
            const end = messageTemplateInput.selectionEnd;
            const text = messageTemplateInput.value;
            const selectedText = text.substring(start, end) || 'texto';

            messageTemplateInput.value = text.substring(0, start) + wrap + selectedText + wrap + text.substring(end);
            messageTemplateInput.focus();
            messageTemplateInput.selectionStart = start + wrap.length;
            messageTemplateInput.selectionEnd = start + wrap.length + selectedText.length;
            updatePreview();
        });
    });

    messageTemplateInput.addEventListener('input', () => {
        charCount.textContent = `${messageTemplateInput.value.length} caracteres`;
        updatePreview();
    });

    previewContactSelect.addEventListener('change', (e) => {
        selectedContactIndex = parseInt(e.target.value, 10) || 0;
        updatePreview();
    });

    // Format WhatsApp markdown into preview HTML
    function formatWhatsAppHtml(text) {
        if (!text) return '';
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // ```code```
        escaped = escaped.replace(/```([\s\S]*?)```/g, '<code>$1</code>');
        // *bold*
        escaped = escaped.replace(/\*([^*]+)\*/g, '<b>$1</b>');
        // _italic_
        escaped = escaped.replace(/_([^_]+)_/g, '<i>$1</i>');
        // ~strikethrough~
        escaped = escaped.replace(/~([^~]+)~/g, '<s>$1</s>');
        // Newlines
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    function updatePreview() {
        const rawTemplate = messageTemplateInput.value;
        const contact = currentContacts[selectedContactIndex] || {
            nombre: 'Juan Pérez',
            telefono: '5491122334455',
            empresa: 'Empresa Demo',
            monto: '$15.000'
        };

        const phoneCol = selectPhoneCol.value || 'telefono';
        const contactName = contact.nombre || contact.Nombre || contact.name || 'Destinatario';
        const rawPhone = contact[phoneCol] || contact.telefono || contact.Telefono || '5491122334455';

        const cleanPhone = clientNormalizePhone(rawPhone, selectCountryPrefix.value);
        waPreviewName.textContent = contactName;
        waPreviewPhone.textContent = `+${cleanPhone}`;

        if (!rawTemplate) {
            waBubbleContent.innerHTML = '<i>Escribe un mensaje en el recuadro para ver la vista previa en vivo...</i>';
            return;
        }

        // Interpolate variables
        let interpolated = rawTemplate.replace(/\{([^{}]+)\}/g, (match, rawKey) => {
            const key = rawKey.trim();
            if (contact[key] !== undefined && contact[key] !== null) return contact[key];
            const lower = key.toLowerCase();
            for (const [k, v] of Object.entries(contact)) {
                if (k.toLowerCase() === lower && v !== undefined && v !== null) return v;
            }
            return match;
        });

        waBubbleContent.innerHTML = formatWhatsAppHtml(interpolated);
    }

    // ==========================================
    // Single Test Message
    // ==========================================
    btnSendTestMessage.addEventListener('click', async () => {
        const phone = testPhoneInput.value.trim();
        const template = messageTemplateInput.value.trim();

        if (!phone) {
            showToast('Teléfono requerido', 'Ingresa tu propio número con código de país para hacer la prueba.', 'warning');
            testPhoneInput.focus();
            return;
        }

        if (!template) {
            highlightCardError(cardMessage, 'Mensaje vacío', 'Por favor escribe el mensaje en el Paso 2 antes de probar.');
            return;
        }

        if (waStatus !== 'READY') {
            showToast('WhatsApp no conectado', 'Por favor abre el código QR y vincúlalo antes de enviar.', 'warning');
            qrModal.classList.remove('hidden');
            return;
        }

        const sampleContact = currentContacts[0] || { nombre: 'Prueba', empresa: 'Mi Empresa' };
        let testMsg = template.replace(/\{([^{}]+)\}/g, (match, rawKey) => {
            const key = rawKey.trim();
            return sampleContact[key] || match;
        });

        btnSendTestMessage.disabled = true;
        btnSendTestMessage.textContent = 'Enviando...';
        appendLog('info', `Enviando mensaje de prueba a ${phone}...`);

        try {
            const res = await fetch('/api/test-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    message: testMsg,
                    defaultPrefix: selectCountryPrefix.value
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            appendLog('success', `Mensaje de prueba enviado exitosamente a ${phone}`);
            showToast('Prueba enviada', `Mensaje de prueba recibido por +${phone}`, 'success');
        } catch (err) {
            appendLog('error', `Error en prueba: ${err.message}`);
            showToast('Error de prueba', err.message, 'error');
        } finally {
            btnSendTestMessage.disabled = false;
            btnSendTestMessage.textContent = 'Probar Envío';
        }
    });

    // ==========================================
    // Campaign Execution (Direct & Immediate)
    // ==========================================
    async function startCampaignExecution() {
        // Step 1: Check contacts
        if (currentContacts.length === 0) {
            const hasManual = parseManualNumbers(false);
            if (!hasManual) {
                highlightCardError(cardContacts, 'Faltan los contactos', 'Por favor carga "WhatsApp Contactos.xlsx" o pega una lista de números en el Paso 1.');
                return;
            }
        }

        // Step 2: Validate Message
        const template = messageTemplateInput.value.trim();
        if (!template) {
            highlightCardError(cardMessage, 'Mensaje vacío', 'Por favor escribe el mensaje que deseas enviar en el Paso 2.');
            return;
        }

        // Step 3: Validate WhatsApp Connection
        if (waStatus !== 'READY') {
            showToast('WhatsApp no está conectado', 'Por favor abre el código QR y vincula tu teléfono primero.', 'warning', 8000);
            qrModal.classList.remove('hidden');
            return;
        }

        const minDelay = parseInt(minDelayInput.value, 10) || 8;
        const maxDelay = parseInt(maxDelayInput.value, 10) || 20;

        // Reset UI table and counters
        campaignResults = [];
        resultsTableBody.innerHTML = '';
        progressBarFill.style.width = '0%';
        progressPercent.textContent = '0%';
        metricTotal.textContent = currentContacts.length;
        metricSent.textContent = '0';
        metricUnregistered.textContent = '0';
        metricFailed.textContent = '0';

        btnStartCampaign.disabled = true;
        btnStartCampaign.innerHTML = '<span class="status-dot"></span> Enviando...';

        try {
            appendLog('info', `Iniciando envíos a ${currentContacts.length} contactos...`);
            showToast('Campaña en marcha', `Enviando a ${currentContacts.length} destinatarios. Demora: ${minDelay}-${maxDelay}s.`, 'success', 5000);

            const res = await fetch('/api/campaign/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contacts: currentContacts,
                    messageTemplate: template,
                    settings: {
                        minDelay,
                        maxDelay,
                        defaultPrefix: selectCountryPrefix.value,
                        phoneColumn: selectPhoneCol.value || 'TELEFONOS'
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            appendLog('info', `Campaña iniciada ID: ${data.campaignId}`);
        } catch (err) {
            appendLog('error', `Error iniciando campaña: ${err.message}`);
            showToast('Error al iniciar', err.message, 'error', 8000);
            btnStartCampaign.disabled = false;
            btnStartCampaign.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Iniciar Envíos';
        }
    }

    btnStartCampaign.addEventListener('click', startCampaignExecution);

    btnPauseCampaign.addEventListener('click', async () => {
        try {
            await fetch('/api/campaign/pause', { method: 'POST' });
            showToast('Campaña en pausa', 'Los envíos están pausados temporalmente.', 'warning');
        } catch (err) {
            console.error(err);
        }
    });

    btnResumeCampaign.addEventListener('click', async () => {
        try {
            await fetch('/api/campaign/resume', { method: 'POST' });
            showToast('Campaña reanudada', 'Continuando con la lista de contactos...', 'info');
        } catch (err) {
            console.error(err);
        }
    });

    btnStopCampaign.addEventListener('click', () => {
        showConfirmModal({
            title: 'Detener Campaña',
            message: '¿Deseas detener la campaña por completo?',
            details: 'No se enviarán más mensajes de la lista actual.',
            buttonText: 'Detener Ahora',
            onConfirm: async () => {
                try {
                    await fetch('/api/campaign/stop', { method: 'POST' });
                    showToast('Campaña detenida', 'El proceso de envío fue cancelado.', 'warning');
                } catch (err) {
                    console.error(err);
                }
            }
        });
    });

    // ==========================================
    // Export Report CSV
    // ==========================================
    btnExportCsv.addEventListener('click', () => {
        if (campaignResults.length === 0) return;

        const headers = ['Indice', 'Telefono', 'Nombre', 'Estado', 'Detalle', 'Hora'];
        const csvRows = [headers.join(',')];

        campaignResults.forEach((r) => {
            const row = [
                r.index,
                `"${r.phone}"`,
                `"${(r.name || '').replace(/"/g, '""')}"`,
                `"${r.status}"`,
                `"${(r.message || '').replace(/"/g, '""')}"`,
                `"${r.timestamp}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_envios_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // ==========================================
    // Workspace Local Files Detection & Auto-Load
    // ==========================================
    async function checkWorkspaceFiles() {
        try {
            const res = await fetch('/api/workspace-files');
            const data = await res.json();
            if (data.files && data.files.length > 0) {
                const container = document.getElementById('detectedFilesContainer');
                const list = document.getElementById('detectedFilesList');
                if (container && list) {
                    list.innerHTML = '';
                    data.files.forEach((file) => {
                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = 'detected-file-chip';
                        chip.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg> Cargar ${file}`;
                        chip.addEventListener('click', () => loadWorkspaceFile(file, true));
                        list.appendChild(chip);
                    });
                    container.classList.remove('hidden');
                }

                // Auto-load WhatsApp Contactos.xlsx if present
                if (data.files.includes('WhatsApp Contactos.xlsx') && currentContacts.length === 0) {
                    await loadWorkspaceFile('WhatsApp Contactos.xlsx', false);
                }
            }
        } catch (e) {
            console.error('Error checking workspace files:', e);
        }
    }

    async function loadWorkspaceFile(filename, showToastMsg = true) {
        try {
            appendLog('info', `Cargando archivo local "${filename}"...`);
            const res = await fetch('/api/load-workspace-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            processLoadedContacts(data.allRows, data.columns, data.filename, data.detectedPhoneCol);
            if (showToastMsg) {
                showToast('¡Archivo Cargado!', `Se cargaron ${data.rowCount} contactos desde "${filename}"`, 'success');
            } else {
                appendLog('success', `Archivo "${filename}" cargado automáticamente (${data.rowCount} contactos).`);
            }
        } catch (err) {
            appendLog('error', `Error cargando "${filename}": ${err.message}`);
        }
    }

    // Set Fabricio Toppazzini default broadcast message
    const fabricioMessage = `🇮🇹 ¡ATENCIÓN CIUDADANOS ITALIANOS! 🇮🇹 Te recuerdo que para votar en las Elecciones Com.It.Es. 2026 es requisito indispensable inscribirte previamente.   ⏳ Fecha límite: Hasta el 03/11/26.   
📌 ¿Cómo hacer la inscripción de forma simple y rápida? Imprimir y completar el formulario. Enviar una foto clara del formulario firmado + foto de tu DNI a: ✉️ elettorale.rosario@esteri.it (También podés realizar el trámite directamente a través del portal Fast It).   Como representante de Pergamino y referente de Fronte Centrodestra (CDX), quedo a tu entera disposición para asistirte en la inscripción y contar con tu acompañamiento en esta votación tan importante para nuestra comunidad.
ℹ️ Más información en el sitio del Consulado General de Italia en Rosario o en Fast It.   ¡Contamos con vos!
Fabricio Toppazzini`;

    if (!messageTemplateInput.value.trim()) {
        messageTemplateInput.value = fabricioMessage;
        charCount.textContent = `${fabricioMessage.length} caracteres`;
    }

    // Initialize Socket & default preview
    setupSocket();
    updatePreview();
    checkWorkspaceFiles();
});
