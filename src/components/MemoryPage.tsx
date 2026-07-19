/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { api } from '../services/api';
import { 
  Upload, FileText, Image, File, Download, Trash2, Edit2, 
  Eye, Search, X, Plus, Loader2, AlertCircle, CheckCircle,
  Camera, Calendar, Tag, FolderOpen, Filter
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
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    return JSON.parse(localStorage.getItem('ledger_memories') || '[]');
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  
  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadType, setUploadType] = useState<MemoryItem['type']>('receipt');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  
  // View modal
  const [viewingItem, setViewingItem] = useState<MemoryItem | null>(null);
  
  // Edit modal
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={28} className="text-blue-500" />;
      case 'receipt': return <FileText size={28} className="text-amber-500" />;
      case 'invoice': return <FileText size={28} className="text-purple-500" />;
      case 'document': return <File size={28} className="text-sky-500" />;
      default: return <File size={28} className="text-slate-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return 'Picha';
      case 'receipt': return 'Risiti';
      case 'invoice': return 'Ankara';
      case 'document': return 'Hati';
      default: return 'Faili';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-blue-100 text-blue-700';
      case 'receipt': return 'bg-amber-100 text-amber-700';
      case 'invoice': return 'bg-purple-100 text-purple-700';
      case 'document': return 'bg-sky-100 text-sky-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sw-TZ', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('Faili ni kubwa sana. Max 20MB.');
      return;
    }
    setUploadFile(file);
    setError(null);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
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
      setError('Weka faili na kichwa cha habari.');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
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
        const updated = [newMemory, ...memories];
        localStorage.setItem('ledger_memories', JSON.stringify(updated));
        setMemories(updated);
        resetUploadForm();
        setShowUploadModal(false);
        setSuccessMessage('✅ Imepakiwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError('Imeshindwa kupakia.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null); setUploadTitle(''); setUploadDescription('');
    setUploadType('receipt'); setUploadTags(''); setUploadPreview(null);
  };

  // Delete
  const handleDelete = (id: string) => {
    if (!confirm('Futa kumbukumbu hii?')) return;
    const updated = memories.filter(m => m.id !== id);
    localStorage.setItem('ledger_memories', JSON.stringify(updated));
    setMemories(updated);
    if (viewingItem?.id === id) setViewingItem(null);
    if (editingItem?.id === id) setEditingItem(null);
  };

  // Edit
  const startEdit = (item: MemoryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditType(item.type);
    setEditTags(item.tags.join(', '));
  };

  const saveEdit = () => {
    if (!editingItem) return;
    const updated = memories.map(m => {
      if (m.id === editingItem.id) {
        return {
          ...m, title: editTitle, description: editDescription,
          type: editType, tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          updatedAt: new Date().toISOString()
        };
      }
      return m;
    });
    localStorage.setItem('ledger_memories', JSON.stringify(updated));
    setMemories(updated);
    setEditingItem(null);
    setSuccessMessage('✅ Imesasishwa!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-5 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FolderOpen size={20} className="text-accent" />
            Kumbukumbu (Memory Storage)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Hifadhi risiti, ankara, picha na nyaraka zako. Jumla: {memories.length}</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700"><AlertCircle size={14} /><span>{error}</span></div>
          <button onClick={() => setError(null)} className="text-rose-500"><X size={14} /></button>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-emerald-700">
          <CheckCircle size={14} /><span>{successMessage}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta kumbukumbu..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs" />
        </div>
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto items-center">
          <Filter size={12} className="text-slate-400 shrink-0" />
          {['All', 'receipt', 'invoice', 'document', 'image', 'other'].map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                typeFilter === type ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}>
              {type === 'All' ? 'Zote' : getTypeLabel(type)}
            </button>
          ))}
          <button onClick={() => setShowUploadModal(true)}
            className="ml-2 bg-accent hover:bg-accent/90 text-white font-bold text-[11px] py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition shrink-0">
            <Plus size={13} /> Pakia Faili
          </button>
        </div>
      </div>

      {/* Memory Grid - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredMemories.length > 0 ? (
          filteredMemories.map(item => (
            <div key={item.id} 
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group overflow-hidden flex flex-col">
              
              {/* Preview Area */}
              <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer relative"
                onClick={() => setViewingItem(item)}>
                {item.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                  <img src={item.fileUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-3">
                    {getTypeIcon(item.type)}
                    <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{getTypeLabel(item.type)}</p>
                  </div>
                )}
                {/* Type badge */}
                <span className={`absolute top-2 left-2 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getTypeColor(item.type)}`}>
                  {getTypeLabel(item.type)}
                </span>
              </div>

              {/* Info */}
              <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="font-bold text-slate-800 truncate text-[11px]">{item.title}</h4>
                  <p className="text-[9px] text-slate-400 line-clamp-1 mt-0.5">{item.description || 'Hakuna maelezo'}</p>
                </div>
                
                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tag}</span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[8px] text-slate-400">+{item.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <span className="text-[9px] text-slate-400">{formatDate(item.createdAt)}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={(e) => { e.stopPropagation(); setViewingItem(item); }}
                      className="p-1 text-slate-400 hover:text-accent hover:bg-accent/10 rounded-lg" title="Tazama">
                      <Eye size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                      className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Hariri">
                      <Edit2 size={11} />
                    </button>
                    <a href={item.fileUrl} download={item.fileName} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Pakua">
                      <Download size={11} />
                    </a>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Futa">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-3xl border border-slate-100 p-16 text-center text-slate-400">
            <FolderOpen size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-sm font-semibold">Hakuna kumbukumbu zilizopatikana.</p>
            <p className="text-xs mt-1 mb-4">Pakia faili mpya kwa kubofya kitufe cha "Pakia Faili".</p>
            <button onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold">
              <Plus size={14} /> Pakia Faili ya Kwanza
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Upload size={16} className="text-accent" /> Pakia Faili Mpya
              </h3>
              <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="p-1.5 hover:bg-slate-100 rounded-xl">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* File Drop Zone */}
              <label className="block">
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  uploadFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-accent/50 hover:bg-slate-50'
                }`}>
                  {uploadPreview ? (
                    <img src={uploadPreview} alt="Preview" className="max-h-40 mx-auto rounded-xl" />
                  ) : uploadFile ? (
                    <div className="space-y-1">
                      <CheckCircle size={32} className="mx-auto text-emerald-500" />
                      <p className="font-bold text-emerald-700 text-xs">{uploadFile.name}</p>
                      <p className="text-[10px] text-slate-400">{formatSize(uploadFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload size={32} className="mx-auto text-slate-300" />
                      <p className="font-bold text-slate-500 text-xs">Bofya kuchagua faili</p>
                      <p className="text-[10px] text-slate-400">JPEG, PNG, PDF, DOC • Max 20MB</p>
                    </div>
                  )}
                  <input type="file" onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
                </div>
              </label>

              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Kichwa *</label>
                <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Mfano: Risiti ya Mchele" className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
              </div>

              {/* Type & Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Aina</label>
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
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Lebo (Tags)</label>
                  <input type="text" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="mfano: mchele, jan" className="w-full p-2.5 border border-slate-200 rounded-xl text-xs" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">Maelezo</label>
                <textarea value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Maelezo ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl text-xs h-20" />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-xs transition">
                  Ghairi
                </button>
                <button onClick={handleUpload} disabled={isUploading || !uploadFile || !uploadTitle}
                  className="flex-1 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {isUploading ? <><Loader2 size={14} className="animate-spin" /> Inapakia...</> : <><Upload size={14} /> Pakia</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex items-center justify-between rounded-t-3xl z-10">
              <h3 className="font-bold text-slate-800 text-sm truncate">{viewingItem.title}</h3>
              <div className="flex items-center gap-1.5">
                <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer"
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition" title="Pakua">
                  <Download size={15} />
                </a>
                <button onClick={() => { startEdit(viewingItem); setViewingItem(null); }}
                  className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition" title="Hariri">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => { handleDelete(viewingItem.id); }}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition" title="Futa">
                  <Trash2 size={15} />
                </button>
                <button onClick={() => setViewingItem(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="p-6">
              {viewingItem.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={viewingItem.fileUrl} alt={viewingItem.title} className="w-full rounded-2xl" />
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-2xl">
                  {getTypeIcon(viewingItem.type)}
                  <p className="font-bold mt-3 text-sm">{viewingItem.fileName}</p>
                  <p className="text-[10px] text-slate-400">{formatSize(viewingItem.fileSize)}</p>
                  <a href={viewingItem.fileUrl} download={viewingItem.fileName} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold">
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
                  <div className="flex flex-wrap gap-1 pt-1">
                    {viewingItem.tags.map((tag, i) => (
                      <span key={i} className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Hariri Kumbukumbu</h3>
              <button onClick={() => setEditingItem(null)} className="p-1.5 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
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
                    <option value="receipt">Risiti</option><option value="invoice">Ankara</option>
                    <option value="document">Hati</option><option value="image">Picha</option>
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
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-xs">Ghairi</button>
                <button onClick={saveEdit}
                  className="flex-1 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold text-xs">Hifadhi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
