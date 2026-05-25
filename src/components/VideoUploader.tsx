import React, { useRef, useState } from 'react';
import { Upload, Play, X, Loader2 } from 'lucide-react';

interface VideoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  label?: string;
}

export default function VideoUploader({
  value,
  onChange,
  disabled = false,
  label = '视频',
}: VideoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('请选择视频文件');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('视频大小不能超过 50MB');
      return;
    }

    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const token = localStorage.getItem('jinyu_material_token');
      const res = await fetch('/api/upload/video', { method: 'POST', body: formData, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await res.json();
      if (json.success && json.url) {
        onChange(json.url);
      } else {
        setError(json.error || '上传失败');
      }
    } catch {
      setError('网络错误，上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        disabled={disabled || uploading}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {uploading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          视频上传中，请稍候…
        </div>
      )}

      {!uploading && value && (
        <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-900">
          {/* 视频预览 */}
          <video
            ref={videoRef}
            src={value}
            controls
            className="w-full max-h-64 object-contain"
            style={{ display: 'block' }}
          />
          {/* 删除按钮 */}
          {!disabled && (
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow transition-colors"
              title="移除视频"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {!uploading && !value && (
        <button
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-all ${
            disabled
              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 text-gray-500 hover:text-blue-600 cursor-pointer'
          }`}
        >
          <div className={`p-3 rounded-full ${disabled ? 'bg-gray-100' : 'bg-blue-50'}`}>
            {disabled ? (
              <Play className="w-6 h-6" />
            ) : (
              <Upload className="w-6 h-6 text-blue-500" />
            )}
          </div>
          <div className="text-sm font-medium">
            {disabled ? '无视频' : '点击上传视频'}
          </div>
          <div className="text-xs text-gray-400">支持 MP4 / MOV / AVI，最大 50MB</div>
        </button>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
