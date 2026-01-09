# Script de Upload de Mídias Customizado

## Descrição

Este script modifica o comportamento do botão de anexo no GoHighLevel, substituindo a funcionalidade padrão por um popup customizado de upload de mídias com drag-and-drop, preview, gerenciamento de múltiplos arquivos e **integração completa com a API do GoHighLevel** para envio automático das mídias nas conversas.

## Funcionalidades

- ✅ Popup customizado com design moderno
- ✅ Drag-and-drop de arquivos
- ✅ Seleção de múltiplos arquivos
- ✅ Preview de mídias (imagens, vídeos, áudios)
- ✅ Informações detalhadas dos arquivos (nome, tamanho, tipo)
- ✅ Remoção individual de arquivos
- ✅ Campo de texto opcional para mensagem
- ✅ Botões de Cancelar e Enviar
- ✅ Envio real de mídias via API do GoHighLevel
- ✅ Detecção automática do tipo de mensagem (SMS/WhatsApp/Email)
- ✅ Extração automática de conversationId e contactId
- ✅ Indicador de progresso durante upload
- ✅ Tratamento de erros com feedback visual
- ✅ Suporte para SPAs com MutationObserver
- ✅ Modo debug com logs detalhados

## Tipos de Arquivos Aceitos

- 📷 **Imagens**: JPG, PNG, GIF, WebP, etc.
- 🎥 **Vídeos**: MP4, WebM, MOV, etc.
- 🎵 **Áudios**: MP3, WAV, OGG, etc.

## Como Usar

### 1. Copiar o Código

Abra o arquivo `inject.js` e copie **TODO** o conteúdo (incluindo as tags `<script>` e `</script>`).

### 2. Acessar GoHighLevel

1. Faça login no GoHighLevel
2. Navegue até as configurações de whitelabel
3. Localize o campo **"Custom JavaScript"** ou **"Whitelabel JS"**

### 3. Colar o Código

Cole todo o conteúdo do arquivo `inject.js` no campo de JavaScript customizado.

**Importante**: O código já está envolvido em tags `<script></script>`, pronto para ser colado diretamente.

### 4. Salvar

Salve as configurações.

### 5. Testar

1. Acesse qualquer página de conversas no domínio
2. Clique no ícone de anexo (paperclip)
3. O popup customizado deve abrir
4. Teste o drag-and-drop arrastando arquivos
5. Teste a seleção clicando na área
6. Adicione múltiplos arquivos
7. Veja os previews sendo gerados
8. (Opcional) Digite uma mensagem de texto no campo
9. Remova arquivos individuais com o botão × se desejar
10. Clique em "Enviar"
11. Observe o progresso no botão ("Enviando arquivos 1/3...")
12. Aguarde a confirmação "✓ Enviado!"
13. Verifique se as mídias aparecem na conversa
14. Abra o console (F12) para ver logs detalhados do processo

## Como Funciona

### Interceptação do Clique

O script identifica todos os ícones de anexo através do SVG path específico e adiciona event listeners que:
- Previnem o comportamento padrão (abrir menu)
- Abrem o popup customizado

### Popup Customizado

O popup inclui:

1. **Drop Zone**: Área para arrastar arquivos ou clicar para selecionar
2. **Lista de Arquivos**: Exibe todos os arquivos selecionados com:
   - Preview visual (thumbnail de imagem, player de vídeo/áudio)
   - Nome do arquivo
   - Tamanho e tipo
   - Botão para remover
3. **Rodapé**: Botões de Cancelar e Enviar com contador de arquivos

### Processamento

Ao clicar em "Enviar":
1. **Extração de Dados**:
   - ConversationId é extraído da URL
   - ContactId é extraído da URL ou DOM
   - Tipo de mensagem é detectado automaticamente (SMS/WhatsApp/Email)

2. **Upload de Arquivos**:
   - Cada arquivo é enviado para a API do GoHighLevel
   - Progresso é exibido no botão ("Enviando arquivos 1/3...")
   - URLs dos arquivos são coletadas

3. **Envio da Mensagem**:
   - Mensagem é enviada com todas as URLs dos anexos
   - Texto opcional é incluído (se fornecido)
   - Feedback visual de sucesso ou erro

4. **Finalização**:
   - Modal é fechado automaticamente após 1 segundo (em caso de sucesso)
   - Em caso de erro, mensagem é exibida e o usuário pode tentar novamente

## Debugging

O script inclui modo debug ativado por padrão. Para visualizar os logs:

1. Abra as ferramentas de desenvolvedor (F12)
2. Vá para a aba Console
3. Procure por mensagens prefixadas com `[Media Upload]`

### Logs Disponíveis

