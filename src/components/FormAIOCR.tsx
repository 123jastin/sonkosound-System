import React, { useRef, useState, useEffect } from 'react';
import { Camera, Sparkles, X, RefreshCw, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

interface FormAIOCRProps {
  onSuccess: (data: {
    name?: string;
    number?: string;
    deni?: number;
    maelezo_ya_bidhaa?: string;
    notes?: string;
  }) => void;
  label?: string;
}

export default function FormAIOCR({ onSuccess, label = "Changanua kwa AI Camera" }: FormAIOCRProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Inachukua picha...");
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cycling helpful loading messages
  useEffect(() => {
    if (!isLoading) return;
    const texts = [
      "Inatuma picha kwenye AI...",
      "Inasoma mwandiko wa karatasi...",
      "Inachakata jina na namba ya simu...",
      "Inakokotoa kiasi cha deni lililoandikwa...",
      "Karibu inamaliza..."
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % texts.length;
      setLoadingText(texts[index]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Start camera stream
  const startCamera = async () => {
    setError(null);
    setCameraActive(false);
    try {
      const constraints = {
        video: { facingMode: 'environment' }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      setError("Haikuweza kufungua camera. Unaweza kupakia picha kutoka kwenye faili/kifaa chako badala yake.");
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const handleOpenScanner = () => {
    setIsOpen(true);
    setUploadedUrl(null);
    startCamera();
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsOpen(false);
    setError(null);
    setUploadedUrl(null);
  };

  // Upload image to R2 and return the URL
  const uploadToR2 = async (blob: Blob, fileName: string): Promise<string | null> => {
    try {
      setLoadingText("Inapakia picha kwenye cloud...");
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const result = await api.upload.image(file);
      
      if (result.success && result.url) {
        console.log('Image uploaded to R2:', result.url);
        return result.url;
      }
      console.warn('R2 upload failed, continuing with base64');
      return null;
    } catch (err) {
      console.warn('R2 upload error:', err);
      return null;
    }
  };

  // Convert base64 to blob
  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
  };

  // Process and send image to backend
  const processImageBase64 = async (base64Data: string) => {
    setIsLoading(true);
    setLoadingText("Inasoma mwandiko wa karatasi...");
    setError(null);
    
    try {
      // Try to upload to R2 first (for storage)
      const blob = base64ToBlob(base64Data);
      const r2Url = await uploadToR2(blob, `ocr-${Date.now()}.jpg`);
      if (r2Url) {
        setUploadedUrl(r2Url);
      }

      // Send to OCR API (always works with base64)
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: "image/jpeg",
          r2Url: r2Url || undefined
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Mifumo ya AI imepata hitilafu.");
      }

      const result = await response.json();
      if (result.success && result.data) {
        onSuccess(result.data);
        handleCloseScanner();
      } else {
        throw new Error(result.error || "AI haikuweza kuchambua picha hii.");
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      setError(err.message || "Imefeli kuchakata picha. Tafadhali jaribu tena au weka kwa mkono.");
    } finally {
      setIsLoading(false);
    }
  };

  // Capture frame from video feed
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        processImageBase64(dataUrl);
      }
    } catch (err) {
      setError("Haikuweza kuchukua picha kutoka kwenye video. Jaribu kupakia picha.");
    }
  };

  // Handle local file upload (opens gallery)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Tafadhali chagua faili ya picha (JPEG, PNG, WebP).");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Picha ni kubwa sana. Ukubwa unaoruhusiwa ni 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      processImageBase64(base64);
    };
    reader.onerror = () => {
      setError("Haikuweza kusoma faili la picha.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpenScanner}
        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl transition cursor-pointer w-fit"
        title="Piga picha ya mwandiko kwenye karatasi"
      >
        <Camera size={14} className="text-emerald-600 animate-pulse" />
        <Sparkles size={11} className="text-amber-500" />
        <span>{label}</span>
      </button>

      {/* Main Scanner Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-55 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl relative border border-slate-800 text-xs text-left animate-scale-in">
            
            {/* Header info */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="text-emerald-400" size={16} />
                <h4 className="font-bold text-sm">AI Scanner ya Mwandiko</h4>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                disabled={isLoading}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Instruction Banner */}
            <p className="text-slate-350 text-[10px] leading-relaxed">
              Piga picha ya karatasi iliyoandikwa <strong>Jina</strong>, <strong>Namba</strong>, <strong>Deni</strong>, na <strong>Maelezo</strong>. AI yetu itajaza fomu yenyewe mara moja.
            </p>

            {/* Error alerts */}
            {error && (
              <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-2xl flex items-start gap-2 text-rose-300">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">Hitilafu imetokea</p>
                  <p className="text-[10px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Camera / Loading Stage */}
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isLoading ? (
                /* Scanning animations and cycles text */
                <div className="flex flex-col items-center justify-center space-y-4 text-center p-4">
                  {/* Scanner Laser effect */}
                  <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-emerald-400/50 shadow-md animate-bounce top-12"></div>
                  
                  <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-400 text-xs animate-pulse">Inachambua Picha...</p>
                    <p className="text-[10px] text-slate-400">{loadingText}</p>
                  </div>
                  
                  {/* Show upload progress */}
                  {uploadedUrl && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle size={12} />
                      <span>Picha imepakiwa kwenye cloud</span>
                    </div>
                  )}
                </div>
              ) : cameraActive ? (
                /* Video live stream with guide overlay */
                <div className="w-full h-full relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Ledger Scanning frame guides */}
                  <div className="absolute inset-6 border-2 border-dashed border-emerald-500/40 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[9px] bg-slate-950/80 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                      Weka karatasi hapa
                    </span>
                  </div>
                </div>
              ) : (
                /* Fallback frame if camera is off */
                <div className="text-center p-6 space-y-2 text-slate-500">
                  <Camera size={40} className="mx-auto text-slate-700" />
                  <p className="text-xs font-semibold">Kamera haijaanza</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold transition"
                  >
                    Jaribu Kufungua Kamera
                  </button>
                </div>
              )}
            </div>

            {/* Controls panel */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-center gap-3">
                {cameraActive && !isLoading && (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:shadow-emerald-900/30 transition-all text-xs cursor-pointer"
                    >
                      <Camera size={16} /> Chukua Picha (Capture)
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title="Anza upya kamera"
                    >
                      <RefreshCw size={15} />
                    </button>
                  </>
                )}
              </div>

              {/* File upload from gallery - NO capture attribute */}
              {!isLoading && (
                <div className="pt-2 border-t border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                    Au pakia picha kutoka kwenye gallery
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-slate-600 rounded-xl text-[11px] font-bold transition cursor-pointer"
                  >
                    <Upload size={13} className="text-slate-400" /> Chagua Kutoka Gallery
                  </button>
                  
                  <p className="text-[9px] text-slate-600 mt-2 text-center">
                    Inasaidia: JPEG, PNG, WebP • Max 10MB
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
