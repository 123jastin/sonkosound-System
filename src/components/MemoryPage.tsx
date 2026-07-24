/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { 
  Upload, FileText, Image, File, Download, Trash2, Edit2, 
  Eye, Search, X, Plus, Loader2, AlertCircle, CheckCircle,
  Calendar, Tag, FolderOpen
} from 'lucide-react';

interface MemoryItem {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'document' | 'receipt' | 'invoice' | 'other';
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<MemoryItem['type']>('receipt');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  
  const [viewingItem, setViewingItem] = useState<MemoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<MemoryItem['type']>('receipt');
  const [editTags, setEditTags] = useState('');

  // Fetch memories from D1 on mount
  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = useCallback(async () => {
    setIsLoadingMemories(true);
    try {
      const data = await api.memories.list();
      setMemories(data.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        type: m.type || 'other',
        fileUrl: m.file_url,
        fileName: m.file_name,
        fileSize: m.file_size || 0,
        mimeType: m.mime_type || 'application/octet-stream',
        tags: Array.isArray(m.tags) ? m.tags : JSON.parse(m.tags || '[]'),
        createdAt: m.created_at,
        updatedAt: m.updated_at
      })));
    } catch (err: any) {
      console.error('Failed to fetch memories:', err);
      // Fallback to localStorage
      const cached = JSON.parse(localStorage.getItem('ledger_memories') || '[]');
      setMemories(cached);
    } finally {
      setIsLoadingMemories(false);
    }
  }, []);

  const filteredMemories = useMemo(() => {
    return memories.filter(item => {
      const matchesSearch = 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = typeFilter === 'All' || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [memories, searchQuery, typeFilter]);

  // Check if file is image
  const isImageFile = (item: MemoryItem) => {
    return item.mimeType?.startsWith('image/') || item.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i);
  };

  // Check if file is PDF
  const isPDF = (item: MemoryItem) => {
    return item.mimeType === 'application/pdf' || item.fileName.endsWith('.pdf');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={24} className="text-blue-500" />;
      case 'receipt': return <FileText size={24} className="text-amber-500" />;
      case 'invoice': return <FileText size={24} className="text-purple-500" />;
      case 'document': return <File size={24} className="text-sky-500" />;
      default: return <File size={24} className="text-slate-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) { case 'image': return 'Picha'; case 'receipt': return 'Risiti'; case 'invoice': return 'Ankara'; case 'document': return 'Hati'; default: return 'Faili'; }
  };

  const getTypeColor = (type: string) => {
    switch (type) { case 'image': return 'bg-blue-100 text-blue-700'; case 'receipt': return 'bg-amber-100 text-amber-700'; case 'invoice': return 'bg-purple-100 text-purple-700'; case 'document': return 'bg-sky-100 text-sky-700'; default: return 'bg-slate-100 text-slate-700'; }
  };

  const formatSize = (bytes: number) => bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB';
  
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('sw-TZ', { month: 'short', day: 'numeric' });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError('Faili ni kubwa sana. Max 20MB.'); return; }
    setUploadFile(file); setError(null);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setUploadPreview(null); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle) { setError('Weka faili na kichwa.'); return; }
    setIsUploading(true); setError(null);
    try {
      // Upload to R2
      const result = await api.upload.image(uploadFile);
      if (result.success && result.url) {
        // Save to D1
        await api.memories.create({
          title: uploadTitle,
          description: uploadDescription,
          type: uploadType,
          fileUrl: result.url,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          mimeType: uploadFile.type,
          tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean)
        });
        await fetchMemories();
        resetUploadForm();
        setShowUploadModal(false);
        setSuccessMessage('✅ Imepakiwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Imeshindwa kupakia.');
      }
    } catch (err: any) { 
      setError(err.message); 
      // Fallback to localStorage
      const newMemory: MemoryItem = {
        id: 'mem-' + Date.now(), title: uploadTitle, description: uploadDescription,
        type: uploadType, fileUrl: '', fileName: uploadFile.name,
        fileSize: uploadFile.size, mimeType: uploadFile.type,
        tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      const cached = JSON.parse(localStorage.getItem('ledger_memories') || '[]');
      cached.unshift(newMemory);
      localStorage.setItem('ledger_memories', JSON.stringify(cached));
      setMemories(cached);
      resetUploadForm();
      setShowUploadModal(false);
    } finally { setIsUploading(false); }
  };

  const resetUploadForm = () => { setUploadFile(null); setUploadTitle(''); setUploadDescription(''); setUploadType('receipt'); setUploadTags(''); setUploadPreview(null); };

  const handleDelete = async (id: string) => {
    if (!confirm('Futa kumbukumbu hii?')) return;
    try {
      await api.memories.delete(id);
      await fetchMemories();
      if (viewingItem?.id === id) setViewingItem(null);
      if (editingItem?.id === id) setEditingItem(null);
    } catch (err: any) {
      // Fallback to localStorage
      const updated = memories.filter(m => m.id !== id);
      localStorage.setItem('ledger_memories', JSON.stringify(updated));
      setMemories(updated);
    }
  };

  const startEdit = (item: MemoryItem) => { 
    setEditingItem(item); 
    setEditTitle(item.title); 
    setEditDescription(item.description); 
    setEditType(item.type); 
    setEditTags(item.tags.join(', ')); 
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      await api.memories.update(editingItem.id, {
        title: editTitle,
        description: editDescription,
        type: editType,
        fileUrl: editingItem.fileUrl,
        fileName: editingItem.fileName,
        fileSize: editingItem.fileSize,
        mimeType: editingItem.mimeType || 'application/octet-stream',
        tags: editTags.split(',').map(t => t.trim()).filter(Boolean)
      });
      await fetchMemories();
      setEditingItem(null);
      setSuccessMessage('✅ Imesasishwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      // Fallback to localStorage
      const updated = memories.map(m => m.id === editingItem.id ? { ...m, title: editTitle, description: editDescription, type: editType, tags: editTags.split(',').map(t => t.trim()).filter(Boolean), updatedAt: new Date().toISOString() } : m);
      localStorage.setItem('ledger_memories', JSON.stringify(updated));
      setMemories(updated); 
      setEditingItem(null);
    }
  };

  // Show loading state
  if (isLoadingMemories) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-accent mx-auto" />
          <p className="text-sm text-slate-400">Inapakia kumbukumbu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <FolderOpen size={18} className="text-accent" />
          Kumbukumbu
        </h2>
        <span className="text-[10px] text-slate-400">{memories.length} faili</span>
      </div>

      {/* Messages */}
      {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between"><div className="flex items-center gap-2 text-rose-700"><AlertCircle size={14} /><span>{error}</span></div><button onClick={() => setError(null)} className="text-rose-500"><X size={14} /></button></div>}
      {successMessage && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-700"><CheckCircle size={14} /><span>{successMessage}</span></div>}

      {/* Search + Filter + Upload */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta kumbukumbu..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-accent focus:border-accent" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          {['All', 'receipt', 'invoice', 'image', 'document', 'other'].map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}
              className={`px-4 py-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                typeFilter === type 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              {type === 'All' ? 'Zote' : getTypeLabel(type)}
            </button>
          ))}
          <button onClick={() => setShowUploadModal(true)}
            className="ml-auto bg-accent hover:bg-accent/90 text-white font-bold text-[11px] py-2.5 px-4 rounded-full flex items-center gap-1.5 shadow-sm transition shrink-0">
            <Plus size={13} /> Pakia
          </button>
        </div>
      </div>

      {/* KiKUU-Style Masonry Grid */}
      <div className="grid grid-cols-2 gap-2 auto-rows-[120px]">
        {filteredMemories.length > 0 ? (
          filteredMemories.map((item, index) => {
            const position = index % 6;
            const large = position === 0 || position === 5;

            return (
              <div key={item.id} 
                onClick={() => setViewingItem(item)}
                className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition cursor-pointer group ${
                  large ? "row-span-2" : "row-span-1"
                }`}>
                
                <div className={`w-full ${large ? "h-44" : "h-20"} bg-slate-100 relative overflow-hidden`}>
                  {isImageFile(item) ? (
                    <img src={item.fileUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : isPDF(item) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                      <FileText size={24} className="text-red-500" />
                      <span className="text-[8px] text-red-500 mt-1 font-bold">PDF</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getTypeIcon(item.type)}
                    </div>
                  )}
                  <span className={`absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getTypeColor(item.type)}`}>
                    {getTypeLabel(item.type)}
                  </span>
                  
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setViewingItem(item); }}
                      className="p-1.5 bg-white rounded-full text-slate-700 hover:bg-accent hover:text-white transition" title="Tazama">
                      <Eye size={13} />
                    </button>
                    <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-white rounded-full text-slate-700 hover:bg-blue-500 hover:text-white transition" title="Pakua">
                      <Download size={13} />
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                      className="p-1.5 bg-white rounded-full text-slate-700 hover:bg-amber-500 hover:text-white transition" title="Hariri">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="p-1.5 bg-white rounded-full text-slate-700 hover:bg-rose-500 hover:text-white transition" title="Futa">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="p-2.5">
                  <h3 className="font-semibold text-[12px] text-slate-800 truncate">{item.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{getTypeLabel(item.type)}</span>
                    <span className="text-[9px] text-slate-400">{formatDate(item.createdAt)}</span>
                  </div>
                  {large && item.description && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                  )}
                  {large && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
            <FolderOpen size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm font-semibold">Hakuna kumbukumbu</p>
            <p className="text-xs mt-1 mb-3">Pakia faili mpya kwa kubofya "Pakia"</p>
            <button onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-full text-xs font-bold">
              <Plus size={13} /> Pakia Faili
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2"><Upload size={16} className="text-accent" /> Pakia Faili</h3>
              <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="p-1.5 hover:bg-slate-100 rounded-full"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${uploadFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-accent/50'}`}>
                  {uploadPreview ? <img src={uploadPreview} alt="Preview" className="max-h-32 mx-auto rounded-lg" /> :
                   uploadFile ? <div className="space-y-1"><CheckCircle size={28} className="mx-auto text-emerald-500" /><p className="font-bold text-emerald-700 text-[11px]">{uploadFile.name}</p><p className="text-[10px] text-slate-400">{formatSize(uploadFile.size)}</p></div> :
                   <div className="space-y-1"><Upload size={28} className="mx-auto text-slate-300" /><p className="font-bold text-slate-500 text-[11px]">Bofya kuchagua faili</p><p className="text-[10px] text-slate-400">JPEG, PNG, PDF, DOC • Max 20MB</p></div>}
                  <input type="file" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
                </div>
              </label>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Kichwa *</label><input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Mfano: Risiti ya Mchele" className="w-full p-2.5 border border-slate-200 rounded-lg text-xs" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Aina</label><select value={uploadType} onChange={(e) => setUploadType(e.target.value as MemoryItem['type'])} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white"><option value="receipt">Risiti</option><option value="invoice">Ankara</option><option value="document">Hati</option><option value="image">Picha</option><option value="other">Nyingine</option></select></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Lebo</label><input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="mfano: mchele" className="w-full p-2.5 border border-slate-200 rounded-lg text-xs" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Maelezo</label><textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="Maelezo..." className="w-full p-2.5 border border-slate-200 rounded-lg text-xs h-16" /></div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-xs">Ghairi</button>
                <button onClick={handleUpload} disabled={isUploading || !uploadFile || !uploadTitle} className="flex-1 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg font-semibold text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUploading ? <><Loader2 size={13} className="animate-spin" /> Inapakia...</> : <><Upload size={13} /> Pakia</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="sticky top-0 bg-white p-3 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="font-bold text-slate-800 text-sm truncate">{viewingItem.title}</h3>
              <div className="flex items-center gap-1">
                <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"><Download size={15} /></a>
                <button onClick={() => { startEdit(viewingItem); setViewingItem(null); }} className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition"><Edit2 size={15} /></button>
                <button onClick={() => { handleDelete(viewingItem.id); }} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"><Trash2 size={15} /></button>
                <button onClick={() => setViewingItem(null)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"><X size={15} /></button>
              </div>
            </div>
            <div className="p-4">
              {isImageFile(viewingItem) ? (
                <img src={viewingItem.fileUrl} alt={viewingItem.title} className="w-full rounded-xl" />
              ) : isPDF(viewingItem) ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <FileText size={40} className="mx-auto text-red-500" />
                  <p className="font-bold mt-2 text-sm">{viewingItem.fileName}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(viewingItem.fileSize)}</p>
                  <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold"><Download size={13} /> Pakua Faili</a>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  {getTypeIcon(viewingItem.type)}
                  <p className="font-bold mt-2 text-sm">{viewingItem.fileName}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(viewingItem.fileSize)}</p>
                  <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold"><Download size={13} /> Pakua Faili</a>
                </div>
              )}
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-slate-600">{viewingItem.description || 'Hakuna maelezo'}</p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(viewingItem.createdAt)}</span>
                  <span className="flex items-center gap-1"><Tag size={10} /> {getTypeLabel(viewingItem.type)}</span>
                  <span>{formatSize(viewingItem.fileSize)}</span>
                </div>
                {viewingItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {viewingItem.tags.map((tag, i) => <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-slate-800">Hariri Kumbukumbu</h3>
              <button onClick={() => setEditingItem(null)} className="p-1.5 hover:bg-slate-100 rounded-full"><X size={15} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Kichwa</label><input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Aina</label><select value={editType} onChange={(e) => setEditType(e.target.value as MemoryItem['type'])} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs bg-white"><option value="receipt">Risiti</option><option value="invoice">Ankara</option><option value="document">Hati</option><option value="image">Picha</option><option value="other">Nyingine</option></select></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Lebo</label><input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Maelezo</label><textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-xs h-16" /></div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingItem(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-xs">Ghairi</button>
                <button onClick={saveEdit} className="flex-1 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg font-semibold text-xs">Hifadhi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
