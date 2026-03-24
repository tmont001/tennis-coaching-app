'use client';
// components/feed/CreatePostForm.tsx

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ImagePlus, Link, X } from 'lucide-react';
import { Field } from '@/components/ui';
import {
  createAnnouncement,
  uploadAnnouncementImage,
} from '@/actions/announcements';

const schema = z.object({
  title: z.string().optional(),
  body: z.string().min(1, 'Post content is required'),
  videoUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreatePostForm({
  teamId,
  onSuccess,
}: {
  teamId: string;
  onSuccess: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showVideoField, setShowVideoField] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const body = watch('body') ?? '';

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setServerError('Image must be under 5MB.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    let imageUrl: string | null = null;

    // Upload image if selected
    if (imageFile) {
      setUploading(true);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]); // strip data:mime;base64, prefix
        };
        reader.readAsDataURL(imageFile);
      });

      const uploadResult = await uploadAnnouncementImage(
        teamId,
        imageFile.name,
        base64,
        imageFile.type,
      );
      setUploading(false);

      if (uploadResult.error) {
        setServerError(uploadResult.error);
        return;
      }
      imageUrl = uploadResult.data?.url ?? null;
    }

    const result = await createAnnouncement({
      teamId,
      title: values.title || null,
      body: values.body,
      imageUrl,
      videoUrl: values.videoUrl || null,
    });

    if (result.error) {
      setServerError(result.error);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {serverError}
        </div>
      )}

      <Field label="Title" htmlFor="title" optional>
        <input
          id="title"
          type="text"
          className="input"
          placeholder="Practice reminder, match update, shoutout…"
          {...register('title')}
        />
      </Field>

      <Field label="Post" htmlFor="body" error={errors.body?.message}>
        <textarea
          id="body"
          rows={4}
          className="input resize-none"
          placeholder="What's on your mind? Share an update with your team…"
          {...register('body')}
        />
        <div className="text-right">
          <span className="text-xs text-gray-400">{body.length} chars</span>
        </div>
      </Field>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full max-h-48 object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Video URL field */}
      {showVideoField && (
        <Field label="Video URL" htmlFor="videoUrl" optional>
          <input
            id="videoUrl"
            type="url"
            className="input"
            placeholder="https://youtube.com/watch?v=... or Hudl link"
            {...register('videoUrl')}
          />
          <p className="text-xs text-gray-400 mt-1">
            YouTube and Vimeo links will embed automatically.
          </p>
        </Field>
      )}

      {/* Media action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors py-1 px-2 rounded-lg hover:bg-brand-50"
        >
          <ImagePlus size={15} />
          Photo
        </button>
        <button
          type="button"
          onClick={() => setShowVideoField((v) => !v)}
          className={`flex items-center gap-1.5 text-sm transition-colors py-1 px-2 rounded-lg ${showVideoField ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'}`}
        >
          <Link size={15} />
          Video link
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isSubmitting || uploading}
      >
        {isSubmitting || uploading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            {uploading ? 'Uploading…' : 'Posting…'}
          </>
        ) : (
          'Post to feed'
        )}
      </button>
    </form>
  );
}
