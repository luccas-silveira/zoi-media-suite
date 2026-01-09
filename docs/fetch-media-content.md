# Guia do endpoint de midia: GET /medias/files

Este guia resume o que foi validado na pratica para o endpoint de listagem de
midias (arquivos e pastas) da API da HighLevel/LeadConnector.

## Endpoint

GET `https://services.leadconnectorhq.com/medias/files`

## Autenticacao

- Header: `Authorization: Bearer <API_KEY_OU_TOKEN>`
- Header: `Version: 2021-04-15`

## Parametros de query

Obrigatorio:

- `type`: string. Valores validados: `file` ou `folder`.

Opcionais (observados em uso):

- `altType`: string. Valor observado: `location`.
- `altId`: string. Ex: o ID da location. Observado em respostas e usado como filtro.
- `parentId`: string. ID da pasta para listar arquivos dentro dela.

## Comportamento validado

- Sem `type` o endpoint retorna `422` com mensagem de validacao.
- Com `type=folder` retorna lista de pastas.
- Com `type=file` retorna lista de arquivos e um campo `count`.
- `altType` e `altId` podem ser passados para filtrar a lista (ex: location).
- `parentId` filtra arquivos dentro de uma pasta especifica.

## Exemplos de requisicao

Listar pastas (por location):

```bash
curl -sS \
  -H "Authorization: Bearer <SEU_TOKEN>" \
  -H "Version: 2021-04-15" \
  "https://services.leadconnectorhq.com/medias/files?type=folder&altType=location&altId=<LOCATION_ID>"
```

Listar arquivos (por location):

```bash
curl -sS \
  -H "Authorization: Bearer <SEU_TOKEN>" \
  -H "Version: 2021-04-15" \
  "https://services.leadconnectorhq.com/medias/files?type=file&altType=location&altId=<LOCATION_ID>"
```

Listar arquivos dentro de uma pasta:

```bash
curl -sS \
  -H "Authorization: Bearer <SEU_TOKEN>" \
  -H "Version: 2021-04-15" \
  "https://services.leadconnectorhq.com/medias/files?type=file&parentId=<FOLDER_ID>"
```

## Exemplo de resposta (type=folder)

```json
{
  "files": [
    {
      "_id": "69600656b6d94244c56f31fb",
      "altId": "<LOCATION_ID>",
      "altType": "location",
      "name": "Veiculos",
      "type": "folder",
      "isPrivate": false,
      "createdAt": "2026-01-08T19:32:38.415Z",
      "updatedAt": "2026-01-08T19:32:38.415Z"
    }
  ],
  "traceId": "..."
}
```

## Exemplo de resposta (type=file)

```json
{
  "files": [
    {
      "_id": "6942f1b8ca72984d6e6f8d3e",
      "altId": "<LOCATION_ID>",
      "altType": "location",
      "name": "arquivo.png",
      "type": "file",
      "contentType": "image/png",
      "size": 13147,
      "path": "<LOCATION_ID>/media/6942f1b8ca72984d6e6f8d3e.png",
      "url": "https://storage.googleapis.com/msgsndr/<LOCATION_ID>/media/6942f1b8ca72984d6e6f8d3e.png",
      "createdAt": "2025-12-17T18:08:56.768Z",
      "updatedAt": "2025-12-17T18:08:58.025Z"
    }
  ],
  "count": 222,
  "traceId": "..."
}
```

## Campos comuns observados em arquivos

- `contentType`, `size`, `path`, `url`
- `encodedFormats` (videos)
- `width`, `height`, `blurHashCode` (imagens)

## Erros observados

Falta de `type`:

```json
{
  "status": 422,
  "message": [
    "type must be a string",
    "type should not be empty"
  ],
  "error": "Unprocessable Entity"
}
```

## Notas de uso

- O filtro por `altType=location` e `altId=<LOCATION_ID>` ajuda a limitar
  os resultados a uma location especifica.
- `parentId` e util para navegar em pastas internas.
- Guarde o token/Api Key com cuidado; nao hardcode em front-end publico.
