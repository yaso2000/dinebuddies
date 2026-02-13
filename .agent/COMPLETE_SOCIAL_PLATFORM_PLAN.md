# 🚀 DineBuddies Social Platform - Complete Implementation Plan

## 📋 **Overview:**

### **Two Main Features:**

1. **Instagram-Style Feed** → Social content platform
2. **Enhanced Invitations** → Video support + flexible media

---

# 🎯 PART 1: INSTAGRAM-STYLE FEED

## 📱 **Vision:**

Transform Feed into full social platform where everyone can share dining experiences.

---

## 🏗️ **Architecture:**

### **1. Data Model**

#### **posts Collection:**
```javascript
{
  id: "auto",
  
  // Author
  userId: "user123 OR partner123",
  userName: "Ahmed",
  userAvatar: "https://...",
  userType: "user" | "partner",
  isVerified: false | true,        // Partners only
  
  // Content
  type: "image" | "video",
  image: "https://...",             // If type = image
  video: "https://...",             // If type = video
  videoThumbnail: "https://...",    // Auto-generated
  videoDuration: 45,                // seconds
  caption: "Amazing dinner at...",
  
  // Engagement
  likes: ["userId1", "userId2"],
  comments: [],                     // Subcollection
  shares: [],
  saves: [],
  
  // Optional
  location: {
    name: "KFC Restaurant",
    lat: 24.7136,
    lng: 46.6753
  },
  tags: ["userId3"],                // Tagged users
  hashtags: ["#Riyadh", "#Food"],
  
  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp,
  
  // Status
  status: "active" | "archived" | "reported"
}
```

#### **stories Collection:**
```javascript
{
  id: "auto",
  
  // Author
  userId: "...",
  userName: "Ahmed",
  userAvatar: "url",
  userType: "user" | "partner",
  
  // Content
  type: "image" | "text" | "video",
  
  image: "url",                     // If image
  
  text: "Amazing night!",           // If text
  backgroundColor: "#8b5cf6",
  
  video: "url",                     // If video
  videoThumbnail: "url",
  videoDuration: 15,
  
  // Engagement
  views: ["userId1", "userId2"],
  likes: ["userId3"],
  
  // Timestamps
  createdAt: Timestamp,
  expiresAt: Date,                  // createdAt + 24h
  
  // Status
  isActive: true
}
```

#### **comments Subcollection:**
```javascript
posts/{postId}/comments/{commentId}
{
  userId: "...",
  userName: "Sara",
  userAvatar: "url",
  text: "Looks delicious!",
  likes: [],
  createdAt: Timestamp
}
```

#### **users Collection (Updates):**
```javascript
{
  // Existing fields...
  
  // New social fields:
  following: ["userId1", "userId2"],
  followers: ["userId3", "userId4"],
  bio: "Food lover 🍕",
  website: "https://...",
  
  // Stats
  postsCount: 42,
  followersCount: 120,
  followingCount: 89
}
```

---

## 📂 **File Structure:**

```
src/
├── components/
│   ├── Feed/
│   │   ├── PostCard.jsx              ← Instagram-style post
│   │   ├── CreatePost.jsx            ← Create post modal
│   │   ├── CommentSection.jsx        ← Comments UI
│   │   ├── PostActions.jsx           ← Like, comment, share
│   │   └── MediaUpload.jsx           ← Image/Video upload (shared)
│   │
│   ├── Stories/
│   │   ├── StoriesBar.jsx            ✅ (update for all users)
│   │   ├── StoryCircle.jsx           ✅ (update styling)
│   │   ├── StoryViewer.jsx           ✅ (add video support)
│   │   └── CreateStory.jsx           ✅ (add video, open to all)
│   │
│   ├── Profile/
│   │   ├── UserProfile.jsx           ← Profile page
│   │   ├── ProfileHeader.jsx         ← Stats, follow button
│   │   ├── PostsGrid.jsx             ← 3-column grid
│   │   └── EditProfile.jsx           ← Edit bio, avatar
│   │
│   └── Shared/
│       ├── VideoPlayer.jsx           ← Reusable video player
│       ├── VideoRecorder.jsx         ← In-app recording
│       ├── VideoCompressor.jsx       ← Client-side compression
│       └── FollowButton.jsx          ← Follow/Unfollow
│
├── pages/
│   ├── Feed.jsx                      ← Main feed page
│   ├── Profile.jsx                   ← User/Partner profile
│   └── Explore.jsx                   ← Discover (future)
│
├── hooks/
│   ├── useFeed.js                    ← Feed data & logic
│   ├── useStories.js                 ← Stories data
│   ├── useFollow.js                  ← Follow/unfollow
│   └── useVideoUpload.js             ← Video handling
│
└── utils/
    ├── videoCompression.js           ← FFmpeg wrapper
    ├── thumbnailGenerator.js         ← Extract first frame
    └── feedAlgorithm.js              ← Post ranking
```

