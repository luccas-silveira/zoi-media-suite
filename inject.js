(function() {
  'use strict';

  // ============================================
  // 1. CONFIGURAÇÃO E CONSTANTES
  // ============================================

  const CONFIG = {
    targetHostname: 'app.zoitech.com.br',
    targetPathPattern: '/conversations/conversations',
    svgPathData: 'M17.5 5.256V16.5a5.5 5.5 0 11-11 0V5.667a3.667 3.667 0 017.333 0v10.779a1.833 1.833 0 11-3.666 0V6.65',
    acceptedFileTypes: 'image/*,video/*,audio/*',
    maxFileSize: 5 * 1024 * 1024, // 5MB em bytes (conversations upload)
    maxVideoFileSize: 500 * 1024 * 1024, // 500MB (Media Storage para vídeos)
    retryAttempts: 5,
    retryDelay: 500,
    urlPollInterval: 2500,
    debugMode: false,
    apiKey: 'pit-6dfe1d34-d34f-4505-8c81-9fbbde7c564d',
    uploadEndpoint: 'https://services.leadconnectorhq.com/conversations/messages/upload',
    sendEndpoint: 'https://services.leadconnectorhq.com/conversations/messages',
    getMessagesEndpoint: 'https://services.leadconnectorhq.com/conversations',
    mediaLibraryEndpoint: 'https://services.leadconnectorhq.com/medias/files',
    mediaUploadEndpoint: 'https://services.leadconnectorhq.com/medias/upload-file',
    apiVersion: '2021-04-15',
    customFieldId: 'te8xRD0EkEVmexDqultc',
    workflowId: '57418b05-0bf1-4cea-9822-e3a8e4193d6f',
    videoProcessingDelay: 5000,
    contactsEndpoint: 'https://services.leadconnectorhq.com/contacts',
    conversationContextTtlMs: 45 * 1000,
    conversationIntentTtlMs: 10 * 1000,
    attachmentValidationMaxAttempts: 4,
    attachmentValidationBaseDelayMs: 1200,
    attachmentValidationFetchLimit: 30
  };

  // Armazenar arquivos selecionados
  let selectedFiles = [];

  // Rastrear ícones já modificados
  const modifiedIcons = new WeakSet();

  // State da galeria de mídias
  let mediaLibraryState = {
    folders: [],
    currentFolder: null,
    medias: [],
    selectedMedias: [],
    loading: {
      folders: false,
      medias: false
    },
    searchQuery: '',
    // Novos campos para navegação hierárquica
    folderHierarchy: [], // Caminho de navegação [rootFolder, subFolder, ...]
    expandedFolders: new Set(), // IDs de pastas expandidas
    foldersTree: {} // Mapa de {folderId: {folder: {...}, children: [...]}}
  };

  // Função para resetar o estado da galeria
  function resetGalleryState() {
    mediaLibraryState.folders = [];
    mediaLibraryState.currentFolder = null;
    mediaLibraryState.medias = [];
    mediaLibraryState.selectedMedias = [];
    mediaLibraryState.loading.folders = false;
    mediaLibraryState.loading.medias = false;
    mediaLibraryState.searchQuery = '';
    mediaLibraryState.folderHierarchy = [];
    mediaLibraryState.expandedFolders = new Set();
    mediaLibraryState.foldersTree = {};
    log('Estado da galeria resetado');
  }

  // ============================================
  // 2. FUNÇÃO DE LOG (PARA DEBUG)
  // ============================================

  function log(message, ...args) {
    if (CONFIG.debugMode) {
      console.log('[Media Upload]', message, ...args);
    }
  }

  // ============================================
  // 3. VERIFICAÇÃO DE DOMÍNIO
  // ============================================

  function checkDomain() {
    const currentHostname = window.location.hostname;
    const currentPath = window.location.pathname;

    const isCorrectHostname = currentHostname === CONFIG.targetHostname;
    const hasConversationsPath = currentPath.includes(CONFIG.targetPathPattern);

    if (!isCorrectHostname || !hasConversationsPath) {
      log('Script não executado - URL não corresponde aos critérios');
      return false;
    }

    log('Domínio verificado com sucesso');
    return true;
  }

  function isModalOpen() {
    return Boolean(document.getElementById('custom-media-upload-modal'));
  }

  function getModalElement(id) {
    if (!isModalOpen()) return null;
    return document.getElementById(id);
  }

  // ============================================
  // 4. CRIAR MODAL/POPUP
  // ============================================

  function createModal() {
    // Resetar estado da galeria e arquivos selecionados
    resetGalleryState();
    selectedFiles = [];

    // Remover modal existente se houver
    const existingModal = document.getElementById('custom-media-upload-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'custom-media-upload-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Enviar Mídias</h2>
            <button class="close-btn" id="modal-close-btn">&times;</button>
          </div>

          <!-- Sistema de Abas -->
          <div class="media-tabs">
            <button class="tab-btn" data-tab="upload">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </button>
            <button class="tab-btn active" data-tab="gallery">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Galeria
            </button>
          </div>

          <!-- Aba Upload (conteúdo original) -->
          <div class="tab-content" data-tab="upload">
            <div class="drop-zone" id="drop-zone">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p>Arraste arquivos aqui ou clique para selecionar</p>
              <p class="file-types">Imagens, Vídeos e Áudios</p>
              <input type="file" id="file-input" multiple accept="${CONFIG.acceptedFileTypes}" style="display: none;">
            </div>

            <div class="files-list" id="files-list"></div>

            <div class="message-input-container">
              <label for="message-text">Mensagem (opcional)</label>
              <textarea id="message-text" placeholder="Digite uma mensagem para acompanhar as mídias..."></textarea>
            </div>
          </div>

          <!-- Aba Galeria (novo) -->
          <div class="tab-content active" data-tab="gallery">
            <div class="gallery-container">
              <!-- Sidebar com pastas -->
              <div class="gallery-sidebar">
                <div class="sidebar-header">
                  <h3>Pastas</h3>
                </div>
                <div id="folders-list" class="folders-list">
                  <!-- Renderizado dinamicamente -->
                </div>
              </div>

              <!-- Área principal com grid de mídias -->
              <div class="gallery-main">
                <div class="gallery-header">
                  <div class="gallery-info">
                    <span id="media-count">0 mídias</span>
                  </div>
                </div>
                <div id="media-grid" class="media-grid">
                  <!-- Grid de mídias renderizado dinamicamente -->
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
            <button class="btn btn-primary" id="modal-send-btn">Enviar (<span id="file-count">0</span>)</button>
          </div>
        </div>
      </div>
    `;

    // Adicionar estilos uma única vez (evita vazamento de <style> no head)
    let style = document.getElementById('custom-media-upload-modal-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'custom-media-upload-modal-style';
      style.textContent = `
      #custom-media-upload-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      #custom-media-upload-modal .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #custom-media-upload-modal .modal-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      #custom-media-upload-modal .modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      #custom-media-upload-modal .modal-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
      }

      #custom-media-upload-modal .close-btn {
        background: none;
        border: none;
        font-size: 32px;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }

      #custom-media-upload-modal .close-btn:hover {
        background: #f3f4f6;
        color: #374151;
      }

      #custom-media-upload-modal .drop-zone {
        margin: 24px;
        padding: 48px 24px;
        border: 2px dashed #d1d5db;
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #f9fafb;
      }

      #custom-media-upload-modal .drop-zone:hover {
        border-color: #3b82f6;
        background: #eff6ff;
      }

      #custom-media-upload-modal .drop-zone.drag-over {
        border-color: #3b82f6;
        background: #dbeafe;
        border-style: solid;
      }

      #custom-media-upload-modal .drop-zone svg {
        color: #9ca3af;
        margin-bottom: 16px;
      }

      #custom-media-upload-modal .drop-zone p {
        margin: 8px 0;
        color: #6b7280;
        font-size: 14px;
      }

      #custom-media-upload-modal .drop-zone .file-types {
        font-size: 12px;
        color: #9ca3af;
      }

      #custom-media-upload-modal .files-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 24px;
        min-height: 0;
        max-height: 300px;
      }

      #custom-media-upload-modal .file-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 8px;
        background: white;
        transition: all 0.2s;
      }

      #custom-media-upload-modal .file-item:hover {
        background: #f9fafb;
      }

      #custom-media-upload-modal .file-preview {
        width: 60px;
        height: 60px;
        border-radius: 6px;
        overflow: hidden;
        background: #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      #custom-media-upload-modal .file-preview img,
      #custom-media-upload-modal .file-preview video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      #custom-media-upload-modal .file-preview audio {
        width: 100%;
        height: 30px;
      }

      #custom-media-upload-modal .file-preview-icon {
        color: #9ca3af;
        font-size: 24px;
      }

      #custom-media-upload-modal .file-info {
        flex: 1;
        min-width: 0;
      }

      #custom-media-upload-modal .file-name {
        font-size: 14px;
        font-weight: 500;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #custom-media-upload-modal .file-meta {
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      }

      #custom-media-upload-modal .file-remove {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: all 0.2s;
        font-size: 18px;
        line-height: 1;
      }

      #custom-media-upload-modal .file-remove:hover {
        background: #fee2e2;
      }

      #custom-media-upload-modal .message-input-container {
        padding: 0 24px 16px 24px;
      }

      #custom-media-upload-modal .message-input-container label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 8px;
      }

      #custom-media-upload-modal .message-input-container textarea {
        width: 100%;
        min-height: 80px;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        outline: none;
        transition: all 0.2s;
      }

      #custom-media-upload-modal .message-input-container textarea:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      #custom-media-upload-modal .modal-footer {
        padding: 20px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      #custom-media-upload-modal .btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        outline: none;
      }

      #custom-media-upload-modal .btn-secondary {
        background: white;
        color: #374151;
        border: 1px solid #d1d5db;
      }

      #custom-media-upload-modal .btn-secondary:hover {
        background: #f9fafb;
      }

      #custom-media-upload-modal .btn-primary {
        background: #3b82f6;
        color: white;
      }

      #custom-media-upload-modal .btn-primary:hover {
        background: #2563eb;
      }

      #custom-media-upload-modal .btn-primary:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      /* ============================================ */
      /* TABS SYSTEM */
      /* ============================================ */

      #custom-media-upload-modal .media-tabs {
        display: flex;
        gap: 8px;
        border-bottom: 2px solid #e5e7eb;
        margin-bottom: 0;
        padding: 0 24px;
      }

      #custom-media-upload-modal .tab-btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        background: transparent;
        color: #6b7280;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      #custom-media-upload-modal .tab-btn svg {
        width: 16px;
        height: 16px;
      }

      #custom-media-upload-modal .tab-btn:hover {
        color: #3b82f6;
      }

      #custom-media-upload-modal .tab-btn.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
      }

      /* Tab Content */
      #custom-media-upload-modal .tab-content {
        display: none;
      }

      #custom-media-upload-modal .tab-content.active {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
      }

      /* ============================================ */
      /* GALLERY CONTAINER */
      /* ============================================ */

      #custom-media-upload-modal .gallery-container {
        display: flex;
        gap: 16px;
        flex: 1;
        overflow: hidden;
        min-height: 0;
      }

      /* ============================================ */
      /* SIDEBAR */
      /* ============================================ */

      #custom-media-upload-modal .gallery-sidebar {
        width: 200px;
        border-right: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        background: #f9fafb;
        overflow: hidden;
        min-height: 0;
      }

      #custom-media-upload-modal .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      #custom-media-upload-modal .sidebar-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #374151;
      }

      #custom-media-upload-modal .folders-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      #custom-media-upload-modal .folder-item {
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #4b5563;
      }

      #custom-media-upload-modal .folder-item:hover {
        background: #e5e7eb;
      }

      #custom-media-upload-modal .folder-item.active {
        background: #dbeafe;
        color: #1e40af;
      }

      #custom-media-upload-modal .folder-item svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      #custom-media-upload-modal .folder-name {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }

      /* Expansão de pastas (árvore hierárquica) */
      #custom-media-upload-modal .folder-item {
        position: relative;
      }

      #custom-media-upload-modal .folder-item.has-children {
        padding-left: 8px;
      }

      #custom-media-upload-modal .folder-expand {
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      #custom-media-upload-modal .folder-expand:hover {
        color: #374151;
      }

      #custom-media-upload-modal .folder-expand svg {
        width: 12px;
        height: 12px;
        transition: transform 0.2s;
      }

      #custom-media-upload-modal .folder-expand.expanded svg {
        transform: rotate(90deg);
      }

      #custom-media-upload-modal .folder-children {
        margin-left: 12px;
        border-left: 1px solid #e5e7eb;
        padding-left: 8px;
      }

      /* ============================================ */
      /* GALLERY MAIN */
      /* ============================================ */

      #custom-media-upload-modal .gallery-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 0;
      }

      #custom-media-upload-modal .gallery-header {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 16px 16px 12px;
        border-bottom: 1px solid #e5e7eb;
      }

      #custom-media-upload-modal .gallery-info {
        color: #6b7280;
        font-size: 13px;
        white-space: nowrap;
      }

      /* ============================================ */
      /* MEDIA GRID */
      /* ============================================ */

      #custom-media-upload-modal .media-grid {
        flex: 1;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 12px;
        padding: 16px;
        align-content: start;
        min-height: 0;
      }

      #custom-media-upload-modal .media-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.2s;
        background: #f3f4f6;
      }

      #custom-media-upload-modal .media-item:hover {
        border-color: #3b82f6;
        transform: scale(1.05);
      }

      #custom-media-upload-modal .media-item.selected {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      #custom-media-upload-modal .media-item img,
      #custom-media-upload-modal .media-item video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      #custom-media-upload-modal .media-item-icon {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
      }

      #custom-media-upload-modal .media-item-checkbox {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 20px;
        height: 20px;
        background: white;
        border: 2px solid #d1d5db;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 0.2s;
      }

      #custom-media-upload-modal .media-item:hover .media-item-checkbox,
      #custom-media-upload-modal .media-item.selected .media-item-checkbox {
        opacity: 1;
      }

      #custom-media-upload-modal .media-item.selected .media-item-checkbox {
        background: #3b82f6;
        border-color: #3b82f6;
      }

      #custom-media-upload-modal .media-item-checkbox::after {
        content: '✓';
        color: white;
        font-size: 12px;
        display: none;
      }

      #custom-media-upload-modal .media-item.selected .media-item-checkbox::after {
        display: block;
      }

      #custom-media-upload-modal .media-item-name {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        color: white;
        padding: 8px 6px 4px;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ============================================ */
      /* LOADING & EMPTY STATES */
      /* ============================================ */

      #custom-media-upload-modal .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: #6b7280;
      }

      #custom-media-upload-modal .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 12px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      #custom-media-upload-modal .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: #9ca3af;
        text-align: center;
      }

      #custom-media-upload-modal .empty-state svg {
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      #custom-media-upload-modal .empty-state p {
        margin: 0;
        font-size: 14px;
      }
    `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    setupModalEventListeners();
    setupTabs();

    // Carregar pastas da galeria automaticamente (aba padrão)
    fetchMediaFolders();

    log('Modal criado com sucesso');
    return modal;
  }

  // ============================================
  // 5. CONFIGURAR EVENT LISTENERS DO MODAL
  // ============================================

  function setupModalEventListeners() {
    const modal = document.getElementById('custom-media-upload-modal');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const sendBtn = document.getElementById('modal-send-btn');

    // Fechar modal
    const closeModal = () => {
      modal.remove();
      selectedFiles = [];
      log('Modal fechado');
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Fechar ao clicar fora
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    });

    // Click na drop zone abre seletor de arquivos
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Seleção de arquivos
    fileInput.addEventListener('change', async (e) => {
      await handleFiles(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      await handleFiles(e.dataTransfer.files);
    });

    // Botão enviar
    sendBtn.addEventListener('click', () => {
      handleSendFiles();
    });
  }

  // ============================================
  // 6. COMPRIMIR IMAGEM SE NECESSÁRIO
  // ============================================

  async function compressImageIfNeeded(file) {
    // Se não for imagem ou for menor que 5MB, retornar original
    if (!file.type.startsWith('image/') || file.size <= CONFIG.maxFileSize) {
      return file;
    }

    log(`Comprimindo imagem: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // Criar canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Calcular dimensões mantendo aspect ratio
          let width = img.width;
          let height = img.height;
          const maxDimension = 1920; // máximo 1920px no lado maior

          if (width > height && width > maxDimension) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          // Desenhar imagem redimensionada
          ctx.drawImage(img, 0, 0, width, height);

          // Converter para blob com qualidade ajustada
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              // Criar novo File a partir do blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });

              log(`Imagem comprimida: ${file.name} - De ${(file.size / 1024 / 1024).toFixed(2)}MB para ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
              resolve(compressedFile);
            } else {
              // Se a compressão não funcionou, retornar original
              resolve(file);
            }
          }, 'image/jpeg', 0.7); // qualidade 70%
        };

        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    });
  }

  // ============================================
  // 7. PROCESSAR ARQUIVOS
  // ============================================

  async function handleFiles(files) {
    const filesArray = Array.from(files);

    for (const file of filesArray) {
      // Validar tipo de arquivo
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isValidType = isImage || isVideo || isAudio;

      if (!isValidType) {
        log('Arquivo rejeitado (tipo não suportado):', file.name);
        continue;
      }

      let processedFile = file;

      // Validar e processar tamanho do arquivo
      if (file.size > CONFIG.maxFileSize) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const maxSizeMB = (CONFIG.maxFileSize / 1024 / 1024).toFixed(0);

        if (isImage) {
          // Para imagens, tentar comprimir
          log(`Imagem grande detectada (${sizeMB}MB), tentando comprimir...`);
          processedFile = await compressImageIfNeeded(file);

          // Verificar se compressão funcionou
          if (processedFile.size > CONFIG.maxFileSize) {
            log(`Mesmo após compressão, imagem ainda é muito grande: ${file.name}`);
            alert(`Imagem muito grande: ${file.name}\n\nTamanho após compressão: ${(processedFile.size / 1024 / 1024).toFixed(2)}MB\nMáximo permitido: ${maxSizeMB}MB\n\nTente usar uma imagem de qualidade inferior.`);
            continue;
          }
        } else if (isVideo) {
          // Vídeos >5MB serão enviados via Media Storage (limite 500MB)
          const maxVideoSizeMB = (CONFIG.maxVideoFileSize / 1024 / 1024).toFixed(0);
          if (file.size > CONFIG.maxVideoFileSize) {
            log(`Vídeo muito grande: ${file.name} (${sizeMB}MB), máximo: ${maxVideoSizeMB}MB`);
            alert(`Vídeo muito grande: ${file.name}\n\nTamanho: ${sizeMB}MB\nMáximo permitido: ${maxVideoSizeMB}MB\n\nPor favor, comprima o vídeo antes de enviar.`);
            continue;
          }
          log(`Vídeo grande detectado (${sizeMB}MB), será enviado via Media Storage`);
        } else {
          // Para áudios, rejeitar se > 5MB
          log(`Áudio muito grande: ${file.name} (${sizeMB}MB)`);
          alert(`Áudio muito grande: ${file.name}\n\nTamanho: ${sizeMB}MB\nMáximo permitido: ${maxSizeMB}MB\n\nPor favor, comprima o áudio antes de enviar.`);
          continue;
        }
      }

      // Arquivo válido (original ou comprimido)
      selectedFiles.push(processedFile);
      addFileToList(processedFile);
      log('Arquivo adicionado:', processedFile.name);
    }

    updateFileCount();
  }

  // ============================================
  // 7. ADICIONAR ARQUIVO À LISTA
  // ============================================

  function addFileToList(file) {
    const filesList = document.getElementById('files-list');
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.fileName = file.name;

    const preview = document.createElement('div');
    preview.className = 'file-preview';

    // Criar preview baseado no tipo
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      preview.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      preview.appendChild(video);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(file);
      audio.controls = true;
      audio.style.width = '100%';
      audio.style.height = '30px';
      preview.appendChild(audio);
    } else {
      preview.innerHTML = '<span class="file-preview-icon">📄</span>';
    }

    const info = document.createElement('div');
    info.className = 'file-info';
    info.innerHTML = `
      <div class="file-name">${file.name}</div>
      <div class="file-meta">${formatFileSize(file.size)} • ${file.type || 'Tipo desconhecido'}</div>
    `;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remover arquivo';
    removeBtn.addEventListener('click', () => {
      removeFile(file, fileItem);
    });

    fileItem.appendChild(preview);
    fileItem.appendChild(info);
    fileItem.appendChild(removeBtn);
    filesList.appendChild(fileItem);
  }

  // ============================================
  // 8. REMOVER ARQUIVO
  // ============================================

  function removeFile(file, fileItem) {
    const index = selectedFiles.indexOf(file);
    if (index > -1) {
      selectedFiles.splice(index, 1);
      fileItem.remove();
      updateFileCount();
      log('Arquivo removido:', file.name);
    }
  }

  // ============================================
  // 9. ATUALIZAR CONTADOR DE ARQUIVOS
  // ============================================

  function updateFileCount() {
    const countElement = document.getElementById('file-count');
    const sendBtn = document.getElementById('modal-send-btn');

    if (countElement) {
      countElement.textContent = selectedFiles.length;
    }

    if (sendBtn) {
      sendBtn.disabled = selectedFiles.length === 0;
    }
  }

  // ============================================
  // 10. FORMATAR TAMANHO DO ARQUIVO
  // ============================================

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ============================================
  // 11. RESOLVER CONTEXTO VIA NETWORK
  // ============================================

  const conversationResolverState = {
    conversationId: null,
    locationId: null,
    contactId: null,
    conversationType: null,
    conversationProviderId: null,
    lastMessageType: null,
    lastMessageConversationProviderId: null,
    assignedTo: null,
    searchTypeHint: null,
    source: null,
    updatedAt: 0
  };

  let conversationPerformanceObserver = null;
  let conversationObserverInitialized = false;
  let networkInterceptorsInitialized = false;

  const RESOURCE_SCAN_MIN_INTERVAL_MS = 250;
  const RESOURCE_OBSERVER_BATCH_MS = 180;
  let lastResourceScanAt = 0;
  let lastProcessedResourceEntryCount = 0;
  let pendingObservedEntries = [];
  let pendingObservedEntriesTimer = null;
  const conversationContextCache = new Map();
  const conversationContextInflight = new Map();
  let conversationIntentTrackingInitialized = false;
  const conversationIntentState = {
    active: false,
    armedAt: 0,
    hintConversationId: null,
    source: null
  };

  function normalizeConversationId(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
  }

  function isLikelyConversationId(value) {
    const normalized = normalizeConversationId(value);
    if (!normalized) return false;
    return /^[A-Za-z0-9_-]{10,}$/.test(normalized);
  }

  function clearConversationIntent(reason = 'resolved') {
    const wasActive = conversationIntentState.active;
    conversationIntentState.active = false;
    conversationIntentState.armedAt = 0;
    conversationIntentState.hintConversationId = null;
    conversationIntentState.source = null;

    if (wasActive) {
      log(`[Context Resolver] Intent limpo (${reason})`);
    }
  }

  function isConversationIntentActive() {
    if (!conversationIntentState.active) return false;

    if (Date.now() - conversationIntentState.armedAt > CONFIG.conversationIntentTtlMs) {
      clearConversationIntent('expired');
      return false;
    }

    return true;
  }

  function armConversationIntent(conversationIdHint = null, source = 'user-click') {
    const normalizedHint = normalizeConversationId(conversationIdHint);
    const safeHint = isLikelyConversationId(normalizedHint) ? normalizedHint : null;

    conversationIntentState.active = true;
    conversationIntentState.armedAt = Date.now();
    conversationIntentState.hintConversationId = safeHint;
    conversationIntentState.source = source;

    log('[Context Resolver] Intent armado:', {
      hintConversationId: conversationIntentState.hintConversationId,
      source: conversationIntentState.source
    });
  }

  function isConversationListClick(target) {
    if (!target || !(target instanceof Element)) return false;
    return Boolean(target.closest('#conversations-list, .conversation-list-container, [id*="conversations-list"]'));
  }

  function resolveConversationIdFromElement(target) {
    if (!target || !(target instanceof Element)) return null;

    const directAttributeKeys = [
      'data-conversation-id',
      'data-conversationid',
      'data-thread-id',
      'data-threadid',
      'conversation-id'
    ];

    let current = target;
    let depth = 0;
    while (current && depth < 9) {
      for (const attributeKey of directAttributeKeys) {
        const attributeValue = current.getAttribute(attributeKey);
        const normalizedAttribute = normalizeConversationId(attributeValue);
        if (!normalizedAttribute) continue;

        const parsedFromUrl = parseConversationIdFromUrl(normalizedAttribute);
        const candidate = parsedFromUrl || normalizedAttribute;
        if (isLikelyConversationId(candidate)) {
          return candidate;
        }
      }

      if (current.dataset) {
        const datasetCandidates = [
          current.dataset.conversationId,
          current.dataset.threadId
        ];

        for (const datasetCandidate of datasetCandidates) {
          const normalizedDataset = normalizeConversationId(datasetCandidate);
          if (!normalizedDataset) continue;

          const parsedFromUrl = parseConversationIdFromUrl(normalizedDataset);
          const candidate = parsedFromUrl || normalizedDataset;
          if (isLikelyConversationId(candidate)) {
            return candidate;
          }
        }
      }

      const href = current.getAttribute('href') || current.getAttribute('data-href');
      if (href) {
        const parsedFromHref = parseConversationIdFromUrl(href);
        if (parsedFromHref && isLikelyConversationId(parsedFromHref)) {
          return parsedFromHref;
        }
      }

      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  function isHighConfidenceConversationSource(source = '') {
    if (!source) return false;
    return (
      source.includes(':conversation') ||
      source.includes(':messages') ||
      source.includes('message-search')
    );
  }

  function shouldAcceptConversationIdCandidate(candidateConversationId, source = 'network') {
    const candidate = normalizeConversationId(candidateConversationId);
    if (!candidate) return false;

    if (candidate === conversationResolverState.conversationId) return true;

    const urlConversationId = parseConversationIdFromUrl(window.location.href);
    if (urlConversationId) {
      return candidate === urlConversationId;
    }

    if (isConversationIntentActive()) {
      if (conversationIntentState.hintConversationId) {
        return candidate === conversationIntentState.hintConversationId;
      }

      if (source.includes('search-v2')) return false;
      return isHighConfidenceConversationSource(source);
    }

    if (conversationResolverState.conversationId) {
      return false;
    }

    if (source.includes('search-v2')) return false;
    return isHighConfidenceConversationSource(source);
  }

  function initConversationIntentTracking() {
    if (conversationIntentTrackingInitialized) return;
    conversationIntentTrackingInitialized = true;

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!isConversationListClick(target)) return;

      const hintedConversationId = resolveConversationIdFromElement(target);
      armConversationIntent(hintedConversationId, 'user-list-click');
    }, true);
  }

  function resetConversationResolverForNavigation(source = 'network:navigation') {
    const keysToReset = [
      'conversationId',
      'contactId',
      'conversationType',
      'conversationProviderId',
      'lastMessageType',
      'lastMessageConversationProviderId',
      'assignedTo',
      'searchTypeHint'
    ];

    let changed = false;
    for (const key of keysToReset) {
      if (conversationResolverState[key] !== null) {
        conversationResolverState[key] = null;
        changed = true;
      }
    }

    if (changed) {
      conversationResolverState.source = source;
      conversationResolverState.updatedAt = Date.now();
      log('[Context Resolver] Estado de conversa resetado por navegação');
    }

    clearConversationIntent('navigation');
  }

  function mergeResolverState(partialState, source = 'network') {
    if (!partialState || typeof partialState !== 'object') return;

    const allowedKeys = [
      'conversationId',
      'locationId',
      'contactId',
      'conversationType',
      'conversationProviderId',
      'lastMessageType',
      'lastMessageConversationProviderId',
      'assignedTo',
      'searchTypeHint'
    ];
    const conversationScopedKeys = [
      'contactId',
      'conversationType',
      'conversationProviderId',
      'lastMessageType',
      'lastMessageConversationProviderId',
      'assignedTo',
      'searchTypeHint'
    ];
    const sanitizedState = { ...partialState };

    const candidateConversationId = normalizeConversationId(sanitizedState.conversationId);
    if (candidateConversationId) {
      const shouldAccept = shouldAcceptConversationIdCandidate(candidateConversationId, source);

      if (!shouldAccept) {
        log(`[Context Resolver] ConversationId ignorado (${candidateConversationId}) via ${source}`);
        sanitizedState.conversationId = null;
        for (const key of conversationScopedKeys) {
          sanitizedState[key] = null;
        }
      } else {
        sanitizedState.conversationId = candidateConversationId;
      }
    }

    let changed = false;

    // Quando a conversa muda, limpa campos acoplados à conversa anterior
    // para evitar uso de contact/provider stale entre requisições.
    const hasNewConversationId =
      sanitizedState.conversationId !== undefined &&
      sanitizedState.conversationId !== null &&
      sanitizedState.conversationId !== '';
    const conversationChanged =
      hasNewConversationId &&
      conversationResolverState.conversationId &&
      sanitizedState.conversationId !== conversationResolverState.conversationId;

    if (conversationChanged) {
      for (const key of conversationScopedKeys) {
        if (conversationResolverState[key] !== null) {
          conversationResolverState[key] = null;
          changed = true;
        }
      }
    }

    for (const key of allowedKeys) {
      if (sanitizedState[key] === undefined || sanitizedState[key] === null || sanitizedState[key] === '') continue;
      if (conversationResolverState[key] !== sanitizedState[key]) {
        conversationResolverState[key] = sanitizedState[key];
        changed = true;
      }
    }

    if (changed) {
      conversationResolverState.source = source;
      conversationResolverState.updatedAt = Date.now();
      log('[Context Resolver] Estado atualizado:', {
        conversationId: conversationResolverState.conversationId,
        locationId: conversationResolverState.locationId,
        contactId: conversationResolverState.contactId,
        lastMessageType: conversationResolverState.lastMessageType,
        conversationProviderId: conversationResolverState.conversationProviderId,
        source: conversationResolverState.source
      });
    }

    if (
      sanitizedState.conversationId &&
      conversationResolverState.conversationId === sanitizedState.conversationId &&
      isConversationIntentActive()
    ) {
      if (
        !conversationIntentState.hintConversationId ||
        conversationIntentState.hintConversationId === sanitizedState.conversationId
      ) {
        clearConversationIntent(`resolved:${source}`);
      }
    }
  }

  function setConversationId(id) {
    mergeResolverState({ conversationId: id }, 'network:url');
  }

  function setLocationId(id) {
    mergeResolverState({ locationId: id }, 'network:url');
  }

  function parseConversationIdFromUrl(urlString) {
    try {
      const url = new URL(urlString, window.location.origin);

      const queryConversationId = url.searchParams.get('conversationId') || url.searchParams.get('conversation_id');
      if (queryConversationId) {
        return queryConversationId;
      }

      const pathMatch = url.pathname.match(/\/conversations\/([^\/?#]+)(?:\/messages)?$/i);
      if (pathMatch && pathMatch[1]) {
        const candidate = pathMatch[1];
        const reserved = new Set(['messages', 'search', 'filters', 'providers', 'sla-settings']);
        if (!reserved.has(candidate.toLowerCase())) {
          return candidate;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function parseLocationIdFromUrl(urlString) {
    try {
      const url = new URL(urlString, window.location.origin);

      const queryLocationId =
        url.searchParams.get('locationId') ||
        url.searchParams.get('location_id') ||
        url.searchParams.get('altId') ||
        url.searchParams.get('alt_id');

      if (queryLocationId) {
        return queryLocationId;
      }

      const pathLocationMatch = url.pathname.match(/\/v2\/location\/([^\/?#]+)/i);
      if (pathLocationMatch && pathLocationMatch[1]) {
        return pathLocationMatch[1];
      }

      const draftsLocationMatch = url.pathname.match(/\/conversations\/messages\/drafts\/([^\/?#]+)\/contacts\//i);
      if (draftsLocationMatch && draftsLocationMatch[1]) {
        return draftsLocationMatch[1];
      }

      const slaLocationMatch = url.pathname.match(/\/conversations\/sla-settings\/([^\/?#]+)/i);
      if (slaLocationMatch && slaLocationMatch[1]) {
        return slaLocationMatch[1];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function parseContactIdFromUrl(urlString) {
    try {
      const url = new URL(urlString, window.location.origin);
      const queryContactId = url.searchParams.get('contactId') || url.searchParams.get('contact_id');
      if (queryContactId) {
        return queryContactId;
      }

      const contactPathMatch = url.pathname.match(/\/contacts\/([^\/?#]+)/i);
      if (contactPathMatch && contactPathMatch[1]) {
        return contactPathMatch[1];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  function isConversationSearchResource(entry) {
    if (!entry || !entry.name) return false;
    if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') return false;
    return entry.name.includes('/conversations/messages/search');
  }

  function isNetworkResource(entry) {
    if (!entry || !entry.name) return false;
    return entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest';
  }

  function shouldInspectContextUrl(urlString) {
    try {
      const url = new URL(urlString, window.location.origin);
      return url.pathname.includes('/conversations') || url.pathname.includes('/conversations-ai/employeeConfigs');
    } catch (error) {
      return false;
    }
  }

  function parseJsonSafe(value) {
    if (typeof value !== 'string') return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function mapConversationRecordToResolverState(record) {
    if (!record || typeof record !== 'object') return null;
    const conversationProviderId =
      record.conversationProviderId ||
      record.lastMessageConversationProviderId ||
      null;

    return {
      conversationId: record.id || record.conversationId || null,
      locationId: record.locationId || null,
      contactId: record.contactId || null,
      conversationType: record.type ?? null,
      assignedTo: record.assignedTo || null,
      lastMessageType: record.lastMessageType || null,
      lastMessageConversationProviderId: conversationProviderId,
      conversationProviderId
    };
  }

  function extractRecordConversationId(record) {
    if (!record || typeof record !== 'object') return null;
    return record.conversationId || record.id || null;
  }

  function processContextFromUrl(urlString, source = 'network:url') {
    if (!urlString) return;

    const partial = {
      conversationId: parseConversationIdFromUrl(urlString),
      locationId: parseLocationIdFromUrl(urlString),
      contactId: parseContactIdFromUrl(urlString)
    };

    try {
      const url = new URL(urlString, window.location.origin);
      if (url.pathname.includes('/conversations/messages/search')) {
        const typeHint = url.searchParams.get('type');
        if (typeHint) {
          partial.searchTypeHint = String(typeHint).toUpperCase();
        }
      }
    } catch (error) {
      // no-op
    }

    mergeResolverState(partial, source);
  }

  function inspectNetworkPayload(urlString, payload, source = 'network:response') {
    if (!payload || typeof payload !== 'object') return;

    // /conversations/search/v2 => lista de conversas
    if (Array.isArray(payload.conversations) && payload.conversations.length > 0) {
      const targetConversationId =
        parseConversationIdFromUrl(urlString) ||
        payload.conversationId ||
        conversationResolverState.conversationId ||
        null;

      if (!targetConversationId) {
        return;
      }

      const conversationRecord =
        payload.conversations.find(item =>
          item && (item.id === targetConversationId || item.conversationId === targetConversationId)
        ) || null;

      if (!conversationRecord) {
        return;
      }

      const partial = mapConversationRecordToResolverState(conversationRecord);
      if (partial) {
        mergeResolverState(partial, `${source}:search-v2`);
      }
      return;
    }

    // /conversations/{conversationId}
    if ((payload.id || payload.conversationId) && payload.contactId && payload.locationId) {
      const partial = mapConversationRecordToResolverState(payload);
      if (partial) {
        mergeResolverState(partial, `${source}:conversation`);
      }
      return;
    }

    // /conversations/{conversationId}/messages
    if (payload.messages && Array.isArray(payload.messages.messages) && payload.messages.messages.length > 0) {
      const expectedConversationId = parseConversationIdFromUrl(urlString);
      const latestMessage = payload.messages.messages[0];
      const latestMessageConversationId = latestMessage.conversationId || null;

      if (
        expectedConversationId &&
        latestMessageConversationId &&
        latestMessageConversationId !== expectedConversationId
      ) {
        return;
      }

      mergeResolverState({
        conversationId: latestMessageConversationId || expectedConversationId || null,
        locationId: latestMessage.locationId || null,
        contactId: latestMessage.contactId || null,
        conversationProviderId: latestMessage.conversationProviderId || null,
        lastMessageConversationProviderId: latestMessage.conversationProviderId || null,
        lastMessageType: latestMessage.messageType || null
      }, `${source}:messages`);
      return;
    }

    // /conversations/messages/search
    if (payload.conversationId || payload.contactId || payload.locationId) {
      mergeResolverState({
        conversationId: payload.conversationId || null,
        contactId: payload.contactId || null,
        locationId: payload.locationId || null
      }, `${source}:message-search`);
      return;
    }
  }

  function inspectRequestBodyForContext(urlString, method, body) {
    if (!urlString || !shouldInspectContextUrl(urlString)) return;

    let parsedBody = null;

    if (typeof body === 'string') {
      parsedBody = parseJsonSafe(body);
    } else if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      parsedBody = Object.fromEntries(body.entries());
    } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
      parsedBody = {};
      body.forEach((value, key) => {
        parsedBody[key] = typeof value === 'string' ? value : '[binary]';
      });
    } else if (body && typeof body === 'object' && !Array.isArray(body)) {
      parsedBody = body;
    }

    if (!parsedBody || typeof parsedBody !== 'object') return;

    mergeResolverState({
      conversationId: parsedBody.conversationId || parsedBody.conversation_id || null,
      locationId: parsedBody.locationId || parsedBody.location_id || null,
      contactId: parsedBody.contactId || parsedBody.contact_id || null
    }, `network:request:${method}`);
  }

  function processResourceEntry(entry, source = 'network:resource') {
    if (!isNetworkResource(entry)) return;
    if (!shouldInspectContextUrl(entry.name)) return;
    processContextFromUrl(entry.name, source);
  }

  function processResourceEntries(entries, source = 'network:resource-batch') {
    if (!entries || entries.length === 0) return;
    for (const entry of entries) {
      processResourceEntry(entry, source);
    }
  }

  function enqueueObservedEntries(entries) {
    if (!entries || entries.length === 0) return;
    pendingObservedEntries.push(...entries);

    if (pendingObservedEntriesTimer) return;
    pendingObservedEntriesTimer = setTimeout(() => {
      const batch = pendingObservedEntries;
      pendingObservedEntries = [];
      pendingObservedEntriesTimer = null;
      processResourceEntries(batch, 'network:performance-observer');
    }, RESOURCE_OBSERVER_BATCH_MS);
  }

  function scanExistingResourceEntries(force = false) {
    if (!window.performance || !performance.getEntriesByType) return;

    const now = Date.now();
    if (!force && now - lastResourceScanAt < RESOURCE_SCAN_MIN_INTERVAL_MS) return;
    lastResourceScanAt = now;

    const entries = performance.getEntriesByType('resource') || [];
    if (entries.length < lastProcessedResourceEntryCount) {
      lastProcessedResourceEntryCount = 0;
    }

    const startIndex = force ? 0 : lastProcessedResourceEntryCount;
    for (let i = startIndex; i < entries.length; i++) {
      processResourceEntry(entries[i], 'network:resource-scan');
    }
    lastProcessedResourceEntryCount = entries.length;
  }

  function initNetworkInterceptors() {
    if (networkInterceptorsInitialized) return;
    networkInterceptorsInitialized = true;

    try {
      if (typeof window.fetch === 'function') {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async function(...args) {
          const requestInfo = args[0];
          const requestInit = args[1] || {};
          const requestUrl = typeof requestInfo === 'string' ? requestInfo : (requestInfo && requestInfo.url) || '';
          const requestMethod = String(requestInit.method || (requestInfo && requestInfo.method) || 'GET').toUpperCase();

          if (requestUrl) {
            processContextFromUrl(requestUrl, `network:fetch:${requestMethod}:request`);
            inspectRequestBodyForContext(requestUrl, requestMethod, requestInit.body);
          }

          const response = await originalFetch(...args);

          if (requestUrl && shouldInspectContextUrl(requestUrl)) {
            try {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const cloned = response.clone();
                const payload = await cloned.json();
                inspectNetworkPayload(requestUrl, payload, `network:fetch:${requestMethod}:response`);
              }
            } catch (error) {
              // payload parsing failure should never break page fetches
            }
          }

          return response;
        };
      }
    } catch (error) {
      console.warn('[Context Resolver] Falha ao inicializar interceptor de fetch.', error);
    }

    try {
      if (typeof XMLHttpRequest !== 'undefined') {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this.__mediaSuiteUrl = url;
          this.__mediaSuiteMethod = String(method || 'GET').toUpperCase();
          return originalOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function(body) {
          try {
            if (this.__mediaSuiteUrl) {
              processContextFromUrl(this.__mediaSuiteUrl, `network:xhr:${this.__mediaSuiteMethod}:request`);
              inspectRequestBodyForContext(this.__mediaSuiteUrl, this.__mediaSuiteMethod, body);
            }
          } catch (error) {
            // no-op
          }

          this.addEventListener('load', () => {
            try {
              if (!this.__mediaSuiteUrl || !shouldInspectContextUrl(this.__mediaSuiteUrl)) return;
              if (typeof this.responseText !== 'string' || this.responseText.length === 0) return;
              const payload = parseJsonSafe(this.responseText);
              if (payload) {
                inspectNetworkPayload(this.__mediaSuiteUrl, payload, `network:xhr:${this.__mediaSuiteMethod}:response`);
              }
            } catch (error) {
              // no-op
            }
          }, { once: true });

          return originalSend.call(this, body);
        };
      }
    } catch (error) {
      console.warn('[Context Resolver] Falha ao inicializar interceptor de XMLHttpRequest.', error);
    }
  }

  function initConversationObserver() {
    if (conversationObserverInitialized) return;
    conversationObserverInitialized = true;

    try {
      scanExistingResourceEntries(true);

      if (typeof PerformanceObserver !== 'function') {
        console.warn('[Conversation Resolver] PerformanceObserver indisponível neste navegador.');
        return;
      }

      conversationPerformanceObserver = new PerformanceObserver((list) => {
        enqueueObservedEntries(list.getEntries());
      });

      conversationPerformanceObserver.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('[Conversation Resolver] Falha ao iniciar observer de network.', error);
    }
  }

  function getConversationId() {
    scanExistingResourceEntries();
    return conversationResolverState.conversationId;
  }

  function getLocationId() {
    scanExistingResourceEntries();
    return conversationResolverState.locationId;
  }

  function getResolverSnapshot() {
    scanExistingResourceEntries();
    return { ...conversationResolverState };
  }

  function getCachedConversationContext(conversationId) {
    const cachedEntry = conversationContextCache.get(conversationId);
    if (!cachedEntry) return null;

    if (cachedEntry.expiresAt <= Date.now()) {
      conversationContextCache.delete(conversationId);
      return null;
    }

    return { ...cachedEntry.value };
  }

  function setCachedConversationContext(conversationId, context) {
    conversationContextCache.set(conversationId, {
      value: { ...context },
      expiresAt: Date.now() + CONFIG.conversationContextTtlMs
    });
  }

  // ============================================
  // 12. BUSCAR CONTACT ID DA CONVERSA
  // ============================================

  async function getConversationContext(conversationId) {
    if (!conversationId) {
      throw new Error('ConversationId é obrigatório para obter o contexto.');
    }

    const cachedContext = getCachedConversationContext(conversationId);
    if (cachedContext) {
      log(`Contexto da conversa ${conversationId} carregado do cache`);
      return cachedContext;
    }

    if (conversationContextInflight.has(conversationId)) {
      log(`Reutilizando busca de contexto em andamento para ${conversationId}`);
      return conversationContextInflight.get(conversationId);
    }

    const contextPromise = (async () => {
      const resolverSnapshot = getResolverSnapshot();
      const snapshotMatchesConversation =
        resolverSnapshot.conversationId === conversationId;

      const context = {
        conversationId,
        locationId: snapshotMatchesConversation ? resolverSnapshot.locationId || null : null,
        contactId: snapshotMatchesConversation ? resolverSnapshot.contactId || null : null,
        conversationType: snapshotMatchesConversation ? resolverSnapshot.conversationType ?? null : null,
        conversationProviderId: snapshotMatchesConversation
          ? (resolverSnapshot.conversationProviderId || resolverSnapshot.lastMessageConversationProviderId || null)
          : null,
        lastMessageType: snapshotMatchesConversation ? resolverSnapshot.lastMessageType || null : null,
        searchTypeHint: snapshotMatchesConversation ? resolverSnapshot.searchTypeHint || null : null,
        messageType: 'SMS'
      };

      // 1) Buscar dados da conversa (fonte primária para contactId e tipo)
      try {
        log(`Buscando dados da conversa: ${conversationId}`);

        const conversationResponse = await fetch(`${CONFIG.getMessagesEndpoint}/${conversationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion
          }
        });

        if (!conversationResponse.ok) {
          const errorText = await conversationResponse.text();
          throw new Error(`Erro ao buscar conversa: ${conversationResponse.status} - ${errorText}`);
        }

        const conversationData = await conversationResponse.json();
        log('Resposta da API de conversa:', conversationData);

        const conversationRecord =
          conversationData && typeof conversationData === 'object' && conversationData.conversation
            ? conversationData.conversation
            : conversationData;

        const conversationRecordId = extractRecordConversationId(conversationRecord);

        if (
          conversationRecord &&
          typeof conversationRecord === 'object' &&
          (!conversationRecordId || conversationRecordId === conversationId)
        ) {
          if (conversationRecord.locationId) {
            context.locationId = conversationRecord.locationId;
          }

          if (conversationRecord.contactId) {
            context.contactId = conversationRecord.contactId;
            log('ContactId extraído da conversa:', context.contactId);
          }

          if (conversationRecord.type !== undefined) {
            context.conversationType = conversationRecord.type;
          }

          if (conversationRecord.conversationProviderId || conversationRecord.lastMessageConversationProviderId) {
            context.conversationProviderId =
              conversationRecord.conversationProviderId ||
              conversationRecord.lastMessageConversationProviderId;
          }

          if (conversationRecord.lastMessageType) {
            context.lastMessageType = conversationRecord.lastMessageType;
          }
        } else if (conversationRecordId && conversationRecordId !== conversationId) {
          log(
            `Contexto da conversa ignorado por mismatch de ID. Esperado: ${conversationId}, recebido: ${conversationRecordId}`
          );
        }
      } catch (error) {
        log('ERRO ao buscar dados da conversa:', error);
      }

      // 2) Fallback na API de mensagens para provider/tipo quando necessário
      const shouldFetchMessagesFallback =
        !context.contactId ||
        !context.lastMessageType ||
        !context.conversationProviderId;

      if (shouldFetchMessagesFallback) {
        try {
          log(`Buscando última mensagem da conversa: ${conversationId}`);

          const messagesResponse = await fetch(`${CONFIG.getMessagesEndpoint}/${conversationId}/messages?limit=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${CONFIG.apiKey}`,
              'Version': CONFIG.apiVersion
            }
          });

          if (!messagesResponse.ok) {
            const errorText = await messagesResponse.text();
            throw new Error(`Erro ao buscar mensagens: ${messagesResponse.status} - ${errorText}`);
          }

          const messagesResult = await messagesResponse.json();
          log('Resposta da API de mensagens:', messagesResult);

          const messagesList =
            messagesResult &&
            messagesResult.messages &&
            messagesResult.messages.messages &&
            messagesResult.messages.messages.length > 0
              ? messagesResult.messages.messages
              : [];

          const lastMessage =
            messagesList.find(message => {
              if (!message || typeof message !== 'object') return false;
              return !message.conversationId || message.conversationId === conversationId;
            }) || null;

          if (lastMessage) {
            if (lastMessage.locationId) {
              context.locationId = lastMessage.locationId;
            }

            if (lastMessage.contactId) {
              context.contactId = lastMessage.contactId;
              log('ContactId extraído da última mensagem:', context.contactId);
            }

            if (lastMessage.conversationProviderId) {
              context.conversationProviderId = lastMessage.conversationProviderId;
            }

            if (lastMessage.messageType) {
              context.lastMessageType = lastMessage.messageType;
            }
          }
        } catch (error) {
          log('ERRO ao buscar fallback de mensagens da conversa:', error);
        }
      }

      if (!context.contactId) {
        throw new Error('Não foi possível identificar o contactId da conversa.');
      }

      context.messageType = detectMessageType(context);

      if (context.messageType === 'Custom' && !context.conversationProviderId) {
        throw new Error('Conversa do tipo Custom sem conversationProviderId disponível.');
      }

      mergeResolverState({
        conversationId: context.conversationId,
        locationId: context.locationId,
        contactId: context.contactId,
        conversationType: context.conversationType,
        conversationProviderId: context.conversationProviderId,
        lastMessageConversationProviderId: context.conversationProviderId,
        lastMessageType: context.lastMessageType,
        searchTypeHint: context.searchTypeHint
      }, 'conversation-context');

      setCachedConversationContext(conversationId, context);
      return { ...context };
    })();

    conversationContextInflight.set(conversationId, contextPromise);

    try {
      return await contextPromise;
    } finally {
      conversationContextInflight.delete(conversationId);
    }
  }

  // ============================================
  // 13. DETECTAR TIPO DE MENSAGEM
  // ============================================

  function detectMessageType(context = {}) {
    const rawMessageType = String(context.lastMessageType || '').toUpperCase();
    const rawSearchTypeHint = String(context.searchTypeHint || '').toUpperCase();
    const typeHint = `${rawMessageType} ${rawSearchTypeHint}`.trim();
    const conversationType = Number(context.conversationType);

    if (typeHint.includes('CUSTOM')) {
      log('Tipo de mensagem detectado: Custom');
      return 'Custom';
    }

    if (typeHint.includes('WHATSAPP')) {
      log('Tipo de mensagem detectado: WhatsApp');
      return 'WhatsApp';
    }

    if (
      typeHint.includes('FACEBOOK') ||
      typeHint.includes('MESSENGER') ||
      typeHint.includes('_FB')
    ) {
      log('Tipo de mensagem detectado: FB');
      return 'FB';
    }

    if (
      typeHint.includes('INSTAGRAM') ||
      typeHint.includes('_IG') ||
      typeHint.includes('TYPE_IG')
    ) {
      log('Tipo de mensagem detectado: IG');
      return 'IG';
    }

    if (typeHint.includes('EMAIL')) {
      log('Tipo de mensagem detectado: Email');
      return 'Email';
    }

    if (typeHint.includes('LIVE_CHAT')) {
      log('Tipo de mensagem detectado: Live_Chat');
      return 'Live_Chat';
    }

    if (typeHint.includes('INTERNAL')) {
      log('Tipo de mensagem detectado: InternalComment');
      return 'InternalComment';
    }

    // Fallback com base no tipo numérico da conversa
    if (conversationType === 2) {
      log('Tipo de mensagem detectado por fallback: Email');
      return 'Email';
    }

    if (conversationType === 3) {
      log('Tipo de mensagem detectado por fallback: FB');
      return 'FB';
    }

    log('Tipo de mensagem detectado por fallback: SMS');
    return 'SMS';
  }

  // ============================================
  // 14. FAZER UPLOAD DE UM ARQUIVO
  // ============================================

  async function uploadFile(file, conversationId) {
    try {
      log(`Iniciando upload do arquivo: ${file.name}`);

      const formData = new FormData();
      formData.append('conversationId', conversationId);
      formData.append('fileAttachment', file);

      const response = await fetch(CONFIG.uploadEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'Version': CONFIG.apiVersion
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro no upload: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log(`Upload concluído: ${file.name}`, result);

      // Extrair a URL do resultado
      // A API retorna: { uploadedFiles: { "filename.jpg": "url" }, traceId: "..." }
      let fileUrl = null;

      if (result.uploadedFiles && typeof result.uploadedFiles === 'object') {
        // Pegar a primeira (e única) URL do objeto uploadedFiles
        const urls = Object.values(result.uploadedFiles);
        fileUrl = urls[0];
        log(`URL extraída de uploadedFiles para ${file.name}:`, fileUrl);
      } else {
        // Fallback para outros formatos possíveis
        fileUrl = result.url || result.fileUrl || result.uploadedUrl;
        log(`URL extraída de campos alternativos para ${file.name}:`, fileUrl);
      }

      if (!fileUrl) {
        log('ERRO: URL não encontrada no resultado do upload. Estrutura:', result);
        throw new Error('URL do arquivo não foi retornada pela API');
      }

      return fileUrl;

    } catch (error) {
      log(`ERRO ao fazer upload do arquivo ${file.name}:`, error);
      throw error;
    }
  }

  // ============================================
  // 14.1 UPLOAD DE VÍDEO GRANDE VIA MEDIA STORAGE
  // ============================================

  async function uploadFileToMediaStorage(file) {
    try {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      log(`Iniciando upload via Media Storage: ${file.name} (${sizeMB}MB)`);

      const locationId = getLocationId();
      if (!locationId) {
        throw new Error('Location ID não encontrado via network para upload via Media Storage');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('hosted', 'false');

      const response = await fetch(
        `${CONFIG.mediaUploadEndpoint}?altId=${locationId}&altType=location`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro no upload via Media Storage: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log('Upload via Media Storage concluído:', result);

      const fileUrl = result.url || (result.file && result.file.url) || result.fileUrl;

      if (!fileUrl) {
        log('ERRO: URL não encontrada no resultado do Media Storage. Estrutura:', result);
        throw new Error('URL do arquivo não foi retornada pela API de Media Storage');
      }

      log(`URL do Media Storage: ${fileUrl}`);
      return fileUrl;

    } catch (error) {
      log(`ERRO ao fazer upload via Media Storage ${file.name}:`, error);
      throw error;
    }
  }

  // ============================================
  // 15. ENVIAR MENSAGEM COM ANEXOS
  // ============================================

  async function sendMessageWithAttachments(attachmentUrls, messageText, conversationContext) {
    try {
      log('Enviando mensagens com anexos...');

      const results = [];
      const basePayload = {
        type: conversationContext.messageType,
        contactId: conversationContext.contactId,
        status: 'pending'
      };

      if (conversationContext.conversationProviderId) {
        basePayload.conversationProviderId = conversationContext.conversationProviderId;
      }

      // Se houver texto, enviar a mensagem de texto primeiro
      if (messageText) {
        log('Enviando mensagem de texto...');
        const textPayload = {
          ...basePayload,
          message: messageText,
        };

        const textResponse = await fetch(CONFIG.sendEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Version': CONFIG.apiVersion
          },
          body: JSON.stringify(textPayload)
        });

        if (!textResponse.ok) {
          const errorText = await textResponse.text();
          throw new Error(`Erro ao enviar mensagem de texto: ${textResponse.status} - ${errorText}`);
        }

        const textResult = await textResponse.json();
        log('Mensagem de texto enviada:', textResult);
        results.push(textResult);
      }

      // Enviar cada foto como uma mensagem separada
      for (let i = 0; i < attachmentUrls.length; i++) {
        const url = attachmentUrls[i];
        log(`Enviando foto ${i + 1}/${attachmentUrls.length}: ${url}`);

        const payload = {
          ...basePayload,
          attachments: [url],  // Array com apenas uma URL (string)
        };

        log('Payload da mensagem:', payload);

        const response = await fetch(CONFIG.sendEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Version': CONFIG.apiVersion
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao enviar foto ${i + 1}: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        log(`Foto ${i + 1} enviada com sucesso:`, result);
        results.push(result);
      }

      log('Todas as mensagens foram enviadas:', results);
      return results;

    } catch (error) {
      log('ERRO ao enviar mensagens:', error);
      throw error;
    }
  }

  function normalizeAttachmentUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      const parsed = new URL(url, window.location.origin);
      const normalizedPath = parsed.pathname.replace(/\/+$/, '');
      return `${parsed.origin}${normalizedPath}`.toLowerCase();
    } catch (error) {
      return String(url).split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
    }
  }

  function extractFileNameFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
      const parsed = new URL(url, window.location.origin);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length === 0) return null;
      return decodeURIComponent(pathParts[pathParts.length - 1]).toLowerCase();
    } catch (error) {
      const withoutQuery = String(url).split('#')[0].split('?')[0];
      const segments = withoutQuery.split('/').filter(Boolean);
      return segments.length > 0 ? segments[segments.length - 1].toLowerCase() : null;
    }
  }

  function collectAttachmentUrlsFromValue(value, collector) {
    if (!value) return;

    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        collector.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => collectAttachmentUrlsFromValue(item, collector));
      return;
    }

    if (typeof value !== 'object') return;

    const directUrl =
      value.url ||
      value.link ||
      value.fileUrl ||
      value.secureUrl ||
      value.src ||
      value.previewUrl;

    if (typeof directUrl === 'string') {
      collector.push(directUrl);
    }

    const nestedKeys = ['attachments', 'attachment', 'files', 'file', 'media', 'images', 'videos', 'asset'];
    nestedKeys.forEach(key => {
      if (value[key] !== undefined) {
        collectAttachmentUrlsFromValue(value[key], collector);
      }
    });
  }

  function extractAttachmentUrlsFromMessage(message) {
    if (!message || typeof message !== 'object') return [];

    const collected = [];
    const fieldsToInspect = ['attachments', 'attachment', 'files', 'file', 'media', 'images', 'videos', 'asset'];

    fieldsToInspect.forEach(field => {
      if (message[field] !== undefined) {
        collectAttachmentUrlsFromValue(message[field], collected);
      }
    });

    return Array.from(new Set(collected));
  }

  async function fetchRecentMessages(conversationId, limit = CONFIG.attachmentValidationFetchLimit) {
    const response = await fetch(`${CONFIG.getMessagesEndpoint}/${conversationId}/messages?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Version': CONFIG.apiVersion
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao buscar mensagens para validação: ${response.status} - ${errorText}`);
    }

    const payload = await response.json();

    if (payload && payload.messages && Array.isArray(payload.messages.messages)) {
      return payload.messages.messages;
    }

    if (payload && Array.isArray(payload.messages)) {
      return payload.messages;
    }

    if (payload && Array.isArray(payload.data)) {
      return payload.data;
    }

    return [];
  }

  function evaluateAttachmentDelivery(messages, expectedAttachmentUrls) {
    const expectedDescriptors = expectedAttachmentUrls
      .filter(url => typeof url === 'string' && url.trim())
      .map(rawUrl => ({
        rawUrl,
        normalizedUrl: normalizeAttachmentUrl(rawUrl)
      }));

    const observedNormalizedUrls = new Set();

    messages.forEach(message => {
      const messageAttachmentUrls = extractAttachmentUrlsFromMessage(message);
      messageAttachmentUrls.forEach(url => {
        const normalized = normalizeAttachmentUrl(url);
        if (normalized) {
          observedNormalizedUrls.add(normalized);
        }
      });
    });

    const deliveredUrls = [];
    const missingUrls = [];

    expectedDescriptors.forEach(descriptor => {
      const deliveredByUrl = descriptor.normalizedUrl && observedNormalizedUrls.has(descriptor.normalizedUrl);

      if (deliveredByUrl) {
        deliveredUrls.push(descriptor.rawUrl);
      } else {
        missingUrls.push(descriptor.rawUrl);
      }
    });

    return { deliveredUrls, missingUrls };
  }

  async function validateAttachmentDelivery(conversationId, expectedAttachmentUrls) {
    const expectedUrls = Array.isArray(expectedAttachmentUrls)
      ? expectedAttachmentUrls.filter(url => typeof url === 'string' && url.trim())
      : [];

    if (expectedUrls.length === 0) {
      return {
        ok: true,
        attempts: 0,
        deliveredUrls: [],
        missingUrls: []
      };
    }

    let lastEvaluation = {
      deliveredUrls: [],
      missingUrls: expectedUrls.slice()
    };
    let lastError = null;

    for (let attempt = 1; attempt <= CONFIG.attachmentValidationMaxAttempts; attempt++) {
      try {
        const messages = await fetchRecentMessages(conversationId, CONFIG.attachmentValidationFetchLimit);
        lastEvaluation = evaluateAttachmentDelivery(messages, expectedUrls);

        log(
          `[Validação de anexos] Tentativa ${attempt}/${CONFIG.attachmentValidationMaxAttempts}: ` +
          `${lastEvaluation.deliveredUrls.length}/${expectedUrls.length} confirmado(s)`
        );

        if (lastEvaluation.missingUrls.length === 0) {
          return {
            ok: true,
            attempts: attempt,
            deliveredUrls: lastEvaluation.deliveredUrls,
            missingUrls: []
          };
        }
      } catch (error) {
        lastError = error;
        log(`[Validação de anexos] Erro na tentativa ${attempt}:`, error);
      }

      if (attempt < CONFIG.attachmentValidationMaxAttempts) {
        await delay(CONFIG.attachmentValidationBaseDelayMs * attempt);
      }
    }

    return {
      ok: false,
      attempts: CONFIG.attachmentValidationMaxAttempts,
      deliveredUrls: lastEvaluation.deliveredUrls,
      missingUrls: lastEvaluation.missingUrls,
      error: lastError ? lastError.message : null
    };
  }

  async function uploadFilesWithProgress(files, conversationId, sendBtn) {
    const uploadedUrls = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      sendBtn.innerHTML = `Upload de imagens/áudios (${index + 1}/${files.length})...`;
      const uploadedUrl = await uploadFile(file, conversationId);
      uploadedUrls.push(uploadedUrl);
    }

    return uploadedUrls;
  }

  // ============================================
  // 16. FUNÇÕES PARA PROCESSAMENTO DE VÍDEOS
  // ============================================

  /**
   * Cria um delay baseado em Promise
   * @param {number} ms - Milissegundos para aguardar
   * @returns {Promise<void>}
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualiza o custom field de um contato com a URL do vídeo
   * @param {string} contactId - ID do contato
   * @param {string} videoUrl - URL do vídeo
   * @returns {Promise<Object>} Resposta da API
   */
  async function updateContactCustomField(contactId, videoUrl) {
    try {
      log(`Atualizando custom field do contato ${contactId}`);

      const response = await fetch(`${CONFIG.contactsEndpoint}/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'Version': CONFIG.apiVersion,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customFields: [
            {
              id: CONFIG.customFieldId,
              field_value: videoUrl
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao atualizar custom field: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log('Custom field atualizado com sucesso');
      return result;

    } catch (error) {
      log(`ERRO ao atualizar custom field:`, error);
      throw error;
    }
  }

  /**
   * Adiciona contato a um workflow
   * @param {string} contactId - ID do contato
   * @returns {Promise<Object>} Resposta da API
   */
  async function addContactToWorkflow(contactId) {
    try {
      log(`Adicionando contato ${contactId} ao workflow`);

      const response = await fetch(
        `${CONFIG.contactsEndpoint}/${contactId}/workflow/${CONFIG.workflowId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao adicionar ao workflow: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log('Contato adicionado ao workflow com sucesso');
      return result;

    } catch (error) {
      log(`ERRO ao adicionar contato ao workflow:`, error);
      throw error;
    }
  }

  /**
   * Processa vídeos sequencialmente: upload, atualizar custom field, adicionar ao workflow
   * @param {Array<File>} videoFiles - Array de arquivos de vídeo
   * @param {string} conversationId - ID da conversa
   * @param {string} contactId - ID do contato
   * @param {HTMLButtonElement} sendBtn - Botão de envio (para atualizar UI)
   * @returns {Promise<Array>} Array com resultados do processamento
   */
  async function processVideos(videoFiles, conversationId, contactId, sendBtn) {
    const results = [];

    try {
      log(`Processando ${videoFiles.length} vídeo(s)`);

      for (let i = 0; i < videoFiles.length; i++) {
        const videoFile = videoFiles[i];
        const videoNumber = i + 1;

        try {
          let videoUrl;

          // Verificar se o vídeo veio da galeria (já tem URL)
          if (videoFile.galleryUrl) {
            log(`[Vídeo ${videoNumber}] Vídeo da galeria, usando URL existente: ${videoFile.galleryUrl}`);
            videoUrl = videoFile.galleryUrl;
          } else if (videoFile.size > CONFIG.maxFileSize) {
            // Vídeo grande (>5MB): usar Media Storage (limite 500MB)
            sendBtn.innerHTML = `Processando vídeo ${videoNumber}/${videoFiles.length}: Upload (Media Storage)...`;
            log(`[Vídeo ${videoNumber}] Vídeo grande (${(videoFile.size / 1024 / 1024).toFixed(2)}MB), usando Media Storage: ${videoFile.name}`);
            videoUrl = await uploadFileToMediaStorage(videoFile);
          } else {
            // Vídeo pequeno (<=5MB): usar endpoint de conversas
            sendBtn.innerHTML = `Processando vídeo ${videoNumber}/${videoFiles.length}: Upload...`;
            log(`[Vídeo ${videoNumber}] Fazendo upload de arquivo local: ${videoFile.name}`);
            videoUrl = await uploadFile(videoFile, conversationId);
          }

          // Update custom field
          sendBtn.innerHTML = `Processando vídeo ${videoNumber}/${videoFiles.length}: Atualizando contato...`;
          await updateContactCustomField(contactId, videoUrl);

          // Add to workflow
          sendBtn.innerHTML = `Processando vídeo ${videoNumber}/${videoFiles.length}: Ativando workflow...`;
          await addContactToWorkflow(contactId);

          results.push({ file: videoFile.name, url: videoUrl, success: true });
          log(`[Vídeo ${videoNumber}] Processado com sucesso`);

          // Delay antes do próximo (exceto no último)
          if (i < videoFiles.length - 1) {
            sendBtn.innerHTML = `Aguardando ${CONFIG.videoProcessingDelay / 1000}s...`;
            await delay(CONFIG.videoProcessingDelay);
          }

        } catch (videoError) {
          log(`ERRO ao processar vídeo ${videoFile.name}:`, videoError);
          results.push({ file: videoFile.name, success: false, error: videoError.message });

          const continueProcessing = confirm(
            `Erro ao processar vídeo "${videoFile.name}":\n${videoError.message}\n\nContinuar com próximos?`
          );

          if (!continueProcessing) {
            throw new Error(`Processamento interrompido`);
          }
        }
      }

      return results;

    } catch (error) {
      log('ERRO no processamento de vídeos:', error);
      throw error;
    }
  }

  // ============================================
  // 17. BUSCAR PASTAS DE MÍDIA
  // ============================================

  async function fetchMediaFolders() {
    if (!isModalOpen()) return;

    mediaLibraryState.loading.folders = true;
    renderFoldersLoading();

    try {
      const locationId = getLocationId();
      if (!locationId) {
        throw new Error('Location ID não encontrado via network');
      }

      const response = await fetch(
        `${CONFIG.mediaLibraryEndpoint}?type=folder&altType=location&altId=${locationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pastas: ${response.status}`);
      }

      const data = await response.json();
      if (!isModalOpen()) return;

      mediaLibraryState.folders = data.files || [];
      log('Pastas carregadas:', mediaLibraryState.folders.length);

      // Buscar subpastas de todas as pastas raiz (eager loading)
      log('Buscando subpastas de todas as pastas raiz...');
      for (const folder of mediaLibraryState.folders) {
        const subfolders = await fetchSubfolders(folder._id);
        if (subfolders.length > 0) {
          mediaLibraryState.foldersTree[folder._id] = subfolders;
          log(`Pasta "${folder.name}" tem ${subfolders.length} subpasta(s)`);
        }
        if (!isModalOpen()) return;
      }

      renderFoldersList();

      // Auto-selecionar primeira pasta
      if (mediaLibraryState.folders.length > 0) {
        selectFolder(mediaLibraryState.folders[0]);
      } else {
        renderMediasEmpty('Nenhuma pasta encontrada');
      }

    } catch (error) {
      log('ERRO ao buscar pastas:', error);
      renderFoldersError(error.message);
    } finally {
      mediaLibraryState.loading.folders = false;
    }
  }

  // ============================================
  // 17.1 BUSCAR SUBPASTAS DE UMA PASTA
  // ============================================

  async function fetchSubfolders(parentFolderId) {
    try {
      log(`Buscando subpastas de: ${parentFolderId}`);

      const response = await fetch(
        `${CONFIG.mediaLibraryEndpoint}?type=folder&parentId=${parentFolderId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar subpastas: ${response.status}`);
      }

      const data = await response.json();
      const subfolders = data.files || [];
      log(`Subpastas encontradas: ${subfolders.length}`);

      return subfolders;
    } catch (error) {
      log('ERRO ao buscar subpastas:', error);
      return [];
    }
  }

  // ============================================
  // 18. BUSCAR MÍDIAS DE UMA PASTA
  // ============================================

  async function fetchMediasFromFolder(folder) {
    if (!isModalOpen()) return;

    mediaLibraryState.loading.medias = true;
    mediaLibraryState.currentFolder = folder;
    renderMediasLoading();

    try {
      const response = await fetch(
        `${CONFIG.mediaLibraryEndpoint}?type=file&parentId=${folder._id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CONFIG.apiKey}`,
            'Version': CONFIG.apiVersion
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar mídias: ${response.status}`);
      }

      const data = await response.json();
      if (!isModalOpen()) return;

      // Filtrar apenas imagens, vídeos e áudios
      mediaLibraryState.medias = (data.files || []).filter(file => {
        const type = file.contentType || '';
        return type.startsWith('image/') ||
               type.startsWith('video/') ||
               type.startsWith('audio/');
      });

      log(`Mídias carregadas: ${mediaLibraryState.medias.length} de ${folder.name}`);
      renderMediaGrid();

    } catch (error) {
      log('ERRO ao buscar mídias:', error);
      renderMediasError(error.message);
    } finally {
      mediaLibraryState.loading.medias = false;
    }
  }

  // ============================================
  // 19. RENDER LISTA DE PASTAS
  // ============================================

  function renderFoldersLoading() {
    const foldersContainer = getModalElement('folders-list');
    if (!foldersContainer) return;

    foldersContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Carregando...</p>
      </div>
    `;
  }

  function renderFoldersError(message) {
    const foldersContainer = getModalElement('folders-list');
    if (!foldersContainer) return;

    foldersContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px 10px;">
        <p style="font-size: 13px; color: #ef4444;">${message}</p>
      </div>
    `;
  }

  function renderFoldersList() {
    const foldersContainer = getModalElement('folders-list');
    if (!foldersContainer) return;

    if (mediaLibraryState.folders.length === 0) {
      foldersContainer.innerHTML = `
        <div class="empty-state" style="padding: 20px 10px;">
          <p style="font-size: 13px; color: #9ca3af;">Nenhuma pasta encontrada</p>
        </div>
      `;
      return;
    }

    // Renderizar árvore hierárquica
    const renderFolderItem = (folder, level = 0) => {
      const isActive = folder._id === mediaLibraryState.currentFolder?._id;
      const isExpanded = mediaLibraryState.expandedFolders.has(folder._id);
      const hasChildren = mediaLibraryState.foldersTree[folder._id]?.length > 0;

      const expandButton = `
        <button class="folder-expand ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder._id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      `;

      let html = `
        <div class="folder-item ${isActive ? 'active' : ''} ${hasChildren ? 'has-children' : ''}"
             data-folder-id="${folder._id}"
             style="padding-left: ${level * 12 + 10}px;">
          ${hasChildren ? expandButton : '<div style="width: 20px;"></div>'}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span class="folder-name">${folder.name}</span>
        </div>
      `;

      // Renderizar filhos se expandido
      if (isExpanded && hasChildren) {
        html += `<div class="folder-children">`;
        mediaLibraryState.foldersTree[folder._id].forEach(childFolder => {
          html += renderFolderItem(childFolder, level + 1);
        });
        html += `</div>`;
      }

      return html;
    };

    // Renderizar todas as pastas raiz
    foldersContainer.innerHTML = mediaLibraryState.folders.map(folder => renderFolderItem(folder)).join('');

    // Adicionar event listeners para expansão
    foldersContainer.querySelectorAll('.folder-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const folderId = btn.dataset.folderId;
        toggleFolderExpansion(folderId, e);
      });
    });

    // Adicionar event listeners para seleção de pasta
    foldersContainer.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Se clicou no botão de expansão, não faz nada (já tratado acima)
        if (e.target.closest('.folder-expand')) return;

        const folderId = item.dataset.folderId;
        // Procurar pasta em todos os níveis
        const folder = findFolderById(folderId);
        if (folder) {
          selectFolder(folder);
        }
      });
    });
  }

  // Função auxiliar para encontrar pasta por ID em qualquer nível da árvore
  function findFolderById(folderId) {
    // Procurar nas pastas raiz
    let folder = mediaLibraryState.folders.find(f => f._id === folderId);
    if (folder) return folder;

    // Procurar nas subpastas
    for (const parentId in mediaLibraryState.foldersTree) {
      folder = mediaLibraryState.foldersTree[parentId].find(f => f._id === folderId);
      if (folder) return folder;
    }

    return null;
  }

  function selectFolder(folder) {
    mediaLibraryState.currentFolder = folder;
    mediaLibraryState.selectedMedias = []; // Limpar seleção ao trocar pasta

    // Gerenciar hierarquia:
    // Se a pasta já está na hierarquia, truncar após ela
    const existingIndex = mediaLibraryState.folderHierarchy.findIndex(f => f._id === folder._id);
    if (existingIndex !== -1) {
      mediaLibraryState.folderHierarchy = mediaLibraryState.folderHierarchy.slice(0, existingIndex + 1);
    } else {
      // Senão, adicionar ao final
      mediaLibraryState.folderHierarchy.push(folder);
    }

    log('Hierarquia atualizada:', mediaLibraryState.folderHierarchy.map(f => f.name));

    renderFoldersList(); // Re-render para atualizar active state
    fetchMediasFromFolder(folder);
  }

  // ============================================
  // 19. TOGGLE EXPANSÃO DE PASTA
  // ============================================

  async function toggleFolderExpansion(folderId, event) {
    event?.stopPropagation(); // Evitar trigger do selectFolder

    log(`Toggle expansion: ${folderId}`);

    if (mediaLibraryState.expandedFolders.has(folderId)) {
      // Colapsar
      mediaLibraryState.expandedFolders.delete(folderId);
      log(`Pasta colapsada: ${folderId}`);
    } else {
      // Expandir - buscar subpastas
      mediaLibraryState.expandedFolders.add(folderId);
      log(`Pasta expandida: ${folderId}`);

      // Se não tem filhos carregados, buscar
      if (!mediaLibraryState.foldersTree[folderId]) {
        const subfolders = await fetchSubfolders(folderId);
        mediaLibraryState.foldersTree[folderId] = subfolders;
        log(`Subpastas carregadas: ${subfolders.length}`);

        // Buscar subpastas das subpastas (suporte a múltiplos níveis)
        for (const subfolder of subfolders) {
          const subsubfolders = await fetchSubfolders(subfolder._id);
          if (subsubfolders.length > 0) {
            mediaLibraryState.foldersTree[subfolder._id] = subsubfolders;
            log(`Subpasta "${subfolder.name}" tem ${subsubfolders.length} subpasta(s)`);
          }
        }
      }
    }

    renderFoldersList();
  }

  // ============================================
  // 20. RENDER GRID DE MÍDIAS
  // ============================================

  function renderMediasLoading() {
    const gridContainer = getModalElement('media-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Carregando mídias...</p>
      </div>
    `;
  }

  function renderMediasError(message) {
    const gridContainer = getModalElement('media-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = `
      <div class="empty-state">
        <p style="color: #ef4444;">${message}</p>
      </div>
    `;
  }

  function renderMediasEmpty(message) {
    const gridContainer = getModalElement('media-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>${message}</p>
      </div>
    `;
  }

  function getFilteredMedias() {
    const query = mediaLibraryState.searchQuery.toLowerCase();
    if (!query) return mediaLibraryState.medias;

    return mediaLibraryState.medias.filter(media =>
      media.name.toLowerCase().includes(query)
    );
  }

  function renderMediaGrid() {
    const gridContainer = getModalElement('media-grid');
    const countEl = getModalElement('media-count');
    if (!gridContainer || !countEl) return;

    // Atualizar contador
    const filteredMedias = getFilteredMedias();
    countEl.textContent = `${filteredMedias.length} mídia${filteredMedias.length !== 1 ? 's' : ''}`;

    if (filteredMedias.length === 0) {
      renderMediasEmpty(mediaLibraryState.searchQuery ? 'Nenhuma mídia encontrada' : 'Esta pasta está vazia');
      return;
    }

    gridContainer.innerHTML = filteredMedias.map(media => {
      const isSelected = mediaLibraryState.selectedMedias.some(m => m._id === media._id);
      const contentType = media.contentType || '';
      const isImage = contentType.startsWith('image/');
      const isVideo = contentType.startsWith('video/');
      const isAudio = contentType.startsWith('audio/');

      let preview = '';
      if (isImage) {
        preview = `<img src="${media.url}" alt="${media.name}" loading="lazy">`;
      } else if (isVideo) {
        preview = `<video src="${media.url}" muted></video>`;
      } else if (isAudio) {
        preview = `<div class="media-item-icon">🎵</div>`;
      }

      return `
        <div class="media-item ${isSelected ? 'selected' : ''}"
             data-media-id="${media._id}">
          ${preview}
          <div class="media-item-checkbox"></div>
          <div class="media-item-name">${media.name}</div>
        </div>
      `;
    }).join('');

    // Adicionar event listeners
    gridContainer.querySelectorAll('.media-item').forEach(item => {
      item.addEventListener('click', () => {
        const mediaId = item.dataset.mediaId;
        toggleMediaSelection(mediaId);
      });
    });
  }

  // ============================================
  // 21. SISTEMA DE SELEÇÃO
  // ============================================

  function toggleMediaSelection(mediaId) {
    const media = mediaLibraryState.medias.find(m => m._id === mediaId);
    if (!media) return;

    const index = mediaLibraryState.selectedMedias.findIndex(m => m._id === mediaId);

    if (index > -1) {
      // Remover seleção
      mediaLibraryState.selectedMedias.splice(index, 1);
      log('Mídia removida da seleção:', media.name);
    } else {
      // Adicionar seleção
      mediaLibraryState.selectedMedias.push(media);
      log('Mídia adicionada à seleção:', media.name);
    }

    renderMediaGrid(); // Re-render para atualizar visual
  }

  // ============================================
  // 22. CONVERTER URL PARA FILE
  // ============================================

  async function convertUrlToFile(media) {
    try {
      log(`Baixando mídia: ${media.name}`);

      const response = await fetch(media.url);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const compactError = errorText ? ` - ${errorText.slice(0, 180)}` : '';
        throw new Error(`Erro ao baixar mídia (${response.status})${compactError}`);
      }

      const blob = await response.blob();

      // Criar File object a partir do blob
      const file = new File([blob], media.name, {
        type: media.contentType,
        lastModified: new Date(media.updatedAt).getTime()
      });

      // IMPORTANTE: Adicionar URL da galeria ao File object
      // Para que vídeos da galeria não precisem ser re-uploadados
      file.galleryUrl = media.url;

      log(`Mídia convertida: ${media.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return file;

    } catch (error) {
      log(`ERRO ao baixar mídia ${media.name}:`, error);
      throw error;
    }
  }

  // ============================================
  // 23. ADICIONAR MÍDIAS DA GALERIA À FILA
  // ============================================

  async function addGalleryMediasToQueue() {
    if (mediaLibraryState.selectedMedias.length === 0) {
      return;
    }

    const sendBtn = getModalElement('modal-send-btn');
    if (!sendBtn) return;

    const originalText = sendBtn.innerHTML;

    try {
      sendBtn.disabled = true;

      // Converter cada URL em File object
      for (let i = 0; i < mediaLibraryState.selectedMedias.length; i++) {
        if (!isModalOpen()) return;

        const media = mediaLibraryState.selectedMedias[i];
        sendBtn.innerHTML = `Carregando ${i + 1}/${mediaLibraryState.selectedMedias.length}...`;

        const file = await convertUrlToFile(media);
        if (!isModalOpen()) return;

        // Adicionar à fila (mesmo fluxo de arquivos locais)
        selectedFiles.push(file);
        addFileToList(file);
      }

      // Limpar seleção da galeria
      mediaLibraryState.selectedMedias = [];
      renderMediaGrid();

      // Voltar para aba Upload para ver os arquivos
      switchTab('upload');

    } catch (error) {
      log('ERRO ao adicionar mídias da galeria:', error);
      alert('Erro ao carregar mídias da galeria. Tente novamente.');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalText;
    }
  }

  // ============================================
  // 24. SISTEMA DE ABAS
  // ============================================

  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });
  }

  function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabName);
    });

    // Se abriu galeria pela primeira vez, carregar pastas
    if (tabName === 'gallery' && mediaLibraryState.folders.length === 0) {
      fetchMediaFolders();
    }
  }

  // ============================================
  // 25. PROCESSAR ENVIO COMPLETO
  // ============================================

  async function handleSendFiles() {
    const sendBtn = document.getElementById('modal-send-btn');
    const messageTextarea = document.getElementById('message-text');
    const originalBtnText = sendBtn.innerHTML;

    try {
      // Adicionar mídias da galeria à fila, se houver seleções
      if (mediaLibraryState.selectedMedias.length > 0) {
        await addGalleryMediasToQueue();
      }

      // Verificar se há arquivos para enviar
      if (selectedFiles.length === 0) {
        alert('Por favor, selecione pelo menos um arquivo para enviar.');
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalBtnText;
        return;
      }

      // Desabilitar botão e mostrar loading
      sendBtn.disabled = true;
      sendBtn.innerHTML = 'Processando...';

      // Resolver conversationId via observer de network
      const conversationId = getConversationId();
      if (!conversationId) {
        throw new Error('Não foi possível identificar a conversa via network. Abra a conversa e aguarde carregar as mensagens.');
      }

      // Buscar contexto completo da conversa
      sendBtn.innerHTML = 'Buscando informações...';
      const conversationContext = await getConversationContext(conversationId);
      const contactId = conversationContext.contactId;
      const messageType = conversationContext.messageType;
      const messageText = messageTextarea ? messageTextarea.value.trim() : '';

      log(`Processando envio - ConversationId: ${conversationId}, ContactId: ${contactId}, Type: ${messageType}, Provider: ${conversationContext.conversationProviderId || 'n/a'}`);

      // ========================================
      // SEPARAR VÍDEOS DE OUTRAS MÍDIAS
      // ========================================

      const videoFiles = selectedFiles.filter(file => file.type.startsWith('video/'));
      const nonVideoFiles = selectedFiles.filter(file => !file.type.startsWith('video/'));

      log(`Separação: ${nonVideoFiles.length} imagem/áudio, ${videoFiles.length} vídeo(s)`);

      // ========================================
      // ETAPA 1: PROCESSAR IMAGENS/ÁUDIOS (chat)
      // ========================================

      if (nonVideoFiles.length > 0) {
        log('Processando imagens/áudios para envio no chat');

        sendBtn.innerHTML = `Upload de imagens/áudios (0/${nonVideoFiles.length})...`;
        const nonVideoUrls = await uploadFilesWithProgress(nonVideoFiles, conversationId, sendBtn);
        log('Upload de imagens/áudios concluído:', nonVideoUrls);

        sendBtn.innerHTML = 'Enviando mensagens...';
        await sendMessageWithAttachments(nonVideoUrls, messageText, conversationContext);

        sendBtn.innerHTML = 'Validando envio das mídias...';
        const deliveryValidation = await validateAttachmentDelivery(conversationId, nonVideoUrls);
        if (!deliveryValidation.ok) {
          log('Falha na validação de entrega das mídias:', deliveryValidation);
          throw new Error(
            `As mídias foram enviadas, mas ${deliveryValidation.missingUrls.length} anexo(s) ` +
            `não apareceram no chat após ${deliveryValidation.attempts} tentativa(s).`
          );
        }

        log('Imagens/áudios enviados e validados no chat');
      } else {
        log('Nenhuma imagem/áudio para processar');
      }

      // ========================================
      // ETAPA 2: PROCESSAR VÍDEOS (CUSTOM FIELD + WORKFLOW)
      // ========================================

      if (videoFiles.length > 0) {
        log('Processando vídeos via custom field + workflow');

        const videoResults = await processVideos(
          videoFiles,
          conversationId,
          contactId,
          sendBtn
        );

        // Verificar se houve erros
        const failedVideos = videoResults.filter(r => !r.success);
        if (failedVideos.length > 0) {
          log(`Alguns vídeos falharam: ${failedVideos.length}/${videoFiles.length}`);
          const failedNames = failedVideos.map(v => `- ${v.file}: ${v.error}`).join('\n');
          alert(`Atenção: ${failedVideos.length} vídeo(s) com erro:\n\n${failedNames}`);
        }

        log('Processamento de vídeos concluído:', videoResults);
      } else {
        log('Nenhum vídeo para processar');
      }

      // ========================================
      // SUCESSO FINAL
      // ========================================

      sendBtn.innerHTML = '✓ Enviado!';
      log('Processo completo! Todos os arquivos foram processados.');

      // Fechar modal após 1 segundo
      setTimeout(() => {
        const modal = document.getElementById('custom-media-upload-modal');
        if (modal) {
          modal.remove();
          selectedFiles = [];
        }
      }, 1000);

    } catch (error) {
      log('ERRO no processo de envio:', error);
      sendBtn.innerHTML = '✗ Erro no envio';
      sendBtn.style.background = '#ef4444';

      // Mostrar alerta ao usuário
      alert(`Erro ao enviar arquivos:\n${error.message}`);

      // Restaurar botão após 3 segundos
      setTimeout(() => {
        sendBtn.innerHTML = originalBtnText;
        sendBtn.disabled = false;
        sendBtn.style.background = '';
      }, 3000);
    }
  }

  // ============================================
  // 17. ENCONTRAR E MODIFICAR ÍCONES DE ANEXO
  // ============================================

  function findAndModifyIcons() {
    const paths = document.querySelectorAll(`path[d="${CONFIG.svgPathData}"]`);
    let modifiedCount = 0;

    paths.forEach(path => {
      const svg = path.closest('svg');
      if (svg && !modifiedIcons.has(svg)) {
        modifiedIcons.add(svg);

        // Adicionar event listener no SVG ou no wrapper pai
        const clickTarget = svg.closest('.icon-wrapper') || svg;

        clickTarget.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          log('Ícone de anexo clicado');
          createModal();
        }, true); // useCapture = true para interceptar antes de outros handlers

        modifiedCount++;
        log('Event listener adicionado ao ícone de anexo');
      }
    });

    if (modifiedCount > 0) {
      log(`${modifiedCount} ícone(s) modificado(s) com sucesso`);
    }

    return modifiedCount;
  }

  // ============================================
  // 18. MUTATION OBSERVER PARA SPAs
  // ============================================

  let observer = null;

  function setupMutationObserver() {
    if (observer) {
      log('MutationObserver já está ativo');
      return;
    }

    observer = new MutationObserver((mutations) => {
      let hasNewIcons = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const paths = node.querySelectorAll ?
              node.querySelectorAll(`path[d="${CONFIG.svgPathData}"]`) : [];

            if (paths.length > 0 ||
                (node.tagName === 'path' && node.getAttribute('d') === CONFIG.svgPathData)) {
              hasNewIcons = true;
            }
          }
        });
      });

      if (hasNewIcons) {
        log('Novos ícones detectados pelo MutationObserver');
        setTimeout(() => findAndModifyIcons(), 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    log('MutationObserver configurado');
  }

  // ============================================
  // 19. INICIALIZAÇÃO COM RETRY
  // ============================================

  function initWithRetry(attempt = 1) {
    log(`Tentativa ${attempt} de ${CONFIG.retryAttempts}`);

    const modifiedCount = findAndModifyIcons();

    if (modifiedCount > 0) {
      log('Inicialização bem-sucedida, configurando observer...');
      setupMutationObserver();
      return;
    }

    if (attempt < CONFIG.retryAttempts) {
      log(`Nenhum ícone encontrado, tentando novamente em ${CONFIG.retryDelay}ms...`);
      setTimeout(() => {
        initWithRetry(attempt + 1);
      }, CONFIG.retryDelay);
    } else {
      log('Número máximo de tentativas atingido. Configurando observer...');
      setupMutationObserver();
    }
  }

  // ============================================
  // 20. INICIALIZAÇÃO PRINCIPAL
  // ============================================

  let isInitialized = false;

  function init() {
    log('Iniciando script de upload de mídias...');

    // Captura intenção explícita de clique na lista de conversas.
    initConversationIntentTracking();

    if (!checkDomain()) {
      log('URL atual não corresponde. Aguardando navegação para a location correta...');
      return;
    }

    // Garante resolução de contexto via tráfego de rede
    initNetworkInterceptors();
    initConversationObserver();
    scanExistingResourceEntries();

    if (isInitialized) {
      log('Script já inicializado, apenas buscando novos ícones...');
      findAndModifyIcons();
      return;
    }

    isInitialized = true;

    if (document.readyState === 'loading') {
      log('Aguardando DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded disparado');
        initWithRetry();
      });
    } else {
      log('DOM já está pronto, executando imediatamente');
      initWithRetry();
    }
  }

  // ============================================
  // 21. MONITORAR MUDANÇAS DE URL (SPA)
  // ============================================

  let lastUrl = window.location.href;

  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      log('URL mudou para:', currentUrl);

      // Evita reutilizar contexto de conversa anterior até a nova hidratação via network.
      resetConversationResolverForNavigation('network:url-change');

      // Prioriza os próximos eventos de rede da conversa navegada pelo usuário.
      const urlConversationId = parseConversationIdFromUrl(currentUrl);
      armConversationIntent(urlConversationId, urlConversationId ? 'url-change-hint' : 'url-change');

      // Re-tentar inicialização quando URL mudar
      setTimeout(() => {
        init();
      }, 500);
    }
  }

  // Monitorar mudanças de URL via pushState/replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    checkUrlChange();
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    checkUrlChange();
  };

  window.addEventListener('popstate', checkUrlChange);

  // Fallback: verificar URL periodicamente (para SPAs que não usam history API)
  setInterval(checkUrlChange, CONFIG.urlPollInterval);

  // ============================================
  // 22. EXECUTAR SCRIPT
  // ============================================

  init();

  // Fallback: tentar novamente quando window.load disparar
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
      log('Window load event disparado, verificando novamente...');
      init();
    });
  }

  log('Script carregado e pronto');

})()
