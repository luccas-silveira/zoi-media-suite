(function() {
  'use strict';

  // ============================================
  // 1. CONFIGURAÇÃO E CONSTANTES
  // ============================================

  const CONFIG = {
    targetHostname: 'app.zoitech.com.br',
    targetPathPattern: '/v2/location/cgrcdDk6fuaoP5KQ7scA/conversations/conversations',
    svgPathData: 'M17.5 5.256V16.5a5.5 5.5 0 11-11 0V5.667a3.667 3.667 0 017.333 0v10.779a1.833 1.833 0 11-3.666 0V6.65',
    acceptedFileTypes: 'image/*,video/*,audio/*',
    maxFileSize: 5 * 1024 * 1024, // 5MB em bytes (conversations upload)
    maxVideoFileSize: 500 * 1024 * 1024, // 500MB (Media Storage para vídeos)
    retryAttempts: 5,
    retryDelay: 500,
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
    contactsEndpoint: 'https://services.leadconnectorhq.com/contacts'
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

    // Adicionar estilos
    const style = document.createElement('style');
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
  // 11. EXTRAIR CONVERSATION ID DA URL
  // ============================================

  function getConversationId() {
    // URL pattern: /conversations/conversations/{conversationId}
    const pathParts = window.location.pathname.split('/');
    const conversationsIndex = pathParts.lastIndexOf('conversations');

    if (conversationsIndex !== -1 && pathParts.length > conversationsIndex + 1) {
      const conversationId = pathParts[conversationsIndex + 1];
      log('ConversationId extraído:', conversationId);
      return conversationId;
    }

    log('ERRO: Não foi possível extrair conversationId da URL');
    return null;
  }

  // ============================================
  // 12. BUSCAR CONTACT ID DA CONVERSA
  // ============================================

  async function getContactIdFromConversation(conversationId) {
    try {
      log(`Buscando mensagens da conversa: ${conversationId}`);

      const response = await fetch(`${CONFIG.getMessagesEndpoint}/${conversationId}/messages?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'Version': CONFIG.apiVersion
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao buscar mensagens: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log('Resposta da API de mensagens:', result);

      // Extrair contactId da primeira mensagem
      if (result.messages && result.messages.messages && result.messages.messages.length > 0) {
        const contactId = result.messages.messages[0].contactId;
        log('ContactId extraído das mensagens:', contactId);
        return contactId;
      }

      throw new Error('Nenhuma mensagem encontrada na conversa para extrair contactId');

    } catch (error) {
      log('ERRO ao buscar contactId da conversa:', error);
      throw error;
    }
  }

  // ============================================
  // 13. DETECTAR TIPO DE MENSAGEM
  // ============================================

  function detectMessageType() {
    // Sempre retornar SMS como padrão
    log('Tipo de mensagem: SMS');
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
        throw new Error('Location ID não encontrado para upload via Media Storage');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('hosted', 'true');
      formData.append('fileProcessingType', 'video');

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

  async function sendMessageWithAttachments(attachmentUrls, messageText, contactId, messageType) {
    try {
      log('Enviando mensagens com anexos...');

      const results = [];

      // Se houver texto, enviar a mensagem de texto primeiro
      if (messageText) {
        log('Enviando mensagem de texto...');
        const textPayload = {
          type: messageType,
          contactId: contactId,
          message: messageText,
          status: 'pending'
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
          type: messageType,
          contactId: contactId,
          attachments: [url],  // Array com apenas uma URL (string)
          status: 'pending'
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
  // 17. EXTRAIR LOCATION ID DA URL
  // ============================================

  function getLocationId() {
    // URL: /v2/location/{LOCATION_ID}/conversations/...
    const match = window.location.pathname.match(/\/location\/([^\/]+)/);
    if (match && match[1]) {
      log('Location ID extraído:', match[1]);
      return match[1];
    }
    log('ERRO: Não foi possível extrair Location ID da URL');
    return null;
  }

  // ============================================
  // 17. BUSCAR PASTAS DE MÍDIA
  // ============================================

  async function fetchMediaFolders() {
    const locationId = getLocationId();
    if (!locationId) {
      throw new Error('Location ID não encontrado');
    }

    mediaLibraryState.loading.folders = true;
    renderFoldersLoading();

    try {
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
    const foldersContainer = document.getElementById('folders-list');
    foldersContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Carregando...</p>
      </div>
    `;
  }

  function renderFoldersError(message) {
    const foldersContainer = document.getElementById('folders-list');
    foldersContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px 10px;">
        <p style="font-size: 13px; color: #ef4444;">${message}</p>
      </div>
    `;
  }

  function renderFoldersList() {
    const foldersContainer = document.getElementById('folders-list');

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
    const gridContainer = document.getElementById('media-grid');
    gridContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Carregando mídias...</p>
      </div>
    `;
  }

  function renderMediasError(message) {
    const gridContainer = document.getElementById('media-grid');
    gridContainer.innerHTML = `
      <div class="empty-state">
        <p style="color: #ef4444;">${message}</p>
      </div>
    `;
  }

  function renderMediasEmpty(message) {
    const gridContainer = document.getElementById('media-grid');
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
    const gridContainer = document.getElementById('media-grid');
    const countEl = document.getElementById('media-count');

    // Atualizar contador
    const filteredMedias = getFilteredMedias();
    countEl.textContent = `${filteredMedias.length} mídia${filteredMedias.length !== 1 ? 's' : ''}`;

    if (filteredMedias.length === 0) {
      renderMediasEmpty(mediaLibraryState.searchQuery ? 'Nenhuma mídia encontrada' : 'Esta pasta está vazia');
      return;
    }

    gridContainer.innerHTML = filteredMedias.map(media => {
      const isSelected = mediaLibraryState.selectedMedias.some(m => m._id === media._id);
      const isImage = media.contentType.startsWith('image/');
      const isVideo = media.contentType.startsWith('video/');
      const isAudio = media.contentType.startsWith('audio/');

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

    const sendBtn = document.getElementById('modal-send-btn');
    const originalText = sendBtn.innerHTML;

    try {
      sendBtn.disabled = true;

      // Converter cada URL em File object
      for (let i = 0; i < mediaLibraryState.selectedMedias.length; i++) {
        const media = mediaLibraryState.selectedMedias[i];
        sendBtn.innerHTML = `Carregando ${i + 1}/${mediaLibraryState.selectedMedias.length}...`;

        const file = await convertUrlToFile(media);

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

      // Extrair conversationId da URL
      const conversationId = getConversationId();
      if (!conversationId) {
        throw new Error('Não foi possível identificar a conversa.');
      }

      // Buscar contactId das mensagens da conversa
      sendBtn.innerHTML = 'Buscando informações...';
      const contactId = await getContactIdFromConversation(conversationId);

      // Detectar tipo de mensagem
      const messageType = detectMessageType();
      const messageText = messageTextarea ? messageTextarea.value.trim() : '';

      log(`Processando envio - ConversationId: ${conversationId}, ContactId: ${contactId}, Type: ${messageType}`);

      // ========================================
      // SEPARAR VÍDEOS DE OUTRAS MÍDIAS
      // ========================================

      const videoFiles = selectedFiles.filter(file => file.type.startsWith('video/'));
      const nonVideoFiles = selectedFiles.filter(file => !file.type.startsWith('video/'));

      log(`Separação: ${nonVideoFiles.length} imagem/áudio, ${videoFiles.length} vídeo(s)`);

      // ========================================
      // ETAPA 1: PROCESSAR IMAGENS/ÁUDIOS (SMS)
      // ========================================

      if (nonVideoFiles.length > 0) {
        log('Processando imagens/áudios via SMS');

        sendBtn.innerHTML = `Enviando imagens/áudios (0/${nonVideoFiles.length})...`;

        const uploadPromises = nonVideoFiles.map((file, index) =>
          uploadFile(file, conversationId).then(url => {
            sendBtn.innerHTML = `Enviando imagens/áudios (${index + 1}/${nonVideoFiles.length})...`;
            return url;
          })
        );

        const nonVideoUrls = await Promise.all(uploadPromises);
        log('Upload de imagens/áudios concluído:', nonVideoUrls);

        sendBtn.innerHTML = 'Enviando mensagens SMS...';
        await sendMessageWithAttachments(nonVideoUrls, messageText, contactId, messageType);
        log('Imagens/áudios enviados via SMS');
      } else {
        log('Nenhuma imagem/áudio para processar via SMS');
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

    if (!checkDomain()) {
      log('URL atual não corresponde. Aguardando navegação para a location correta...');
      return;
    }

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
  setInterval(checkUrlChange, 1000);

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