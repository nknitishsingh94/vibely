'use client';

import * as React from 'react';
import {
  X,
  Image as ImageIcon,
  Music,
  Film,
  FileText,
  Download,
  CalendarHeart,
  Lock,
  Bookmark,
  Heart,
  Sparkles,
} from 'lucide-react';
import { useChat } from '@/context/chat-context';
import { Avatar } from '@/components/ui/avatar';
import { formatBytes, formatMessageDate } from '@/lib/utils';
import { ImagePreview } from './media/image-preview';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { Button } from '@/components/ui/button';

export function MediaGalleryDrawer() {
  const {
    isMediaDrawerOpen,
    setIsMediaDrawerOpen,
    activeConversation,
    messages,
  } = useChat();

  const { anniversary, daysTogether, updateAnniversary, favorites } = useRomanticFeatures();
  const [activeTab, setActiveTab] = React.useState<'images' | 'audio' | 'videos' | 'files' | 'favorites'>('images');
  const [isEditingDate, setIsEditingDate] = React.useState(false);
  const [tempDate, setTempDate] = React.useState(anniversary || '');

  if (!isMediaDrawerOpen) return null;

  const friend = activeConversation?.otherUser;

  // Filter messages by category
  const images = messages.filter(m => m.message_type === 'image' && m.signedMediaUrl);
  const audioFiles = messages.filter(m => m.message_type === 'audio' && m.signedMediaUrl);
  const videos = messages.filter(m => m.message_type === 'video' && m.signedMediaUrl);
  const documents = messages.filter(m => m.message_type === 'file' && m.original_filename);
  const savedMoments = messages.filter(m => favorites.includes(m.id));

  const handleSaveDate = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnniversary(tempDate || null);
    setIsEditingDate(false);
  };

  return (
    <aside className="w-80 lg:w-96 border-l border-border/70 bg-card flex flex-col h-full animate-in slide-in-from-right duration-200 z-20 select-none shadow-xl">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-serif font-bold text-foreground flex items-center gap-1.5">
            <span>Our Moments</span>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </h3>
          <p className="text-[11px] text-muted-foreground font-sans">
            The moments that matter most
          </p>
        </div>
        <button
          onClick={() => setIsMediaDrawerOpen(false)}
          className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Intimate Partner Profile Card */}
        <div className="flex flex-col items-center text-center p-4 rounded-3xl bg-muted/40 border border-border/50 relative overflow-hidden">
          <Avatar
            src={friend?.avatar_path}
            name={friend?.display_name || 'Partner'}
            size="lg"
            className="mb-3 shadow-md"
          />
          <h4 className="font-semibold text-base text-foreground flex items-center gap-1">
            {friend?.display_name || 'My Partner'}
          </h4>
          {friend?.username && (
            <p className="text-xs text-muted-foreground font-mono">@{friend.username}</p>
          )}
          {friend?.bio && (
            <p className="text-xs text-muted-foreground mt-2 max-w-xs italic font-serif">
              &quot;{friend.bio}&quot;
            </p>
          )}

          {/* Relationship Day Counter Card inside drawer */}
          <div className="w-full mt-3 pt-3 border-t border-border/40">
            {daysTogether !== null ? (
              <div className="flex items-center justify-between px-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-300">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  Day {daysTogether} together
                </span>
                <button
                  onClick={() => {
                    setTempDate(anniversary || '');
                    setIsEditingDate(true);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Edit date
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempDate('');
                  setIsEditingDate(true);
                }}
                className="w-full py-1.5 px-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CalendarHeart className="w-3.5 h-3.5" />
                <span>Set our special anniversary date</span>
              </button>
            )}

            {isEditingDate && (
              <form onSubmit={handleSaveDate} className="mt-2 space-y-2 text-left bg-background/90 p-2.5 rounded-2xl border border-border">
                <label className="text-[11px] font-semibold text-foreground">
                  Choose your special date:
                </label>
                <input
                  type="date"
                  value={tempDate}
                  onChange={e => setTempDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-card border border-input focus:outline-none"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingDate(false)}
                    className="h-6 text-[11px] px-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-6 text-[11px] px-2.5 bg-primary text-primary-foreground"
                  >
                    Save
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/30 w-full justify-center">
            <Lock className="w-3 h-3 text-primary" />
            <span>Private One-to-One Sanctuary</span>
          </div>
        </div>

        {/* Media & Saved Moments Navigation Tabs */}
        <div>
          <div className="flex rounded-2xl bg-muted/80 p-1 text-[11px] font-medium gap-0.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'images'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Photos ({images.length})
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'audio'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Audio ({audioFiles.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'videos'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Video ({videos.length})
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'files'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Files ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 py-1.5 px-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'favorites'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Saved ({savedMoments.length})
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="mt-4">
            {activeTab === 'images' && (
              <div>
                {images.length === 0 ? (
                  <div className="text-center py-8 space-y-1.5">
                    <p className="text-xs font-medium text-foreground">No photos yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Your favorite moments will find a home here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map(img => (
                      <div key={img.id} className="relative aspect-square">
                        <ImagePreview
                          src={img.signedMediaUrl!}
                          filename={img.original_filename}
                          fileSize={img.file_size}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-2">
                {audioFiles.length === 0 ? (
                  <div className="text-center py-8 space-y-1.5">
                    <p className="text-xs font-medium text-foreground">No songs or audio yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Share songs, melodies, or voice recordings.
                    </p>
                  </div>
                ) : (
                  audioFiles.map(audio => (
                    <div
                      key={audio.id}
                      className="p-3 rounded-2xl bg-muted/50 border border-border/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Music className="w-4 h-4 text-violet-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{audio.original_filename || 'Audio track'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatMessageDate(audio.created_at)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={audio.signedMediaUrl!}
                        download={audio.original_filename || 'audio.mp3'}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'videos' && (
              <div className="space-y-2">
                {videos.length === 0 ? (
                  <div className="text-center py-8 space-y-1.5">
                    <p className="text-xs font-medium text-foreground">No videos yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Special videos you share will appear here.
                    </p>
                  </div>
                ) : (
                  videos.map(vid => (
                    <div
                      key={vid.id}
                      className="p-3 rounded-2xl bg-muted/50 border border-border/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Film className="w-4 h-4 text-sky-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{vid.original_filename || 'Video clip'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatMessageDate(vid.created_at)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={vid.signedMediaUrl!}
                        download={vid.original_filename || 'video.mp4'}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="text-center py-8 space-y-1.5">
                    <p className="text-xs font-medium text-foreground">No documents yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Shared PDFs and documents will show up here.
                    </p>
                  </div>
                ) : (
                  documents.map(doc => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-2xl bg-muted/50 border border-border/40 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{doc.original_filename}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {doc.file_size ? formatBytes(doc.file_size) : 'File'} •{' '}
                            {formatMessageDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      {doc.signedMediaUrl && (
                        <a
                          href={doc.signedMediaUrl}
                          download={doc.original_filename || 'document'}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Saved Moments / Little Notes Tab */}
            {activeTab === 'favorites' && (
              <div className="space-y-2">
                {savedMoments.length === 0 ? (
                  <div className="text-center py-8 space-y-1.5">
                    <p className="text-xs font-medium text-foreground">No saved moments yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                      Hover over any special message and click the bookmark icon to save it here forever.
                    </p>
                  </div>
                ) : (
                  savedMoments.map(fav => (
                    <div
                      key={fav.id}
                      className="p-3 rounded-2xl bg-muted/40 border border-border/50 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {fav.sender?.display_name || 'Partner'}
                        </span>
                        <span>{formatMessageDate(fav.created_at)}</span>
                      </div>
                      <p className="text-xs font-serif italic text-foreground whitespace-pre-wrap break-words">
                        {fav.body?.replace(/^\[💌 Note\]\s*/, '') || fav.original_filename || '[Attachment]'}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-3 h-3 fill-current" />
                          Saved with love
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
