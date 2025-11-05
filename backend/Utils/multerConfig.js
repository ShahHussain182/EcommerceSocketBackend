import multer from 'multer';

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// Allowed MIME types for images
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

// Create the multer upload middleware
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP files are allowed!"), false);
    }
  },
});
