import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, File, Folder, Search, Cloud, Image, FileText, Music, Video, HardDrive, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';
import toast, { Toaster } from 'react-hot-toast';

interface FileItem {
  id: string;
  name: string;
  size: string;
  type: 'file' | 'folder';
  modified: string;
  fileType?: 'image' | 'document' | 'music' | 'video';
  storage_path: string;
}

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('modified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadCount, setLoadCount] = useState(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadFiles = async (isRetry = false) => {
    if (!session?.user) return;
    
    try {
      setIsLoadingFiles(true);
      setConnectionError(false);

      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', session.user.id)
        .order('modified_at', { ascending: false });

      if (error) throw error;

      const formattedFiles = data?.map(file => ({
        id: file.id,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        modified: new Date(file.modified_at).toLocaleDateString(),
        fileType: file.file_type,
        storage_path: file.storage_path
      })) || [];

      setFiles(formattedFiles);
      setLoadCount(prev => prev + 1);

      if (isRetry) {
        setRetryCount(0);
        toast.success('连接恢复成功');
      }

    } catch (error: any) {
      console.error('Error loading files:', error);
      if (error.message?.includes('fetch')) {
        setConnectionError(true);
        if (!isRetry) {
          setRetryCount(prev => prev + 1);
          if (retryCount < 3) {
            setTimeout(() => loadFiles(true), 2000 * Math.pow(2, retryCount));
          }
        }
        toast.error('连接服务器失败，正在重试...');
      } else {
        toast.error('加载文件失败');
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        setSession(session);
        if (session) {
          // Initial load
          await loadFiles();
          
          // Schedule 9 more loads with 1-second intervals
          for (let i = 0; i < 9; i++) {
            setTimeout(() => loadFiles(), (i + 1) * 1000);
          }
        }
      } catch (error: any) {
        console.error('Authentication error:', error);
        setConnectionError(true);
        toast.error('连接服务器失败，请检查网络连接');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        setLoadCount(0);
        // Initial load
        await loadFiles();
        
        // Schedule 9 more loads with 1-second intervals
        for (let i = 0; i < 9; i++) {
          setTimeout(() => loadFiles(), (i + 1) * 1000);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('注册成功！请登录');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('登录成功！');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setFiles([]);
      setLoadCount(0);
      toast.success('已退出登录');
    } catch (error: any) {
      toast.error('退出失败');
    }
  };

  const getFileIcon = (file: FileItem) => {
    switch (file.fileType) {
      case 'image':
        return <Image className="w-6 h-6 text-blue-600" />;
      case 'document':
        return <FileText className="w-6 h-6 text-blue-600" />;
      case 'music':
        return <Music className="w-6 h-6 text-blue-600" />;
      case 'video':
        return <Video className="w-6 h-6 text-blue-600" />;
      default:
        return <File className="w-6 h-6 text-blue-600" />;
    }
  };

  const getIconBackground = (file: FileItem) => {
    switch (file.fileType) {
      case 'image':
        return 'bg-blue-100/50';
      case 'document':
        return 'bg-green-100/50';
      case 'music':
        return 'bg-purple-100/50';
      case 'video':
        return 'bg-red-100/50';
      default:
        return 'bg-gray-100/50';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || !session?.user) return;

    setIsUploading(true);
    const uploadToast = toast.loading(`正在上传文件...`);

    try {
      for (const file of uploadedFiles) {
        const fileId = crypto.randomUUID();
        const storagePath = `${session.user.id}/${fileId}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('files')
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from('files')
          .insert({
            id: fileId,
            name: file.name,
            size: file.size,
            type: 'file',
            file_type: getFileType(file),
            storage_path: storagePath,
            user_id: session.user.id
          });

        if (dbError) throw dbError;
      }

      await loadFiles();
      toast.success('文件上传成功', { id: uploadToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('文件上传失败', { id: uploadToast });
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const getFileType = (file: File): 'image' | 'document' | 'music' | 'video' | undefined => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'music';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.includes('pdf') || file.type.includes('document')) return 'document';
    return undefined;
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const { data: { publicUrl } } = supabase.storage
        .from('files')
        .getPublicUrl(file.storage_path);

      window.open(publicUrl, '_blank');
      toast.success('下载开始');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('文件下载失败');
    }
  };

  const handleDelete = async (id: string) => {
    const fileToDelete = files.find(f => f.id === id);
    if (!fileToDelete) return;

    const confirmDelete = window.confirm('确定要删除这个文件吗？');
    if (!confirmDelete) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('files')
        .remove([fileToDelete.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      await loadFiles();
      setSelectedFiles(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(id);
        return newSelected;
      });
      toast.success('文件已删除');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('删除文件失败');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    const confirmDelete = window.confirm(`确定要删除 ${selectedFiles.size} 个文件吗？`);
    if (!confirmDelete) return;

    try {
      const selectedFileObjects = files.filter(file => selectedFiles.has(file.id));

      const { error: storageError } = await supabase.storage
        .from('files')
        .remove(selectedFileObjects.map(file => file.storage_path));

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .in('id', Array.from(selectedFiles));

      if (dbError) throw dbError;

      await loadFiles();
      setSelectedFiles(new Set());
      toast.success(`已删除 ${selectedFiles.size} 个文件`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('批量删除文件失败');
    }
  };

  const handleSort = (key: 'name' | 'size' | 'modified') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  const handleFileSelect = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    const newSelected = new Set(selectedFiles);
    if (event.ctrlKey || event.metaKey) {
      if (selectedFiles.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    } else {
      newSelected.clear();
      newSelected.add(id);
    }
    setSelectedFiles(newSelected);
  };

  const sortedFiles = [...files].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = parseFloat(a.size) - parseFloat(b.size);
        break;
      case 'modified':
        comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const filteredFiles = sortedFiles.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="glass-morphism p-8 rounded-3xl shadow-glow text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="glass-morphism p-8 rounded-3xl shadow-glow text-center max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg">
              <Cloud className="w-12 h-12 text-white animate-float" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
            云存储
          </h1>
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative">
              <input
                type="email"
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {isSignUp ? '注册' : '登录'}
            </button>
          </form>
          <p className="mt-4 text-gray-600">
            {isSignUp ? '已有账号?' : "没有账号?"}{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              {isSignUp ? '登录' : '注册'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient">
      <Toaster position="top-right" />
      
      <div className="glass-morphism sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg animate-float">
                <Cloud className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                云存储
              </h1>
            </div>
            <div className="flex items-center space-x-6">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="搜索文件..."
                  className="w-80 pl-11 pr-4 py-3 glass-morphism rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm group-hover:shadow-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
              </div>
              <label className={`
                relative flex items-center px-6 py-3 
                bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 
                text-white rounded-2xl cursor-pointer 
                transition-all duration-300 
                transform hover:-translate-y-0.5 hover:shadow-xl
                ${isUploading ? 'upload-button-active' : ''}
              `}>
                <Upload className={`w-5 h-5 mr-2 ${isUploading ? 'animate-bounce' : ''}`} />
                <span className="relative z-10">
                  {isUploading ? '上传中...' : '上传文件'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  multiple
                />
              </label>
              {selectedFiles.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-6 py-3 bg-red-100 text-red-600 rounded-2xl hover:bg-red-200 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  删除选中 ({selectedFiles.size})
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {connectionError && (
          <div className="glass-morphism rounded-3xl shadow-glow mb-8 p-6 bg-red-50">
            <div className="flex items-center space-x-4 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <p>连接服务器失败，正在尝试重新连接...</p>
            </div>
          </div>
        )}

        <div className="glass-morphism rounded-3xl shadow-glow hover-scale mb-8 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100/50 rounded-2xl">
                <HardDrive className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">存储使用情况</h3>
                <p className="text-sm text-gray-600">
                  {files.length} 个文件 • {formatFileSize(files.reduce((acc, file) => acc + parseFloat(file.size), 0))}
                  {loadCount > 0 && ` • 已同步 ${loadCount}/10 次`}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-2 w-64 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min((files.reduce((acc, file) => acc + parseFloat(file.size), 0) / 1000000000) * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">
                {Math.min((files.reduce((acc, file) => acc + parseFloat(file.size), 0) / 1000000000) * 100, 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="glass-morphism rounded-3xl shadow-glow hover-scale">
          <div className="px-8 py-5 border-b border-gray-100/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-800">我的文件</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-colors duration-200 ${
                      viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <File className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors duration-200 ${
                      viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Folder className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleSort('name')}
                  className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                    sortBy === 'name' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  名称 {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('size')}
                  className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                    sortBy === 'size' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  大小 {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('modified')}
                  className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                    sortBy === 'modified' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  修改时间 {sortBy === 'modified' && (sortOrder === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>

          {isLoadingFiles ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">加载文件中...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-8 text-center">
              <div className="bg-gray-100/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <File className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600">还没有上传任何文件</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100/50">
                <thead>
                  <tr className="bg-gray-50/30">
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">名称</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">大小</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">修改时间</th>
                    <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      onClick={(e) => handleFileSelect(file.id, e)}
                      className={`hover:bg-blue-50/30 transition-colors duration-300 cursor-pointer ${
                        selectedFiles.has(file.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-3 ${getIconBackground(file)} rounded-xl mr-4 shadow-sm`}>
                            {getFileIcon(file)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{file.size}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{file.modified}</span>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex space-x-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                            className="p-2.5 bg-blue-100/80 rounded-xl text-blue-600 hover:bg-blue-200/80 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                            title="下载"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(file.id);
                            }}
                            className="p-2.5 bg-red-100/80 rounded-xl text-red-600 hover:bg-red-200/80 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={(e) => handleFileSelect(file.id, e)}
                  className={`glass-morphism rounded-2xl p-4 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${
                    selectedFiles.has(file.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                 Continuing the App.tsx file content exactly where it left off:

                    <div className={`p-3 ${getIconBackground(file)} rounded-xl shadow-sm`}>
                      {getFileIcon(file)}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        className="p-2 bg-blue-100/80 rounded-lg text-blue-600 hover:bg-blue-200/80 transition-all duration-200"
                        title="下载"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.id);
                        }}
                        className="p-2 bg-red-100/80 rounded-lg text-red-600 hover:bg-red-200/80 transition-all duration-200"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 truncate mb-1">{file.name}</h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{file.size}</span>
                    <span>{file.modified}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;