/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { 
  Upload, FileText, Image, File, Download, Trash2, Edit2, 
  Eye, Search, X, Plus, Loader2, AlertCircle, CheckCircle,
  Camera, Calendar, Tag, ChevronLeft, ChevronRight
} from 'lucide-react';

interface MemoryItem {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'document' | 'receipt' | 'invoice' | 'other';
  fileUrl: string;
  fileName: string;
  fileSize: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export default function MemoryPage() {
  // State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<MemoryItem['type']>('receipt');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  
  // View state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [viewingItem, setViewingItem] = useState<MemoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  
  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<MemoryItem['type']>('receipt');
  const [editTags, setEditTags] = useState('');

  // Filtered memories
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

  // Get file icon based on type
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={20} className="text-blue-500" />;
      case 'receipt': return <FileText size={20} className="text-amber-500" />;
      case 'invoice': return <FileText size={20} className="text-purple-500" />;
      case 'document': return <File size={20} className="text-sky-500" />;
      default: return <File size={20} className="text-slate-500" />;
    }
  };

  // Get type label in Swahili
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return 'Picha';
      case 'receipt': return 'Risiti';
      case 'invoice': return 'Ankara';
      case 'document': return 'Hati';
      default: return 'Faili';
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError('Faili ni kubwa sana. Ukubwa unaoruhusiwa ni 20MB.');
      return;
    }

    setUploadFile(file);
    setError(null);

    // Auto-fill title from filename
    const name = file.name.replace(/\.[^/.]+$/, '');
    setUploadTitle(name);

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle) {
      setError('Tafadhali chagua faili na weka kichwa cha habari.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload to R2
      const result = await api.upload.image(uploadFile);

      if (result.success && result.url) {
        const newMemory: MemoryItem = {
          id: 'mem-' + Date.now(),
          title: uploadTitle,
          description: uploadDescription,
          type: uploadType,
          fileUrl: result.url,
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Save to localStorage (or API in future)
        const existing = JSON.parse(localStorage.getItem('ledger_memories') || '[]');
        existing.unshift(newMemory);
        localStorage.setItem('ledger_memories', JSON.stringify(existing));
        
        setMemories(existing);
        resetUploadForm();
        setSuccessMessage('Faili imepakiwa kikamilifu!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Imeshindwa kupakia faili.');
      }
    } catch (err: any) {
      setError(err.message || 'Hitilafu imetokea.');
    } finally {
      setIsUploading(false);
    }
  };

  // Load memories on mount
  useState(() => {
    const existing = JSON.parse(localStorage.getItem('ledger_memories') || '[]');
    setMemories(existing);
  });

  // Delete memory
  const handleDelete = (id: string) => {
    if (!confirm('Unataka kufuta kumbukumbu hii?')) return;
    
    const updated = memories.filter(m => m.id !== id);
    localStorage.setItem('ledger_memories', JSON.stringify(updated));
    setMemories(updated);
    
    if (viewingItem?.id === id) setViewingItem(null);
    if (editingItem?.id === id) setEditingItem(null);
  };

  // Start editing
  const startEdit = (item: MemoryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditType(item.type);
    setEditTags(item.tags.join(', '));
  };

  // Save edit
  const saveEdit = () => {
    if (!editingItem) return;
    
    const updated = memories.map(m => {
      if (m.id === editingItem.id) {
        return {
          ...m,
          title: editTitle,
          description: editDescription,
          type: editType,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    });
    
    localStorage.setItem('ledger_memories', JSON.stringify(updated));
    setMemories(updated);
    setEditingItem(null);
    setSuccessMessage('Kumbukumbu imesasishwa!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Reset upload form
  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadType('receipt');
    setUploadTags('');
    setUploadPreview(null);
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sw-TZ', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-accent" />
            Kumbukumbu (Memory Storage)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hifadhi risiti, ankara, picha na nyaraka zako zote salama.
          </p>
        </div>
        <div className="text-[10px] text-slate-400">
          Jumla: {memories.length} kumbukumbu
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500"><X size={16} /></button>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle size={16} /><span>{successMessage}</span>
        </div>
      )}

      {/* Upload Area */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Upload size={16} className="text-accent" />
          Pakia Faili Mpya
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File Drop Zone */}
          <div className="space-y-3">
            <label className="block">
              <div className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                uploadFile 
                  ? 'border-emerald-300 bg-emerald-50' 
                  : 'border-slate-200 hover:border-accent/50 hover:bg-slate-50'
              }`}>
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="max-h-48 mx-auto rounded-xl" />
                ) : uploadFile ? (
                  <div className="space-y-2">
                    <CheckCircle size={40} className="mx-auto text-emerald-500" />
                    <p className="font-bold text-emerald-700">{uploadFile.name}</p>
                    <p className="text-[10px] text-slate-400">{formatSize(uploadFile.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera size={40} className="mx-auto text-slate-300" />
                    <p className="font-bold text-slate-500">Bofya au buruta faili hapa</p>
                    <p className="text-[10px] text-slate-400">JPEG, PNG, PDF, DOC • Max 20MB</p>
                  </div>
                )}
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />
              </div>
            </label>

            {uploadFile && (
              <button onClick={() => { setUploadFile(null); setUploadPreview(null); }}
                className="text-rose-500 text-[10px] hover:underline">
                Ondoa faili
              </button>
            )}
          </div>

          {/* Upload Form */}
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kichwa cha Habari *</label>
              <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Mfano: Risiti ya Mchele Januari"
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Aina ya Faili</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value as MemoryItem['type'])}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white">
                  <option value="receipt">Risiti</option>
                  <option value="invoice">Ankara</option>
                  <option value="document">Hati</option>
                  <option value="image">Picha</option>
                  <option value="other">Nyingine</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Lebo (Tags)</label>
                <input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="Mfano: mchele, jan, 2026"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
              <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Maelezo ya ziada..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs h-20" />
            </div>

            <button onClick={handleUpload} disabled={isUploading || !uploadFile || !uploadTitle}
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50">
              {isUploading ? <><Loader2 size={14} className="animate-spin" /> Inapakia...</> : <><Upload size={14} /> Pakia Faili</>}
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta kumbukumbu..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs" />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
          {['All', 'receipt', 'invoice', 'document', 'image', 'other'].map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                typeFilter === type ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}>
              {type === 'All' ? 'Zote' : getTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMemories.length > 0 ? (
          filteredMemories.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition overflow-hidden group">
              {/* Preview */}
              <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => setViewingItem(item)}>
                {item.type === 'image' || item.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <img src={item.fileUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    {getFileIcon(item.type)}
                    <p className="text-[10px] text-slate-400 mt-1">{getTypeLabel(item.type)}</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5">
                <h4 className="font-bold text-slate-800 truncate">{item.title}</h4>
                <p className="text-[10px] text-slate-400 line-clamp-2">{item.description || 'Hakuna maelezo'}</p>
                
                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <span className="text-[9px] text-slate-400">{formatDate(item.createdAt)}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setViewingItem(item)}
                      className="p-1 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg transition" title="Tazama">
                      <Eye size={12} />
                    </button>
                    <button onClick={() => startEdit(item)}
                      className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Hariri">
                      <Edit2 size={12} />
                    </button>
                    <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Pakua">
                      <Download size={12} />
                    </a>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Futa">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold">Hakuna kumbukumbu zilizopatikana.</p>
            <p className="text-xs mt-1">Pakia faili mpya kwa kutumia fomu hapo juu.</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
              <h3 className="font-bold text-slate-800">{viewingItem.title}</h3>
              <div className="flex items-center gap-2">
                <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer"
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition" title="Pakua">
                  <Download size={16} />
                </a>
                <button onClick={() => { startEdit(viewingItem); setViewingItem(null); }}
                  className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition" title="Hariri">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => { handleDelete(viewingItem.id); }}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition" title="Futa">
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setViewingItem(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-6">
              {viewingItem.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={viewingItem.fileUrl} alt={viewingItem.title} className="w-full rounded-2xl" />
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  {getFileIcon(viewingItem.type)}
                  <p className="font-bold mt-2">{viewingItem.fileName}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(viewingItem.fileSize)}</p>
                  <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold">
                    <Download size={14} /> Pakua Faili
                  </a>
                </div>
              )}
              <div className="mt-4 space-y-2">
                <p className="text-xs text-slate-600">{viewingItem.description || 'Hakuna maelezo'}</p>
                <div className="flex items-center gap-4 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(viewingItem.createdAt)}</span>
                  <span className="flex items-center gap-1"><Tag size={10} /> {getTypeLabel(viewingItem.type)}</span>
                  <span>{formatSize(viewingItem.fileSize)}</span>
                </div>
                {viewingItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {viewingItem.tags.map((tag, i) => (
                      <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Hariri Kumbukumbu</h3>
              <button onClick={() => setEditingItem(null)} className="p-1.5 hover:bg-slate-100 rounded-xl">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Kichwa</label>
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Aina</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value as MemoryItem['type'])}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white">
                    <option value="receipt">Risiti</option>
                    <option value="invoice">Ankara</option>
                    <option value="document">Hati</option>
                    <option value="image">Picha</option>
                    <option value="other">Nyingine</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Lebo</label>
                  <input type="text" value={editTags} onChange={(e) => setEditTags(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Maelezo</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs h-20" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingItem(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-xs transition">
                  Ghairi
                </button>
                <button onClick={saveEdit}
                  className="flex-1 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold text-xs transition">
                  Hifadhi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
