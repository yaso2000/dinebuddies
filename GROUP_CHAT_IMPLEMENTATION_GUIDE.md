# تنفيذ الشات الجماعي المدمج - دليل التنفيذ

## ✅ ما تم إنجازه حتى الآن

### 1. إضافة State والImports
تم إضافة:
- `groupChatMessages` state لتخزين الرسائل
- Firestore imports: `collection, addDoc, query, orderBy, onSnapshot, serverTimestamp`

### 2. Real-time Listener
تم إضافة useEffect للاستماع للرسائل من:
```
invitations/{invitationId}/messages
```

### 3. دالة إرسال الرسائل
تم إضافة `handleSendGroupMessage` لإرسال الرسائل

---

## 🔧 الخطوة التالية: إضافة UI الشات

يجب إضافة UI الشات في صفحة `InvitationDetails.jsx` بعد قسم "Pending Requests".

### المكان الصحيح:
بعد السطر الذي يحتوي على:
```javascript
                        )}

                        {/* Group Chat Notice - For Members */}
```

### الكود المطلوب إضافته:

```javascript
                        {/* Group Chat - For Host and Accepted Members */}
                        {(isHost || isAccepted) && (
                            <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
                                <h4 style={{ 
                                    fontSize: '0.9rem', 
                                    marginBottom: '1rem', 
                                    color: 'var(--primary)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px', 
                                    fontWeight: '800' 
                                }}>
                                    💬 {t('group_chat', { defaultValue: 'Group Chat' })}
                                </h4>
                                
                                {/* Messages Container */}
                                <div style={{ 
                                    background: 'var(--bg-card)', 
                                    borderRadius: 'var(--radius-lg)', 
                                    border: '1px solid var(--border-color)',
                                    minHeight: '300px',
                                    maxHeight: '500px',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    {/* Messages List */}
                                    <div style={{ 
                                        flex: 1, 
                                        overflowY: 'auto', 
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '1rem'
                                    }}>
                                        {groupChatMessages.length === 0 ? (
                                            <div style={{ 
                                                textAlign: 'center', 
                                                padding: '3rem 1rem', 
                                                color: 'var(--text-muted)' 
                                            }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>💬</div>
                                                <p style={{ fontSize: '0.9rem' }}>
                                                    {t('no_messages_yet', { defaultValue: 'No messages yet. Start the conversation!' })}
                                                </p>
                                            </div>
                                        ) : (
                                            groupChatMessages.map((msg) => {
                                                const isOwnMessage = msg.senderId === currentUser?.id;
                                                return (
                                                    <div 
                                                        key={msg.id} 
                                                        style={{ 
                                                            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                                                            maxWidth: '75%',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.25rem'
                                                        }}
                                                    >
                                                        {!isOwnMessage && (
                                                            <div style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '0.5rem',
                                                                marginBottom: '0.25rem'
                                                            }}>
                                                                <img 
                                                                    src={msg.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`}
                                                                    alt={msg.senderName}
                                                                    style={{ 
                                                                        width: '24px', 
                                                                        height: '24px', 
                                                                        borderRadius: '50%',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                                <span style={{ 
                                                                    fontSize: '0.75rem', 
                                                                    fontWeight: '600',
                                                                    color: 'var(--text-muted)'
                                                                }}>
                                                                    {msg.senderName}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            background: isOwnMessage 
                                                                ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' 
                                                                : 'var(--bg-input)',
                                                            padding: '0.75rem 1rem',
                                                            borderRadius: isOwnMessage 
                                                                ? '18px 18px 4px 18px' 
                                                                : '18px 18px 18px 4px',
                                                            color: 'white',
                                                            fontSize: '0.95rem',
                                                            wordWrap: 'break-word'
                                                        }}>
                                                            {msg.text}
                                                        </div>
                                                        <span style={{ 
                                                            fontSize: '0.7rem', 
                                                            color: 'var(--text-muted)',
                                                            alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                                                            paddingLeft: isOwnMessage ? '0' : '0.5rem',
                                                            paddingRight: isOwnMessage ? '0.5rem' : '0'
                                                        }}>
                                                            {msg.createdAt?.toDate ? 
                                                                new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                : 'Sending...'
                                                            }
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Message Input */}
                                    <div style={{ 
                                        padding: '1rem', 
                                        borderTop: '1px solid var(--border-color)',
                                        background: 'var(--bg-body)'
                                    }}>
                                        <form onSubmit={handleSendGroupMessage} style={{ display: 'flex', gap: '0.75rem' }}>
                                            <input
                                                type="text"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder={t('type_message', { defaultValue: 'Type a message...' })}
                                                className="input-field"
                                                style={{ 
                                                    borderRadius: 'var(--radius-full)', 
                                                    background: 'var(--bg-input)', 
                                                    flex: 1,
                                                    border: '1px solid var(--border-color)'
                                                }}
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!message.trim()} 
                                                className="btn btn-primary" 
                                                style={{ 
                                                    width: '50px', 
                                                    height: '50px', 
                                                    minWidth: '50px', 
                                                    padding: 0, 
                                                    borderRadius: '50%',
                                                    opacity: message.trim() ? 1 : 0.5
                                                }}
                                            >
                                                <FaPaperPlane />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
```

---

## 📝 ملاحظات

1. **الرسائل تُخزن في**: `invitations/{invitationId}/messages`
2. **Real-time sync**: تلقائي عبر `onSnapshot`
3. **الوصول**: فقط المضيف والأعضاء المقبولين
4. **التصميم**: مدمج في صفحة الدعوة

---

## ⚠️ المشكلة الحالية

لم أتمكن من إضافة UI الشات بسبب مشكلة في العثور على المحتوى الدقيق في الملف.

**الحل**: يمكنك إضافة الكود يدوياً أو دعني أحاول مرة أخرى بطريقة مختلفة.
