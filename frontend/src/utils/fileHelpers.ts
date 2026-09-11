export const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java'];

export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
};

export const isValidFileExtension = (filename: string): boolean => {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.includes(ext);
};

export const getFileNameWithoutExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const downloadFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const getTestFileName = (originalFileName: string, framework: string): string => {
  const nameWithoutExt = getFileNameWithoutExtension(originalFileName);
  const ext = getFileExtension(originalFileName);

  const testFileMap: Record<string, string> = {
    Jest: `${nameWithoutExt}.test${ext}`,
    Mocha: `${nameWithoutExt}.test${ext}`,
    Jasmine: `${nameWithoutExt}.spec${ext}`,
    pytest: `test_${nameWithoutExt}.py`,
    unittest: `test_${nameWithoutExt}.py`,
    JUnit5: `${nameWithoutExt}Test.java`,
    JUnit4: `${nameWithoutExt}Test.java`
  };

  return testFileMap[framework] || `${nameWithoutExt}.test${ext}`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const isValidFileSize = (file: File, maxSizeMB: number = 5): boolean => {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
};
