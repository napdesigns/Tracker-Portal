// ==========================================
// CRM Tracker — File Validation
// ==========================================

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateImageFile(file) {
    if (!file) return { valid: false, error: 'No file selected' };

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type "${file.type}". Allowed: JPG, PNG, GIF, WebP.`,
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File too large (${sizeMB}MB). Maximum size is 5MB.`,
        };
    }

    return { valid: true, error: null };
}

export { validateImageFile };