```
[Media Upload] Iniciando script de upload de mídias...
[Media Upload] Domínio verificado com sucesso
[Media Upload] Event listener adicionado ao ícone de anexo
[Media Upload] Ícone de anexo clicado
[Media Upload] Modal criado com sucesso
[Media Upload] Arquivo adicionado: imagem.jpg
[Media Upload] ConversationId extraído: xxxxx
[Media Upload] ContactId extraído do query string: xxxxx
[Media Upload] Tipo de mensagem detectado: WhatsApp
[Media Upload] Iniciando upload do arquivo: foto.jpg
[Media Upload] Upload concluído: foto.jpg
[Media Upload] Todos os arquivos foram enviados: [...]
[Media Upload] Enviando mensagem com anexos...
[Media Upload] Mensagem enviada com sucesso: {...}
[Media Upload] Processo completo! Arquivos enviados com sucesso.
```

### Desativar Modo Debug

Para desativar os logs do console, edite a linha 16 do arquivo `inject.js`:

```javascript
debugMode: false  // Altere de true para false
```

## Configurações Avançadas

Você pode ajustar as seguintes configurações no objeto `CONFIG` (linhas 9-21):

- **`targetHostname`**: Hostname onde o script deve executar (padrão: `'app.zoitech.com.br'`)
- **`targetPathPattern`**: Padrão do path que deve estar presente (padrão: `'/conversations'`)
- **`svgPathData`**: Path data do SVG do ícone de anexo
- **`acceptedFileTypes`**: Tipos de arquivo aceitos (padrão: `'image/*,video/*,audio/*'`)
- **`retryAttempts`**: Número de tentativas para encontrar elementos (padrão: 5)
- **`retryDelay`**: Delay entre tentativas em milissegundos (padrão: 500ms)
- **`debugMode`**: Ativar/desativar logs no console (padrão: true)
- **`apiKey`**: Chave de API do GoHighLevel (configurada)
- **`uploadEndpoint`**: URL do endpoint de upload (padrão: API do GoHighLevel)
- **`sendEndpoint`**: URL do endpoint de envio de mensagens (padrão: API do GoHighLevel)
- **`apiVersion`**: Versão da API (padrão: `'2021-04-15'`)

## Estrutura do Código

```
inject.js
├── 1. Configuração e constantes (incluindo API)
├── 2. Função de log (debug)
├── 3. Verificação de domínio
├── 4. Criação do modal (HTML + CSS inline)
├── 5. Event listeners do modal
├── 6. Processamento de arquivos
├── 7. Adicionar arquivo à lista
├── 8. Remover arquivo
├── 9. Atualizar contador de arquivos
├── 10. Formatar tamanho do arquivo
├── 11. Extrair conversationId da URL
├── 12. Extrair contactId da URL
├── 13. Detectar tipo de mensagem (SMS/WhatsApp/Email)
├── 14. Upload de arquivo via API
├── 15. Enviar mensagem com anexos via API
├── 16. Processar envio completo (orquestração)
├── 17. Modificação dos ícones de anexo
├── 18. MutationObserver para SPAs
├── 19. Inicialização com retry logic
├── 20. Inicialização principal
└── 21. Executar script
```

## Customização

### Alterar Tipos de Arquivo Aceitos

Edite a linha 13:

```javascript
acceptedFileTypes: 'image/*,video/*',  // Apenas imagens e vídeos
// ou
acceptedFileTypes: '.jpg,.png,.mp4',  // Tipos específicos
```

### Alterar Cores do Popup

Edite as cores no CSS inline (seção 4, linhas 96-348):

```javascript
// Exemplo: mudar cor do botão Enviar
'#custom-media-upload-modal .btn-primary': {
  background: '#10b981',  // Verde em vez de azul
}
```

### Alterar Chave de API

Se você precisar usar uma chave de API diferente, edite a linha 17 do arquivo `inject.js`:

```javascript
apiKey: 'sua-nova-chave-de-api-aqui'
```

### Alterar Endpoints da API

Se você precisar usar endpoints customizados, edite as linhas 18-19:

```javascript
uploadEndpoint: 'https://seu-endpoint-de-upload.com',
sendEndpoint: 'https://seu-endpoint-de-envio.com'
```

## Integração com API do GoHighLevel

O script já está totalmente integrado com a API do GoHighLevel! Ele automaticamente:

1. **Faz upload dos arquivos** para o endpoint `/conversations/messages/upload`
2. **Envia a mensagem** com os anexos para o endpoint `/conversations/messages`
3. **Detecta o tipo de conversa** (SMS, WhatsApp ou Email)
4. **Extrai os IDs necessários** da URL (conversationId e contactId)

### Fluxo de Integração