---

## 🎨 **Components Design:**

### **1. PostCard Component:**

```jsx
import React, { useState } from 'react';
import { FaHeart, FaComment, FaShare, FaBookmark, FaEllipsisH } from 'react-icons/fa';
import VideoPlayer from '../Shared/VideoPlayer';
import CommentSection from './CommentSection';

const PostCard = ({ post, currentUser }) => {
  const [liked, setLiked] = useState(post.likes.includes(currentUser.uid));
  const [showComments, setShowComments] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLike = async () => {
    setLiked(!liked);
    // Update Firestore
  };

  const handleDoubleClick = (e) => {
    if (e.detail === 2) {
      handleLike();
      // Show heart animation
    }
  };

  return (
    <div className="post-card">
      {/* Header */}
      <div className="post-header">
        <img src={post.userAvatar} alt={post.userName} className="avatar" />
        <div className="user-info">
          <h4>
            {post.userName} 
            {post.isVerified && <span className="verified">✓</span>}
          </h4>
          {post.location && <p className="location">{post.location.name}</p>}
        </div>
        <button className="menu-btn">
          <FaEllipsisH />
        </button>
      </div>

      {/* Media */}
      <div className="post-media" onClick={handleDoubleClick}>
        {post.type === 'video' ? (
          <VideoPlayer
            videoUrl={post.video}
            thumbnail={post.videoThumbnail}
            autoPlay={false}
          />
        ) : (
          <img src={post.image} alt="Post" />
        )}
      </div>

      {/* Actions */}
      <div className="post-actions">
        <div className="left-actions">
          <button 
            className={`action-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <FaHeart />
          </button>
          <button 
            className="action-btn"
            onClick={() => setShowComments(!showComments)}
          >
            <FaComment />
          </button>
          <button className="action-btn">
            <FaShare />
          </button>
        </div>
        <button 
          className={`action-btn ${saved ? 'saved' : ''}`}
          onClick={() => setSaved(!saved)}
        >
          <FaBookmark />
        </button>
      </div>

      {/* Likes */}
      <div className="post-likes">
        {post.likes.length} likes
      </div>

      {/* Caption */}
      <div className="post-caption">
        <strong>{post.userName}</strong> {post.caption}
      </div>

      {/* Comments Preview */}
      {post.comments.length > 0 && (
        <button 
          className="view-comments"
          onClick={() => setShowComments(true)}
        >
          View all {post.comments.length} comments
        </button>
      )}

      {/* Timestamp */}
      <p className="post-time">{formatTimeAgo(post.createdAt)}</p>

      {/* Full Comments */}
      {showComments && (
        <CommentSection 
          postId={post.id}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  );
};

export default PostCard;
```

### **CSS Styling:**

```css
.post-card {
  background: white;
  border: 1px solid #dbdbdb;
  border-radius: 8px;
  margin-bottom: 24px;
  max-width: 614px;
}

.post-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
}

.post-header .avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.user-info {
  flex: 1;
}

.user-info h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.verified {
  color: #3897f0;
  font-size: 12px;
}

.location {
  font-size: 12px;
  color: #8e8e8e;
  margin: 2px 0 0 0;
}

