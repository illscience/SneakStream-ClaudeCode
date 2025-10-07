"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Upload, Film, X } from "lucide-react";
import Header from "../components/Header";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function MuxUploadPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const cancelRef = useRef(false);

  const createVideo = useMutation(api.videos.createVideo);
  const updateVideoStatus = useMutation(api.videos.updateVideoStatus);

  useEffect(() => () => {
    cancelRef.current = true;
  }, []);

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

  const uploadToMux = async (uploadUrl: string, file: File) => {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 70) + 10;
          setUploadProgress(Math.min(percentage, 80));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Mux upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error("Mux upload network error"));
      xhr.send(file);
    });
  };

  const pollUploadStatus = async (uploadId: string, videoId: string | null) => {
    let createdVideoId = videoId;
    let attempts = 0;

    while (!cancelRef.current && attempts < 60) {
      await sleep(4000);
      attempts += 1;

      const statusResponse = await fetch("/api/upload/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, provider: "mux" }),
      });

      if (!statusResponse.ok) {
        const err = await statusResponse.json();
        throw new Error(err.error || "Failed to poll upload status");
      }

      const statusData = await statusResponse.json();

      if (!createdVideoId && statusData.assetId) {
        createdVideoId = await createVideo({
          userId: user!.id,
          title,
          description,
          visibility,
          provider: "mux",
          assetId: statusData.assetId,
          uploadId,
          playbackId: statusData.playbackId || undefined,
          playbackUrl: statusData.playbackUrl || undefined,
          duration: statusData.duration || undefined,
        });
      }

      if (statusData.assetStatus === "ready" && createdVideoId) {
        await updateVideoStatus({
          videoId: createdVideoId,
          status: "ready",
          playbackId: statusData.playbackId || undefined,
          playbackUrl: statusData.playbackUrl || undefined,
          duration: statusData.duration || undefined,
        });
        return createdVideoId;
      }
    }

    throw new Error("Timed out waiting for asset to become ready");
  };

  const handleUpload = async () => {
    if (!user || !file || !title.trim()) {
      alert("Please fill in all fields");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(5);
      cancelRef.current = false;

      const requestResponse = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, provider: "mux" }),
      });

      if (!requestResponse.ok) {
        const err = await requestResponse.json();
        throw new Error(err.error || "Failed to request Mux upload");
      }

      const { uploadId, uploadUrl } = await requestResponse.json();
      setUploadProgress(10);

      await uploadToMux(uploadUrl, file);
      setUploadProgress(85);

      const finalVideoId = await pollUploadStatus(uploadId, null);
      setUploadProgress(100);

      alert("Video uploaded successfully!");
      router.push(`/watch/${finalVideoId}`);
    } catch (error) {
      console.error("Mux upload error", error);
      alert(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header title="UPLOAD VIDEO" />
      <div className="max-w-4xl mx-auto p-8 pt-24">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-lime-400 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-3xl font-bold">Upload Video (Mux)</h1>
          </div>

          <div>
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
                  <p className="text-xs text-zinc-500">MP4, MOV, AVI (MAX. 5GB)</p>
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
                <button onClick={() => setFile(null)} className="p-2 hover:bg-zinc-700 rounded-lg">
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
                  <div className="bg-lime-400 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter video title"
              className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Give viewers some context"
              rows={4}
              className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Visibility</label>
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
            {uploading ? "Uploading..." : "Upload to Mux"}
          </button>
        </div>
      </div>
    </div>
  );
}
