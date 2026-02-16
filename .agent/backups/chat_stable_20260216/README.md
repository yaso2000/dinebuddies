This backup was created at 2026-02-16 to preserve the stable state of the Chat and CommunityChatRoom features.
The backup includes key fixes for mobile keyboard stability, header positioning, and message bubble styling.

Files included:
- src/pages/Chat.jsx
- src/pages/Chat.css
- src/pages/CommunityChatRoom.jsx
- src/pages/CommunityChatRoom.css

Key changes captured here:
1. Fixed mobile keyboard disappearing issue by preventing focus loss on Send/Mic buttons (using onPointerDown).
2. Changed header position to `fixed` to prevent it from disappearing during scroll/overscroll.
3. Updated message bubble styling for grouped messages.
4. Added extended emoji picker functionality.
