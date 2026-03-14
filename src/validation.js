// ==========================================
// CRM Tracker — File Validation
// ==========================================

const ALLOWED_FILE_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    // Design
    'application/postscript', // AI/EPS
    'image/vnd.adobe.photoshop', // PSD
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function validateFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `File type "${file.type}" is not supported. Allowed: images, PDFs, docs, videos, audio, archives, design files.`,
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File too large (${sizeMB}MB). Maximum size is 25MB.`,
        };
    }

    return { valid: true, error: null };
}

// Backward-compatible alias
const validateImageFile = validateFile;

export { validateFile, validateImageFile };
