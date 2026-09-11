import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  UploadCloud,
  X
} from 'lucide-react';
import { FileUploadProps } from '../types';
import {
  ALLOWED_EXTENSIONS,
  formatFileSize,
  isValidFileExtension,
  isValidFileSize
} from '../utils/fileHelpers';

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    setError('');

    if (!isValidFileExtension(file.name)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return false;
    }

    if (!isValidFileSize(file)) {
      setError('File size must be less than 5MB');
      return false;
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    onFileSelect(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <UploadCloud className="h-4 w-4 text-indigo-400" />
          <span>Source File Upload</span>
        </label>
        {selectedFile && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {!selectedFile ? (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group ${
            dragActive
              ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 scale-[1.01]'
              : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleButtonClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleChange}
          />

          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
              <UploadCloud className="h-6 w-6" />
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-200">
            <span className="text-indigo-400 font-bold hover:underline">Click to upload</span> or drag & drop file
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Python, JS, TS, Java • Max 5MB
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-slate-900/90 border border-indigo-500/30 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          <button
            onClick={handleRemoveFile}
            className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded-xl transition-all"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
