const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads/boletines');

// Asegurar que el directorio de uploads exista
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 30);
    const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    cb(null, `boletin_${uniqueSuffix}_${cleanBase}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen válidos (JPG, JPEG, PNG, GIF, WEBP).'), false);
  }
};

const uploadNewsletterImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB por imagen
    files: 5 // Máximo 5 imágenes por boletín
  }
}).array('imagenes', 5);

/**
 * Middleware para gestionar subida de imágenes de boletines con manejo seguro de errores
 */
function handleNewsletterUpload(req, res, next) {
  uploadNewsletterImages(req, res, (err) => {
    if (err) {
      req.validationErrors = req.validationErrors || [];
      if (err instanceof multer.MulterError) {
        let msg = 'Error al procesar las imágenes.';
        if (err.code === 'LIMIT_FILE_SIZE') {
          msg = 'Una de las imágenes excede el tamaño máximo permitido de 5MB.';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          msg = 'Solo puede adjuntar un máximo de 5 imágenes por boletín.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          msg = 'Campo de archivo inesperado o límite de imágenes excedido.';
        }
        req.validationErrors.push({ path: 'imagenes', msg });
      } else {
        req.validationErrors.push({ path: 'imagenes', msg: err.message });
      }
    }
    next();
  });
}

module.exports = {
  handleNewsletterUpload,
  UPLOADS_DIR
};

