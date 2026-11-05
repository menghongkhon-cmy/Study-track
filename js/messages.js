import { escapeHtml } from "./storage.js";
import { iconMarkup } from "./icons.js";

function messageTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?"":date.toLocaleString(document.documentElement.lang === "km" ? "km-KH" : undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}

export function renderMessages(){
  return `<div class="page-heading"><div><div class="eyebrow">YOUR PRIVATE INBOX</div><h1>Messages</h1><p>Find a StudyTrack account by email and start a private chat.</p></div></div>
    <section class="panel people-search-panel"><form id="people-search-form"><label for="people-email">Start a chat by email</label><div class="people-search-row"><input class="field" id="people-email" type="email" name="email" maxlength="254" required placeholder="person@example.com"><button class="btn btn-primary" type="submit">Find person <span>→</span></button></div><span class="help-text">The person needs a StudyTrack account. This creates an in-app chat; it does not send external email.</span><div id="people-search-result" aria-live="polite"></div></form></section>
    <div class="messages-layout"><section class="panel direct-thread-panel"><div class="direct-panel-heading"><div><h2 class="panel-title">Your conversations</h2><p class="panel-subtitle">Private messages with other accounts</p></div><button class="icon-btn" type="button" data-action="refresh-direct-messages" title="Refresh conversations">↻</button></div><div id="direct-thread-list"><div class="chat-empty">Loading conversations…</div></div></section><section class="panel direct-conversation-panel" id="direct-conversation-panel"><div class="direct-empty-state"><span class="empty-icon">✉</span><b>Choose a conversation</b><p>Search for someone's exact email address to start a chat.</p></div></section></div>
    <p class="direct-privacy-note">Only the two people in a direct chat can read its messages. Admin activity records show that a message was sent, not its contents.</p>`;
}

export function renderDirectThreads(threads=[],activeId="",activePeer=null){
  if(!threads.length)return `<div class="direct-thread-empty"><span>✦</span><b>No messages yet</b><small>Find someone by email to begin.</small></div>`;
  return `<div class="direct-thread-list">${threads.map(thread=>{const peer=thread.peer_id===activePeer?.id?activePeer:null;return `<button type="button" class="direct-thread ${thread.peer_id===activeId?"active":""}" data-action="open-direct-chat" data-id="${escapeHtml(thread.peer_id)}">${profileAvatar(peer?.name||thread.peer_name,peer?.photo,peer?.avatar)}<span class="direct-thread-copy"><b>${escapeHtml(thread.peer_name)}</b><small>${escapeHtml(thread.last_message||"Start a conversation")}</small></span><span class="direct-thread-time">${messageTime(thread.created_at)}</span></button>`;}).join("")}</div>`;
}

export function renderDirectConversation(peer,messages=[],userId=""){
  const body=renderDirectMessageFeed(messages,userId);
  const emojis=["😀","😂","🥰","😊","😎","😭","👍","👎","👏","🙏","💪","❤️","💜","🎉","✨","🔥","✅","🤔","😴","📚"];
  const emojiPicker=emojis.map(emoji=>`<button type="button" data-action="insert-chat-emoji" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`).join("");
  return `<header class="direct-conversation-head"><button type="button" class="direct-person-link" data-action="view-profile" data-id="${escapeHtml(peer.id)}" aria-label="View ${escapeHtml(peer.name)}'s profile">${profileAvatar(peer.name,peer.photo,peer.avatar,"large")}<span><b>${escapeHtml(peer.name)}</b><small>${escapeHtml(peer.role||"StudyTrack member")} · View profile</small></span></button><span class="chat-privacy-tag">Private chat</span></header><div class="direct-message-feed" id="direct-message-feed" aria-live="polite">${body}</div><form class="direct-compose" id="direct-chat-form" data-peer-id="${escapeHtml(peer.id)}"><textarea name="body" rows="2" maxlength="2000" placeholder="Write a message…" aria-label="Write a private message"></textarea><div class="direct-attachment-preview" id="direct-chat-attachment-preview" aria-live="polite"></div><div class="direct-compose-tools"><button class="direct-compose-tool" type="button" data-action="choose-chat-file" aria-label="Attach a file or picture">${iconMarkup("paperclip")} <span>File or photo</span></button><input id="direct-chat-file" class="hidden" type="file" aria-label="Choose a chat file or picture"><button class="direct-compose-tool" type="button" data-action="toggle-chat-emoji" aria-label="Choose an emoji">${iconMarkup("smile")} <span>Emoji</span></button><div class="chat-emoji-picker" id="direct-chat-emoji-picker" hidden>${emojiPicker}</div></div><div class="direct-compose-foot"><small>Only you and ${escapeHtml(peer.name)} can read these messages · Files up to 8 MB</small><button class="btn btn-primary btn-small" type="submit">Send <span>↑</span></button></div></form>`;
}

