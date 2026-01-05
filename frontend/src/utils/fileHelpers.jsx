// Allowed file extensions
export const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java'];

// Check if file extension is allowed
export const isValidFileExtension = (filename) => {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.includes(ext);
};

// Get file extension
export const getFileExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
};

// Get file name without extension
export const getFileNameWithoutExtension = (filename) => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
};

// Read file as text
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

// Download file
export const downloadFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Get test file name based on framework
export const getTestFileName = (originalFileName, framework) => {
  const nameWithoutExt = getFileNameWithoutExtension(originalFileName);
  const ext = getFileExtension(originalFileName);
  
  const testFileMap = {
    'Jest': `${nameWithoutExt}.test${ext}`,
    'Mocha': `${nameWithoutExt}.test${ext}`,
    'Vitest': `${nameWithoutExt}.test${ext}`,
    'pytest': `test_${nameWithoutExt}.py`,
    'unittest': `test_${nameWithoutExt}.py`,
    'JUnit': `${nameWithoutExt}Test.java`,
    'TestNG': `${nameWithoutExt}Test.java`,
  };
  
  return testFileMap[framework] || `${nameWithoutExt}.test${ext}`;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Validate file size (max 5MB)
export const isValidFileSize = (file, maxSizeMB = 5) => {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
};