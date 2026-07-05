import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Send, Image as ImageIcon, FileText, Paperclip,
  Smile, MoreVertical, Mic, Clock, Check, CheckCheck,
  ArrowLeft, Download, ExternalLink, X, Shield, MessageSquare
} from 'lucide-react';
import { uploadAttachment } from '../services/supabase';
import './InternalMessaging.css';

const InternalMessaging = () => {
  const {
    internalMessages, sendInternalMessage, t, formatDate, formatTime,
    showToast, markInternalMessagesRead
  } = useAppContext();
  const { currentUser } = useAuth();

  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullscreenImage, setFullscreenImage] = useState(null);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom + mark messages as read
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Mark messages from the super-admin as read
    if (currentUser) {
      const superAdminId = 'devroot'; // Super-admin user ID
      markInternalMessagesRead(superAdminId);
    }
  }, [internalMessages, currentUser, markInternalMessagesRead]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const success = await sendInternalMessage('devroot', messageInput);
    if (success) setMessageInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let fileData;
      let type = file.type.startsWith('image/') ? 'image' : 'file';

      try {
        // Try Supabase cloud storage first
        fileData = await uploadAttachment(file, 'chat');
      } catch {
        // Fallback: base64 inline
        fileData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      }

      const success = await sendInternalMessage('devroot', fileData, type, file.name);
      if (!success) showToast('Failed to upload file', 'danger');
    } catch (err) {
      showToast('Failed to upload file', 'danger');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          await sendInternalMessage('devroot', base64Audio, 'audio', 'voice_note.webm');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Capture in 1s chunks for better reliability
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showToast("Could not access microphone", "danger");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      // Ensure all tracks are stopped immediately
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const EMOJIS = ['😀', '😂', '😍', '😎', '👍', '🙏', '🔥', '✨', '🙌', '💯', '✅', '⚠️'];

  const filteredMessages = internalMessages.filter(m =>
    m.garageId === currentUser.ownerId &&
    (m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fileName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="internal-msg-root">
      <div className="internal-msg-container">

        {/* Header */}
        <div className="internal-msg-header">
          <div className="support-info">
            <div className="support-avatar">
              <Shield size={24} />
            </div>
            <div>
              <h3>MechPro Platform Support</h3>
              <div className="support-status">
                <div className="status-dot"></div>
                <span>Super-Admin Online</span>
              </div>
            </div>
          </div>
          <div className="header-actions">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="internal-msg-body" ref={scrollRef}>
          {filteredMessages.length === 0 ? (
            <div className="internal-msg-empty">
              <Shield size={48} />
              <h4>Start a conversation with Super-Admin</h4>
              <p>Ask questions about subscription, billing, or technical issues.</p>
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const isMe = msg.senderId === currentUser.id;
              const prevMsg = filteredMessages[idx - 1];
              const showDate = !prevMsg || msg.time.split('T')[0] !== prevMsg.time.split('T')[0];

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="msg-date-separator">
                      <span>{formatDate(msg.time)}</span>
                    </div>
                  )}
                  <div className={`internal-msg-row ${isMe ? 'msg-me' : 'msg-them'}`}>
                    <div className={`msg-bubble ${msg.type === 'image' ? 'msg-bubble-image' : ''}`}>
                      <div className="msg-sender-name">{msg.senderName}</div>

                      {msg.type === 'text' && <div className="msg-text">{msg.text}</div>}

                      {msg.type === 'image' && (
                        <div className="msg-image" onClick={() => setFullscreenImage(msg)}>
                          <img src={msg.fileData} alt="Shared Photo" />
                        </div>
                      )}

                      {msg.type === 'file' && (
                        <div className="msg-file">
                          <div className="file-icon"><FileText size={20} /></div>
                          <div className="file-info">
                            <span className="file-name">{msg.fileName}</span>
                            <a href={msg.fileData} download={msg.fileName} className="file-download">
                              <Download size={16} />
                            </a>
                          </div>
                        </div>
                      )}

                      {msg.type === 'audio' && (
                        <div className="msg-audio">
                          <audio src={msg.fileData} controls />
                        </div>
                      )}

                      <div className="msg-meta">
                        <span className="msg-time">{formatTime(msg.time)}</span>
                        {isMe && (
                          <span className="msg-status">
                            {msg.read ? <CheckCheck size={14} className="seen" /> : <Check size={14} />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="internal-msg-footer">
          <form onSubmit={handleSend} className="input-form">
            <button
              type="button"
              className="action-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Paperclip size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            <div className="input-wrapper">
              <input
                type="text"
                placeholder="Type your message here..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button type="button" className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Smile size={20} />
              </button>

              {showEmojiPicker && (
                <div className="emoji-picker">
                  {EMOJIS.map(e => (
                    <span key={e} onClick={() => {
                      setMessageInput(prev => prev + e);
                      setShowEmojiPicker(false);
                    }}>{e}</span>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="send-btn" disabled={!messageInput.trim() && !isRecording || isUploading}>
              {messageInput.trim() ? <Send size={20} /> : (
                isRecording ? (
                  <div className="stop-btn" onClick={stopRecording}>
                    <div className="stop-icon"></div>
                  </div>
                ) : (
                  <div className="mic-btn" onClick={startRecording}>
                    <Mic size={20} className="mic-icon" /> 
                  </div>
                )
              )}
            </button>
          </form>
          {isRecording && (
            <div className="recording-status">
              <div className="recording-dot"></div>
              <span>Recording Voice... {formatDuration(recordingTime)}</span>
              <button className="cancel-record" onClick={() => {
                if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.stop();
                  if (mediaRecorderRef.current.stream) {
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                  }
                }
                setIsRecording(false);
                clearInterval(timerRef.current);
                audioChunksRef.current = []; // Wipe it so onstop skip sending
              }}>Cancel</button>
            </div>
          )}
          {isUploading && <div className="upload-progress">Uploading file...</div>}
        </div>

      </div>

      {/* Fullscreen Image Preview */}
      {fullscreenImage && (
        <div className="msg-lightbox" onClick={() => setFullscreenImage(null)}>
          <button className="lightbox-close" onClick={() => setFullscreenImage(null)}>
            <X size={32} />
          </button>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={fullscreenImage.fileData} alt="Fullscreen View" />
            <div className="lightbox-meta">
              <a href={fullscreenImage.fileData} download={fullscreenImage.fileName}>
                <Download size={20} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalMessaging;
