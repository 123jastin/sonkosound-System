import React, { useRef, useState, useEffect } from 'react';
import { Camera, Sparkles, X, RefreshCw, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import Tesseract from 'tesseract.js';

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
  const [ocrProgress, setOcrProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const startCamera = async () => {
    setError(null);
    setCameraActive(false);
    try {
      const constraints = { video: { facingMode: 'environment' } };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      setError("Haikuweza kufungua camera. Pakia picha kutoka gallery badala yake.");
    }
  };

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
    setOcrProgress(0);
    startCamera();
  };

  const handleCloseScanner = () => {
    stopCamera();
    setIsOpen(false);
    setError(null);
    setUploadedUrl(null);
    setOcrProgress(0);
  };

  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  // Main OCR Pipeline: Tesseract → Groq
  const processImageBase64 = async (base64Data: string) => {
    setIsLoading(true);
    setError(null);
    setOcrProgress(0);
    
    try {
      // Step 1: Upload to R2 (optional, for storage)
      const blob = base64ToBlob(base64Data);
      uploadToR2(blob, `ocr-${Date.now()}.jpg`).then(url => {
        if (url) setUploadedUrl(url);
      });

      // Step 2: Extract text using Tesseract.js (FREE client-side OCR)
      setLoadingText("Inatambua maandishi (OCR)...");
      
      const { data: { text } } = await Tesseract.recognize(
        base64Data,
        'swa+eng', // Swahili + English
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const progress = Math.round(m.progress * 100);
              setOcrProgress(progress);
              setLoadingText(`Inachakata maandishi... ${progress}%`);
            }
          }
        }
      );

      console.log('📝 Tesseract extracted text:', text);

      if (!text || text.trim().length < 3) {
        throw new Error('Hakuna maandishi yaliyopatikana kwenye picha. Jaribu picha yenye mwanga mzuri.');
      }

      // Step 3: Send extracted text to Groq for smart parsing
      setLoadingText("AI inachambua taarifa...");
      setOcrProgress(100);
      
      const response = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Imeshindwa kuchambua maandishi.");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ Extracted data:', result.data);
        onSuccess(result.data);
        handleCloseScanner();
      } else {
        throw new Error(result.error || "AI haikuweza kuchambua data.");
      }
    } catch (err: any) {
      console.error('❌ OCR Error:', err);
      setError(err.message || "Imefeli kuchakata picha. Jaribu tena au weka taarifa kwa mkono.");
    } finally {
      setIsLoading(false);
    }
  };

  const uploadToR2 = async (blob: Blob, fileName: string): Promise<string | null> => {
    try {
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const result = await api.upload.image(file);
      if (result.success && result.url) {
        console.log('📤 Uploaded to R2:', result.url);
        return result.url;
      }
      return null;
    } catch (err) {
      console.warn('R2 upload skipped:', err);
      return null;
    }
  };

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
      setError("Haikuweza kuchukua picha. Jaribu kupakia kutoka gallery.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError("Tafadhali chagua faili ya picha (JPEG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Picha ni kubwa sana. Ukubwa unaoruhusiwa ni 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => processImageBase64(reader.result as string);
    reader.onerror = () => setError("Haikuweza kusoma faili.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full">
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

      {isOpen && (
        <div className="fixed inset-0 z-55 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl relative border border-slate-800 text-xs text-left animate-scale-in">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="text-emerald-400" size={16} />
                <h4 className="font-bold text-sm">AI Scanner ya Hati</h4>
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

            <p className="text-slate-350 text-[10px] leading-relaxed">
              Piga picha ya karatasi yenye <strong>Jina</strong>, <strong>Namba</strong>, <strong>Kiasi cha Deni</strong>. AI itajaza fomu moja kwa moja.
            </p>

            {error && (
              <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-2xl flex items-start gap-2 text-rose-300">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">Hitilafu</p>
                  <p className="text-[10px] mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4 text-center p-4">
                  <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-emerald-400/50 shadow-md animate-bounce top-12"></div>
                  
                  <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-400 text-xs animate-pulse">Inachambua...</p>
                    <p className="text-[10px] text-slate-400">{loadingText}</p>
                  </div>
                  
                  {/* OCR Progress Bar */}
                  {ocrProgress > 0 && (
                    <div className="w-full max-w-xs space-y-1">
                      <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${ocrProgress}%` }}></div>
                      </div>
                      <p className="text-[9px] text-slate-500">OCR: {ocrProgress}%</p>
                    </div>
                  )}
                  
                  {uploadedUrl && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <CheckCircle size={12} />
                      <span>Imepakiwa ✓</span>
                    </div>
                  )}
                </div>
              ) : cameraActive ? (
                <div className="w-full h-full relative">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-6 border-2 border-dashed border-emerald-500/40 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[9px] bg-slate-950/80 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                      Weka karatasi hapa
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-500">
                  <Camera size={40} className="mx-auto text-slate-700" />
                  <p className="text-xs font-semibold">Kamera haijaanza</p>
                  <button type="button" onClick={startCamera} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-bold transition">
                    Jaribu Kufungua Kamera
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-center gap-3">
                {cameraActive && !isLoading && (
                  <>
                    <button type="button" onClick={capturePhoto} className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all text-xs cursor-pointer">
                      <Camera size={16} /> Chukua Picha
                    </button>
                    <button type="button" onClick={startCamera} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition" title="Anza upya">
                      <RefreshCw size={15} />
                    </button>
                  </>
                )}
              </div>

              {!isLoading && (
                <div className="pt-2 border-t border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Au chagua kutoka gallery</span>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 rounded-xl text-[11px] font-bold transition cursor-pointer">
                    <Upload size={13} className="text-slate-400" /> Chagua Picha
                  </button>
                  <p className="text-[9px] text-slate-600 mt-2">JPEG, PNG, WebP • Max 10MB</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