.post-media {
  width: 100%;
  max-height: 614px;
  overflow: hidden;
  background: #000;
}

.post-media img,
.post-media video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.post-actions {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
}

.left-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 24px;
  color: #262626;
  transition: all 0.2s;
}

.action-btn:hover {
  color: #8e8e8e;
}

.action-btn.liked {
  color: #ed4956;
  animation: likeAnimation 0.3s;
}

@keyframes likeAnimation {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.post-likes {
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.post-caption {
  padding: 0 16px;
  margin-top: 8px;
  font-size: 14px;
}

.post-caption strong {
  margin-right: 4px;
}

.view-comments {
  background: none;
  border: none;
  padding: 8px 16px;
  color: #8e8e8e;
  font-size: 14px;
  cursor: pointer;
}

.post-time {
  padding: 0 16px 12px;
  font-size: 10px;
  color: #8e8e8e;
  text-transform: uppercase;
  margin: 0;
}
```

---

### **2. CreatePost Component:**

```jsx
import React, { useState } from 'react';
import { FaImage, FaVideo, FaTimes } from 'react-icons/fa';
import MediaUpload from '../Shared/MediaUpload';
import { uploadPost } from '../../services/feedService';

const CreatePost = ({ isOpen, onClose, currentUser }) => {
  const [mediaType, setMediaType] = useState(null); // 'image' | 'video'
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleMediaSelect = (file, preview) => {
    setMediaFile(file);
    setMediaPreview(preview);
  };

  const handlePost = async () => {
    if (!mediaFile) {
      alert('Please select an image or video');
      return;
    }

    setUploading(true);
    try {
      await uploadPost({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userAvatar: currentUser.photoURL,
        userType: currentUser.accountType || 'user',
        type: mediaType,
        mediaFile,
        caption,
        location
      });

      // Reset and close
      setMediaFile(null);
      setMediaPreview(null);
      setCaption('');
      setLocation(null);
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-post-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <button onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <h3>Create New Post</h3>
          <button 
            onClick={handlePost}
            disabled={!mediaFile || uploading}
            className="post-btn"
          >
            {uploading ? 'Posting...' : 'Share'}
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Media Selection */}
          {!mediaFile ? (
            <div className="media-selection">
              <h4>Select Media</h4>
              <div className="media-buttons">
                <button onClick={() => setMediaType('image')}>
                  <FaImage size={48} />
                  <span>Photo</span>
                </button>
                <button onClick={() => setMediaType('video')}>
                  <FaVideo size={48} />
                  <span>Video</span>
                </button>
              </div>

              {mediaType && (
                <MediaUpload
                  type={mediaType}
                  maxDuration={mediaType === 'video' ? 60 : null}
                  onMediaSelect={handleMediaSelect}
                />
              )}
            </div>
          ) : (
            <>
              {/* Media Preview */}
              <div className="media-preview">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} controls />
                ) : (
                  <img src={mediaPreview} alt="Preview" />
                )}
                <button 
                  className="remove-media"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                >
                  <FaTimes />
                </button>
              </div>

              {/* Caption */}
              <div className="caption-section">
                <div className="user-info">
                  <img src={currentUser.photoURL} alt={currentUser.displayName} />
                  <strong>{currentUser.displayName}</strong>
                </div>
                <textarea
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  maxLength={2200}
                />
                <div className="char-count">{caption.length}/2200</div>
              </div>

              {/* Optional: Location */}
              <div className="location-section">
                <button onClick={() => {/* Add location */}}>
                  Add Location
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePost;
```

---

### **3. Feed Page:**

```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import StoriesBar from '../../components/Stories/StoriesBar';
import CreatePost from '../../components/Feed/CreatePost';
import PostCard from '../../components/Feed/PostCard';
import { useFeed } from '../../hooks/useFeed';
import { FaPlus } from 'react-icons/fa';

const Feed = () => {
  const { currentUser } = useAuth();
  const { posts, loading, loadMore, hasMore } = useFeed();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);

  return (
    <div className="feed-page">
      {/* Header */}
      <header className="feed-header">
        <h1>Feed</h1>
        <button 
          className="create-btn"
          onClick={() => setShowCreatePost(true)}
        >
          <FaPlus />
        </button>
      </header>

      {/* Stories Bar */}
      <StoriesBar 
        onStoryClick={setViewingStory}
        currentUser={currentUser}
      />

      {/* Posts Feed */}
      <div className="posts-container">
        {loading && posts.length === 0 ? (
          <div className="loading">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <p>No posts yet. Start sharing!</p>
            <button onClick={() => setShowCreatePost(true)}>
              Create Your First Post
            </button>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <PostCard 
                key={post.id}
                post={post}
                currentUser={currentUser}
              />
            ))}

            {hasMore && (
              <button 
                className="load-more"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePost
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        currentUser={currentUser}
      />

      {/* Story Viewer */}
      {viewingStory && (
        <StoryViewer
          partnerStories={viewingStory}
          onClose={() => setViewingStory(null)}
        />
      )}
    </div>
  );
};

export default Feed;
```

---

## 🛠️ **Shared Components:**

### **MediaUpload Component:**

```jsx
import React, { useState, useRef } from 'react';
import { compressVideo } from '../../utils/videoCompression';
import { generateThumbnail } from '../../utils/thumbnailGenerator';

const MediaUpload = ({ type, maxDuration, onMediaSelect }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'video') {
      // Check duration
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      
      video.onloadedmetadata = async () => {
        if (maxDuration && video.duration > maxDuration) {
          alert(`Video must be ${maxDuration} seconds or less`);
          return;
        }

        // Compress video
        setUploading(true);
        try {
          const compressed = await compressVideo(file, (progress) => {
            setProgress(progress);
          });
          
          const preview = URL.createObjectURL(compressed);
          onMediaSelect(compressed, preview);
        } catch (error) {
          console.error('Error compressing video:', error);
          alert('Failed to process video');
        } finally {
          setUploading(false);
          setProgress(0);
        }
      };
    } else {
      // Image
      const preview = URL.createObjectURL(file);
      onMediaSelect(file, preview);
    }
  };

  return (
    <div className="media-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept={type === 'video' ? 'video/*' : 'image/*'}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <button 
        className="upload-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? `Processing... ${progress}%` : `Select ${type}`}
      </button>

      {maxDuration && (
        <p className="duration-limit">Max duration: {maxDuration} seconds</p>
      )}
    </div>
  );
};

export default MediaUpload;
```

---

# 🎯 PART 2: ENHANCED INVITATIONS

## 📋 **Requirements:**

User can choose ONE of these options:
1. ✅ Custom image (from device)
2. ✅ Restaurant image (from restaurant profile)
3. ✅ Custom video (30 seconds max)

---

## 🏗️ **Data Model Update:**

### **invitations Collection:**

```javascript
{
  id: "auto",
  
  // Host
  hostId: "...",
  hostName: "Ahmed",
  hostAvatar: "url",
  
  // Restaurant
  restaurantId: "...",
  restaurantName: "Italian Restaurant",
  restaurantImage: "url",           // From restaurant profile
  location: {
    address: "...",
    lat: 24.7136,
    lng: 46.6753
  },
  
  // Date & Details
  dateTime: Timestamp,
  maxGuests: 4,
  budget: "$$",
  description: "Join me for...",
  
  // Media Options ← NEW
  mediaSource: "custom_image" | "restaurant_image" | "custom_video",
  
  customImage: "url",               // If mediaSource = custom_image
  restaurantImage: "url",           // If mediaSource = restaurant_image  
  customVideo: "url",               // If mediaSource = custom_video
  videoThumbnail: "url",            // Auto-generated
  videoDuration: 30,
  
  // Participants
  going: [],
  interested: [],
  declined: [],
  
  // Status
  status: "active" | "completed" | "cancelled",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 📂 **File Structure:**

```
src/
├── components/
│   └── Invitations/
│       ├── InvitationCard.jsx        ✅ (update for video)
│       ├── InvitationDetails.jsx     ✅ (update for video)
│       └── MediaSelector.jsx         ← NEW: Select media source
│
├── pages/
│   ├── CreateInvitation.jsx          ✅ (add media selector)
│   └── InvitationDetails.jsx         ✅ (play video)
│
└── hooks/
    └── useInvitationMedia.js         ← Media handling logic
```

---

## 🎨 **Components:**

### **1. MediaSelector Component:**

```jsx
import React, { useState } from 'react';
import { FaImage, FaVideo, FaStore } from 'react-icons/fa';
import MediaUpload from '../Shared/MediaUpload';

const MediaSelector = ({ restaurant, onMediaSelect }) => {
  const [source, setSource] = useState(null);
  const [customMedia, setCustomMedia] = useState(null);

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    setCustomMedia(null);
    
    if (newSource === 'restaurant_image') {
      onMediaSelect({
        source: 'restaurant_image',
        url: restaurant.image
      });
    }
  };

  const handleCustomMedia = (file, preview, type) => {
    setCustomMedia({ file, preview, type });
    onMediaSelect({
      source: type === 'video' ? 'custom_video' : 'custom_image',
      file,
      preview
    });
  };

  return (
    <div className="media-selector">
      <h4>Choose Media for Invitation</h4>
      
      <div className="source-options">
        {/* Restaurant Image */}
        <button
          className={`source-option ${source === 'restaurant_image' ? 'active' : ''}`}
          onClick={() => handleSourceChange('restaurant_image')}
        >
          <FaStore size={32} />
          <span>Restaurant Photo</span>
          {source === 'restaurant_image' && (
            <div className="preview">
              <img src={restaurant.image} alt={restaurant.name} />
            </div>
          )}
        </button>

        {/* Custom Image */}
        <button
          className={`source-option ${source === 'custom_image' ? 'active' : ''}`}
          onClick={() => handleSourceChange('custom_image')}
        >
          <FaImage size={32} />
          <span>Your Photo</span>
          {source === 'custom_image' && (
            <MediaUpload
              type="image"
              onMediaSelect={(file, preview) => 
                handleCustomMedia(file, preview, 'image')
              }
            />
          )}
        </button>

        {/* Custom Video */}
        <button
          className={`source-option ${source === 'custom_video' ? 'active' : ''}`}
          onClick={() => handleSourceChange('custom_video')}
        >
          <FaVideo size={32} />
          <span>Your Video</span>
          <small>(30 seconds max)</small>
          {source === 'custom_video' && (
            <MediaUpload
              type="video"
              maxDuration={30}
              onMediaSelect={(file, preview) => 
                handleCustomMedia(file, preview, 'video')
              }
            />
          )}
        </button>
      </div>

      {/* Preview */}
      {customMedia && (
        <div className="media-preview">
          <h5>Preview:</h5>
          {customMedia.type === 'video' ? (
            <video src={customMedia.preview} controls />
          ) : (
            <img src={customMedia.preview} alt="Preview" />
          )}
        </div>
      )}
    </div>
  );
};

export default MediaSelector;
```

---

### **2. Updated CreateInvitation:**

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RestaurantSelect from '../components/RestaurantSelect';
import MediaSelector from '../components/Invitations/MediaSelector';
import DateTimePicker from '../components/DateTimePicker';
import { createInvitation } from '../services/invitationService';

const CreateInvitation = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState(null);
  const [media, setMedia] = useState(null);
  const [dateTime, setDateTime] = useState(null);
  const [maxGuests, setMaxGuests] = useState(4);
  const [budget, setBudget] = useState('$$');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!restaurant || !media || !dateTime) {
      alert('Please fill all required fields');
      return;
    }

    setCreating(true);
    try {
      await createInvitation({
        hostId: currentUser.uid,
        hostName: currentUser.displayName,
        hostAvatar: currentUser.photoURL,
        restaurant,
        media,
        dateTime,
        maxGuests,
        budget,
        description
      });

      navigate('/');
    } catch (error) {
      console.error('Error creating invitation:', error);
      alert('Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-invitation-page">
      <header className="page-header">
        <button onClick={() => navigate(-1)}>Cancel</button>
        <h2>Create Invitation</h2>
        <button 
          onClick={handleCreate}
          disabled={!restaurant || !media || !dateTime || creating}
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </header>

      <div className="form-sections">
        {/* 1. Select Restaurant */}
        <section className="form-section">
          <h3>1. Select Restaurant</h3>
          <RestaurantSelect
            value={restaurant}
            onChange={setRestaurant}
          />
        </section>

        {/* 2. Choose Media (only if restaurant selected) */}
        {restaurant && (
          <section className="form-section">
            <h3>2. Choose Media</h3>
            <MediaSelector
              restaurant={restaurant}
              onMediaSelect={setMedia}
            />
          </section>
        )}

        {/* 3. Date & Time */}
        <section className="form-section">
          <h3>3. Date & Time</h3>
          <DateTimePicker
            value={dateTime}
            onChange={setDateTime}
          />
        </section>

        {/* 4. Details */}
        <section className="form-section">
          <h3>4. Details</h3>
          
          <label>
            Max Guests:
            <input
              type="number"
              min="2"
              max="20"
              value={maxGuests}
              onChange={e => setMaxGuests(parseInt(e.target.value))}
            />
          </label>

          <label>
            Budget:
            <select value={budget} onChange={e => setBudget(e.target.value)}>
              <option value="$">$ (Budget)</option>
              <option value="$$">$$ (Moderate)</option>
              <option value="$$$">$$$ (Expensive)</option>
            </select>
          </label>

          <label>
            Description:
            <textarea
              placeholder="Tell others about this dining experience..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
            />
            <small>{description.length}/500</small>
          </label>
        </section>
      </div>
    </div>
  );
};

export default CreateInvitation;
```

---

### **3. Updated InvitationCard:**

```jsx
import React, { useState } from 'react';
import { FaMapMarkerAlt, FaClock, FaUsers, FaDollarSign, FaPlay } from 'react-icons/fa';
import VideoPlayer from '../Shared/VideoPlayer';

const InvitationCard = ({ invitation, onClick }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const getMediaComponent = () => {
    switch (invitation.mediaSource) {
      case 'custom_video':
        return (
          <div className="video-container">
            {!isPlaying ? (
              <div 
                className="video-thumbnail"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(true);
                }}
              >
                <img src={invitation.videoThumbnail} alt={invitation.restaurantName} />
                <div className="play-overlay">
                  <FaPlay size={48} />
                </div>
                <div className="duration">{invitation.videoDuration}s</div>
              </div>
            ) : (
              <VideoPlayer
                videoUrl={invitation.customVideo}
                onEnded={() => setIsPlaying(false)}
              />
            )}
          </div>
        );
      
      case 'custom_image':
        return <img src={invitation.customImage} alt={invitation.restaurantName} />;
      
      case 'restaurant_image':
      default:
        return <img src={invitation.restaurantImage} alt={invitation.restaurantName} />;
    }
  };

  return (
    <div className="invitation-card" onClick={onClick}>
      {/* Media */}
      <div className="card-media">
        {getMediaComponent()}
      </div>

      {/* Details */}
      <div className="card-content">
        <h3>{invitation.restaurantName}</h3>
        
        <div className="host-info">
          <img src={invitation.hostAvatar} alt={invitation.hostName} />
          <span>{invitation.hostName}</span>
        </div>

        <div className="invitation-details">
          <div className="detail">
            <FaClock />
            <span>{formatDateTime(invitation.dateTime)}</span>
          </div>
          
          <div className="detail">
            <FaUsers />
            <span>{invitation.going.length}/{invitation.maxGuests} going</span>
          </div>
          
          <div className="detail">
            <FaDollarSign />
            <span>{invitation.budget}</span>
          </div>
        </div>

        {invitation.description && (
          <p className="description">{invitation.description}</p>
        )}

        <button className="view-details-btn">
          View Details
        </button>
      </div>
    </div>
  );
};

