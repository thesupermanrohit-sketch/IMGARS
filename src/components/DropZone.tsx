import React, { useState, useRef } from 'react';
import { useForgeStore } from '../store/useForgeStore';

interface DropZoneProps {
  accept?: string;
  prompt?: string;
  isAcceptedFile?: (file: File) => boolean;
  onFiles?: (files: File[]) => void | Promise<void>;
  onRejectedFiles?: (files: File[]) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  accept = 'image/*',
  prompt = 'Drop images here',
  isAcceptedFile = (file) => file.type.startsWith('image/'),
  onFiles,
  onRejectedFiles,
}) => {
  const addFiles = useForgeStore((state) => state.addFiles);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processUploadedFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const imageFiles: File[] = [];
    const rejectedFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isAcceptedFile(file)) {
        imageFiles.push(file);
      } else {
        rejectedFiles.push(file);
      }
    }
    
    if (imageFiles.length > 0) {
      await (onFiles ? onFiles(imageFiles) : addFiles(imageFiles));
    }
    if (rejectedFiles.length > 0) {
      onRejectedFiles?.(rejectedFiles);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processUploadedFiles(e.target.files);
    }
  };

  const onButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent duplicate trigger from parent click
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload images drop zone"
      onKeyDown={handleKeyDown}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`w-full py-16 px-6 border border-dashed rounded-none flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 bg-[#111111]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:border-white
        ${
          isDragActive
            ? 'border-white bg-[#111111]/40'
            : 'border-[#1f1f1f] hover:border-white'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      <p className="text-sm text-[#666666] select-none text-center">
        {prompt}{' '}
        <span 
          onClick={onButtonClick}
          className="text-[#666666] hover:text-white underline underline-offset-4 transition-colors"
        >
          or browse files
        </span>
      </p>
    </div>
  );
};
