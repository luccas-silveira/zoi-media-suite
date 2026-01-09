# GEMINI.md - Context & Instructions

## Project Overview

**Project Name:** GHL Media Injector (Zoi Media Suite)
**Type:** Custom JavaScript Injection for GoHighLevel (LeadConnector)
**Primary Goal:** To replace the native GoHighLevel attachment/media upload functionality with a custom, feature-rich modal that supports drag-and-drop, a media gallery, and direct API integration.

This project is **not** a traditional application with a build step (like React or Node.js). It produces a single artifact, `inject.js`, designed to be copied and pasted directly into the "Custom JavaScript" or "Whitelabel JS" settings of a GoHighLevel agency account.

## Core Artifacts

*   **`inject.js`**: The main source code. It is a self-contained JavaScript file (wrapped in an IIFE) that includes:
    *   **Configuration:** API keys, endpoints, and feature flags.
    *   **UI Logic:** Creation of the modal, CSS styles (injected dynamically), and event listeners.
    *   **Business Logic:** File handling, compression, and API communication (uploading files, sending messages).
    *   **Integration:** Logic to intercept the default GHL UI interactions (specifically clicking the attachment icon).

## Directory Structure

*   **`inject.js`**: The production-ready script.
*   **`docs/`**: Documentation for the project.
    *   `README.md`: General usage instructions and project summary.
    *   `fetch-media-content.md`: Details on fetching media.
    *   `paths.md`: Documentation of HTML elements and paths.
*   **`medias-files.posting.yaml/`**: API references and examples for the Media Library integration.

## Usage & Deployment

Since there is no build process, "deployment" consists of:

1.  **Copy**: Select all content in `inject.js`.
2.  **Paste**: Navigate to the GoHighLevel Agency Settings -> Whitelabel -> Custom JavaScript.
3.  **Save**: Apply the changes.

## Configuration (`CONFIG` object)

The `inject.js` file contains a central `CONFIG` object at the top. Key settings include:

*   **`targetHostname`**: The domain where the script should run (e.g., `app.zoitech.com.br`).
*   **`apiKey`**: The Bearer token for authenticating with the LeadConnector API.
*   **`uploadEndpoint`** / **`sendEndpoint`**: API URLs for file management and messaging.
*   **`acceptedFileTypes`**: MIME types allowed for upload.
*   **`debugMode`**: Toggle console logging (`[Media Upload]`).

## Development Conventions

*   **Vanilla JavaScript**: No frameworks (React, Vue) or bundlers (Webpack) are used within the script itself to ensure maximum compatibility and ease of injection.
*   **Inline CSS**: Styles are injected via JavaScript to keep the solution self-contained in a single file.
*   **IIFE**: The code is wrapped in an Immediately Invoked Function Expression to prevent global namespace pollution.
*   **Direct API Usage**: `fetch` is used for all network requests.
*   **MutationObserver**: Used to handle the Single Page Application (SPA) nature of GHL, re-attaching listeners as the user navigates.

## Key Features to Maintain

*   **Drag-and-Drop**: Support for multiple files.
*   **Media Gallery**: Browsing folders and selecting existing media from the GHL library.
*   **Smart Detection**: Automatically detects `conversationId` and `contactId` from the URL or DOM.
*   **Compression**: Logic to compress large images before upload.
*   **Feedback**: Visual indicators for upload progress and success/error states.