export default InvitationCard;
```

---

## 🛠️ **Services:**

### **invitationService.js:**

```javascript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { generateThumbnail } from '../utils/thumbnailGenerator';
import { compressVideo } from '../utils/videoCompression';

export const createInvitation = async ({
  hostId,
  hostName,
  hostAvatar,
  restaurant,
  media,
  dateTime,
  maxGuests,
  budget,
  description
}) => {
  try {
    let mediaData = {};

    // Handle different media sources
    switch (media.source) {
      case 'restaurant_image':
        mediaData = {
          mediaSource: 'restaurant_image',
          restaurantImage: media.url
        };
        break;

      case 'custom_image':
        // Upload custom image
        const imageUrl = await uploadMedia(media.file, hostId, 'image');
        mediaData = {
          mediaSource: 'custom_image',
          customImage: imageUrl
        };
        break;

      case 'custom_video':
        // Compress video
        const compressedVideo = await compressVideo(media.file);
        
        // Upload video
        const videoUrl = await uploadMedia(compressedVideo, hostId, 'video');
        
        // Generate and upload thumbnail
        const thumbnail = await generateThumbnail(media.file);
        const thumbnailUrl = await uploadMedia(thumbnail, hostId, 'thumbnail');
        
        // Get duration
        const duration = await getVideoDuration(media.file);
        
        mediaData = {
          mediaSource: 'custom_video',
          customVideo: videoUrl,
          videoThumbnail: thumbnailUrl,
          videoDuration: Math.round(duration)
        };
        break;
    }

    // Create invitation
    const invitation = {
      hostId,
      hostName,
      hostAvatar,
      
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantImage: restaurant.image,
      location: restaurant.location,
      
      dateTime,
      maxGuests,
      budget,
      description,
      
      ...mediaData,
      
      going: [hostId],
      interested: [],
      declined: [],
      
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'invitations'), invitation);
    return docRef.id;
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw error;
  }
};

