"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Upload, Film, X } from "lucide-react";
import * as tus from "tus-js-client";
import Header from "../components/Header";
import { ADMIN_LIBRARY_USER_ID } from "@/lib/adminConstants";

export default function LivepeerUploadPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const createVideo = useMutation(api.videos.createVideo);
  const updateVideoStatus = useMutation(api.videos.updateVideoStatus);
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    user?.id ? { clerkId: user.id } : "skip"
  );

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/");
    } else if (isLoaded && user && isAdmin === false) {
      router.push("/");
    }
  }, [isLoaded, user, isAdmin, router]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);

      if (!title.trim()) {
        const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(fileNameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!user || !file || !title.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const requestUploadResponse = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, provider: "livepeer" }),
      });

      if (!requestUploadResponse.ok) {
        const errorData = await requestUploadResponse.json();
        throw new Error(errorData.error || "Failed to request upload URL");
      }

      const responseData = await requestUploadResponse.json();
      const { asset: livepeerAsset, tusEndpoint } = responseData;

      setUploadProgress(10);

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: tusEndpoint,
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          uploadSize: file.size,
          onError: (error) => reject(error),
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = ((bytesUploaded / bytesTotal) * 70) + 10;
            setUploadProgress(Math.round(percentage));
          },
          onSuccess: () => {
            setUploadProgress(80);
            resolve();
          },
        });

        upload.start();
      });

      const videoId = await createVideo({
        userId: ADMIN_LIBRARY_USER_ID,
        uploadedBy: user.id,
        title,
        description,
        visibility,
        provider: "livepeer",
        assetId: livepeerAsset.id,
        uploadId: undefined,
        playbackId: livepeerAsset.playbackId || undefined,
        playbackUrl: undefined,
      });

      setUploadProgress(90);

      await updateVideoStatus({
        videoId,
        status: "processing",
      });

      setUploadProgress(100);

      alert("Video uploaded successfully! It may take a few minutes to process.");
      router.push("/library");
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isLoaded || !user || isAdmin === undefined) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header title="UPLOAD VIDEO" />
      <div className="max-w-4xl mx-auto p-8 pt-24">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-3xl font-bold">Upload Video</h1>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Video File
            </label>
            {!file ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-lime-400 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Film className="w-12 h-12 text-zinc-500 mb-4" />
                  <p className="mb-2 text-sm text-zinc-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-zinc-500">MP4, MOV, AVI (MAX. 2GB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="video/*"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-zinc-800 rounded-xl">
                <Film className="w-8 h-8 text-lime-400" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-zinc-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-2 hover:bg-zinc-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {uploadProgress > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-lime-400 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter video title"
              className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell viewers about your video"
              rows={4}
              className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || !title || uploading}
            className="w-full py-4 bg-lime-400 text-black rounded-lg font-bold hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        </div>
      </div>
    </div>
  );
}