```javascript
// 1. Upload de cada arquivo
POST https://services.leadconnectorhq.com/conversations/messages/upload
Headers: Authorization: Bearer {apiKey}
Body: FormData { conversationId, fileAttachment }
Response: { url: "https://..." }

// 2. Envio da mensagem com anexos
POST https://services.leadconnectorhq.com/conversations/messages
Headers:
  - Authorization: Bearer {apiKey}
  - Content-Type: application/json
  - Version: 2021-04-15
Body: {
  type: "WhatsApp" | "SMS" | "Email",
  contactId: "extracted-from-url",
  message: "texto opcional",
  attachments: ["url1", "url2", ...],
  status: "pending"
}
```

## Compatibilidade

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Funciona com Vue.js
- ✅ Suporta SPAs (Single Page Applications)
- ✅ Responsivo (funciona em diferentes tamanhos de tela)

## Solução de Problemas

### O popup não abre ao clicar no ícone de anexo

1. Verifique se você está no domínio correto (`app.zoitech.com.br`)
2. Verifique se a URL contém `/conversations`
3. Abra o console (F12) e procure por erros
4. Verifique se os logs `[Media Upload]` aparecem

### O popup abre mas não aceita arquivos

1. Verifique se está tentando fazer upload de imagens, vídeos ou áudios
2. Veja no console se há mensagens de "Arquivo rejeitado"
3. Verifique a configuração `acceptedFileTypes`

### Os previews não aparecem

1. Verifique se o navegador suporta `URL.createObjectURL()`
2. Veja se há erros no console
3. Alguns formatos de arquivo podem não ter preview

### O botão "Enviar" não funciona ou mostra erro

1. Verifique se há arquivos selecionados
2. O botão fica desabilitado quando não há arquivos
3. Abra o console (F12) e verifique os logs de erro
4. Verifique se o conversationId foi extraído corretamente:
   - Procure por `[Media Upload] ConversationId extraído:` no console
   - A URL deve conter `/conversations/conversations/{id}`
5. Verifique se o contactId foi extraído:
   - Procure por `[Media Upload] ContactId extraído:` no console
   - Se não for encontrado, pode ser necessário ajustar a extração
6. Verifique se há erros de API no console:
   - Erro 401: Problema com a chave de API
   - Erro 403: Permissões insuficientes
   - Erro 404: Endpoint não encontrado
   - Erro 500: Erro no servidor da API

### O upload falha ou retorna erro

1. Verifique a chave de API na configuração (linha 17)
2. Certifique-se de que a chave tem permissões para:
   - Upload de arquivos
   - Envio de mensagens
3. Verifique o tamanho dos arquivos (APIs podem ter limites)
4. Verifique os logs completos no console para detalhes do erro
5. Teste com um arquivo pequeno primeiro (imagem < 1MB)

### As mídias não aparecem na conversa

1. Verifique se o upload foi concluído com sucesso nos logs
2. Verifique se o tipo de mensagem foi detectado corretamente:
   - Procure por `[Media Upload] Tipo de mensagem detectado:` no console
3. Atualize a página da conversa
4. Verifique se há restrições de tipo de arquivo no canal (SMS/WhatsApp/Email)

## Arquivos do Projeto

- `inject.js` - Script principal de injeção (completo e pronto para uso)
- `paths.md` - Documentação dos elementos HTML originais
- `README.md` - Este arquivo de documentação

## Notas Técnicas

### Event Capture

O script usa `useCapture: true` nos event listeners para interceptar os cliques ANTES dos handlers originais do GoHighLevel, garantindo que o comportamento padrão seja prevenido.

### Memory Management

O script usa `URL.createObjectURL()` para criar previews. Em produção, você pode querer adicionar `URL.revokeObjectURL()` para liberar memória quando os arquivos forem removidos.

### WeakSet

Usa `WeakSet` para rastrear ícones já modificados, evitando duplicação de event listeners.

## Status do Projeto

✅ **Completo e Funcional**

O script está totalmente integrado com a API do GoHighLevel e pronto para uso em produção!

### Funcionalidades Implementadas

- ✅ Interface de upload customizada
- ✅ Drag-and-drop de múltiplos arquivos
- ✅ Preview de mídias (imagens, vídeos, áudios)
- ✅ Campo de mensagem opcional
- ✅ Upload automático via API
- ✅ Envio de mensagens com anexos
- ✅ Detecção automática de tipo de conversa
- ✅ Extração automática de IDs da URL
- ✅ Indicador de progresso
- ✅ Tratamento de erros com feedback visual
- ✅ Logs detalhados para debugging

### Possíveis Melhorias Futuras

1. **Validações adicionais**: Tamanho máximo de arquivo, número máximo de arquivos
2. **Barra de progresso visual**: Barra de progresso em vez de texto no botão
3. **Retry automático**: Tentar novamente em caso de falha temporária
4. **Cache de uploads**: Evitar re-upload de arquivos duplicados
5. **Compressão de imagens**: Reduzir tamanho antes do upload
6. **Suporte a outros tipos**: Documentos PDF, arquivos ZIP, etc.

## Licença

Este script é fornecido "como está", sem garantias de qualquer tipo.