const uploadMedia = async (file, userId, type) => {
  const extension = type === 'video' ? 'mp4' : type === 'thumbnail' ? 'jpg' : 'jpg';
  const path = `invitations/${userId}/${Date.now()}_${type}.${extension}`;
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

const getVideoDuration = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      resolve(video.duration);
    };
  });
};
```

---

## ⏰ **Implementation Timeline:**

### **Week 1: Foundation & Feed Core**
- [ ] Day 1-2: Data model setup + Firebase config
- [ ] Day 3-4: MediaUpload + VideoCompressor components
- [ ] Day 5-7: PostCard + CreatePost components

### **Week 2: Feed Features**
- [ ] Day 8-9: Feed page + infinite scroll
- [ ] Day 10-11: Comments system
- [ ] Day 12-14: Stories (update for video + all users)

### **Week 3: Invitations Enhancement**
- [ ] Day 15-16: MediaSelector component
- [ ] Day 17-18: Update CreateInvitation
- [ ] Day 19-21: Update InvitationCard + Details

### **Week 4: Polish & Testing**
- [ ] Day 22-23: Following/Followers system
- [ ] Day 24-25: Animations + UX polish
- [ ] Day 26-28: Testing + bug fixes

---

## 📊 **Success Metrics:**

- ✅ Users can create posts (image/video)
- ✅ Users can create stories (image/text/video)
- ✅ Feed shows all content (users + partners)
- ✅ Comments work
- ✅ Likes work
- ✅ Invitations support 3 media types
- ✅ Video compression works
- ✅ Auto-play works
- ✅ Performance is good

---

## 💰 **Cost Estimate:**

### **Firebase Costs (1000 active users):**

```
Storage:
- Feed videos: ~20GB
- Story videos: ~10GB (24h expiry)
- Invitation videos: ~5GB
Total: ~35GB/month = ~$0.90/month

Bandwidth:
- ~100GB/month = ~$12/month

Firestore:
- Reads: ~1M/month = ~$0.36
- Writes: ~100k/month = ~$0.18

Total: ~$15/month for 1000 users
```

Very affordable! ✅

---

## 🎊 **Ready to Start!**

This is the complete plan. Want me to start implementing? 🚀

**Phase 1 (Week 1):** Foundation + Feed Core components
