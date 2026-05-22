import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, Star } from 'lucide-react';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
  /** 是否显示"第一张为主图"标记 */
  showPrimary?: boolean;
  uploadEndpoint?: string;
}

export default function ImageUploader({
  images,
  onChange,
  max = 6,
  disabled = false,
  label = '图片',
  showPrimary = true,
  uploadEndpoint = '/api/about/upload',
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadToServer = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // 批量处理文件（支持同时选多张）
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = max - images.length;
      if (remaining <= 0 || disabled) return;

      const fileArr = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, remaining);

      if (fileArr.length === 0) return;

      setIsUploading(true);
      try {
        const urls = [];
        for (const file of fileArr) {
          const url = await uploadToServer(file);
          if (url) {
            urls.push(url);
          }
        }
        onChange([...images, ...urls]);
      } finally {
        setIsUploading(false);
      }
    },
    [images, max, disabled, onChange]
  );

  const handleDelete = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    const newImgs = [...images];
    const [removed] = newImgs.splice(index, 1);
    newImgs.unshift(removed);
    onChange(newImgs);
  };

  // 拖拽事件
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFiles(files);
  };

  const canUpload = images.length < max && !disabled;

  return (
    <div>
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold text-gray-900">
          {label}
          <span className="text-gray-400 font-normal ml-2 text-xs">
            最多 {max} 张{showPrimary ? '，第一张为主图' : ''}
          </span>
        </label>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {images.length} / {max}
        </span>
      </div>

      {/* 图片网格 + 上传区 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* 已上传图片 */}
        {images.map((img, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden group shadow-sm"
          >
            <img
              src={img}
              alt={`${label} ${index + 1}`}
              className="w-full h-full object-cover"
            />

            {/* 主图徽章 */}
            {showPrimary && index === 0 && (
              <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm z-10 flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-white" />
                主图
              </div>
            )}

            {/* 悬浮操作层 */}
            {!disabled && (
              <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 p-1.5">
                {showPrimary && index !== 0 && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(index)}
                    className="w-full text-[11px] bg-white/90 hover:bg-white text-gray-800 font-medium px-2 py-1 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Star className="w-3 h-3" />
                    设为主图
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="w-full text-[11px] bg-red-500/90 hover:bg-red-500 text-white font-medium px-2 py-1 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" />
                  删除
                </button>
              </div>
            )}
          </div>
        ))}

        {/* 上传区域 */}
        {canUpload && (
          <div
            role="button"
            tabIndex={0}
            aria-label="上传图片"
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && !isUploading && fileInputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 select-none
              ${isUploading ? 'border-blue-300 bg-blue-50 cursor-wait' :
                isDragOver
                  ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-md cursor-pointer'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer'
              }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              ref={fileInputRef}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
              disabled={isUploading}
            />
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center border mb-1.5 transition-colors
                ${
                  isDragOver
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-white border-gray-200 group-hover:border-blue-200'
                }`}
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Upload
                  className={`h-4 w-4 transition-colors ${isDragOver ? 'text-blue-600' : 'text-gray-400'}`}
                />
              )}
            </div>
            <span
              className={`text-[11px] font-medium transition-colors ${
                isUploading ? 'text-blue-600' : isDragOver ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              {isUploading ? '上传中...' : isDragOver ? '松开上传' : '点击或拖拽'}
            </span>
            {images.length === 0 && !isUploading && (
              <span className="text-[10px] text-gray-300 mt-0.5">支持批量上传</span>
            )}
          </div>
        )}
      </div>

      {/* 未上传时的引导提示 */}
      {images.length === 0 && !disabled && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <Upload className="w-3 h-3" />
          支持 JPG、PNG、GIF、WebP 格式，可同时选择多张图片
        </p>
      )}
    </div>
  );
}