export function renderDirectMessageFeed(messages=[],userId=""){
  if(!messages.length)return `<div class="chat-empty"><span class="empty-icon">✦</span><b>Say hello</b><p>Your messages here are private to this conversation.</p></div>`;
  return messages.map(message=>`<article class="chat-message ${message.sender_id===userId?"mine":""}"><div class="chat-message-meta">${message.sender_id===userId?"You":escapeHtml(message.sender_name)} <span>· ${messageTime(message.created_at)}</span></div>${message.body?`<p>${escapeHtml(message.body).replace(/\n/g,"<br>")}</p>`:""}${renderDirectAttachment(message)}</article>`).join("");
}

function renderDirectAttachment(message){
  if(!message.attachment_name||!Number.isInteger(Number(message.id)))return "";
  const url=`/api/messages/${Number(message.id)}/attachment`,type=String(message.attachment_type||""),image=["image/png","image/jpeg","image/gif","image/webp"].includes(type);
  const size=Number(message.attachment_size)||0,sizeLabel=size<1024?`${size} B`:size<1048576?`${(size/1024).toFixed(1)} KB`:`${(size/1048576).toFixed(1)} MB`;
  return `<div class="direct-message-attachment">${image?`<a class="direct-attachment-image" href="${url}" download="${escapeHtml(message.attachment_name)}"><img src="${url}?view=1" alt="${escapeHtml(message.attachment_name)}" loading="lazy"></a>`:`<span class="direct-attachment-file-icon">${iconMarkup("file")}</span>`}<span class="direct-attachment-file-info"><b title="${escapeHtml(message.attachment_name)}">${escapeHtml(message.attachment_name)}</b><small>${sizeLabel}</small></span><a class="direct-attachment-download" href="${url}" download="${escapeHtml(message.attachment_name)}" aria-label="Download ${escapeHtml(message.attachment_name)}">${iconMarkup("download")}</a></div>`;
}

export function renderPersonSearch(person){
  if(!person)return `<div class="people-search-message empty">No active account matched that email. Check the spelling and try again.</div>`;
  return `<div class="people-search-result">${profileAvatar(person.name,person.photo,person.avatar)}<span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.role)}</small></span><button type="button" class="btn btn-small btn-soft" data-action="start-direct-chat" data-id="${escapeHtml(person.id)}">Open chat <span>→</span></button><button type="button" class="text-action" data-action="view-profile" data-id="${escapeHtml(person.id)}">Profile</button></div>`;
}

function profileAvatar(name,photo,avatar="",size=""){
  const image=typeof photo==="string"&&photo.length<=850000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)?photo:"";
  const initials=String(avatar||name||"S").trim().slice(0,2).toUpperCase()||"S";
  return `<span class="direct-avatar ${size} ${image?"has-photo":""}">${image?`<img src="${escapeHtml(image)}" alt="">`:escapeHtml(initials)}</span>`;
}
