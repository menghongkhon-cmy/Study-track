import { escapeHtml } from "./storage.js";

function messageTime(value){const date=new Date(value);return Number.isNaN(date.getTime())?"":date.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}

export function renderMessages(){
  return `<div class="page-heading"><div><div class="eyebrow">YOUR PRIVATE INBOX</div><h1>Messages</h1><p>Find a StudyTrack account by email and start a private chat.</p></div></div>
    <section class="panel people-search-panel"><form id="people-search-form"><label for="people-email">Start a chat by email</label><div class="people-search-row"><input class="field" id="people-email" type="email" name="email" maxlength="254" required placeholder="person@example.com"><button class="btn btn-primary" type="submit">Find person <span>→</span></button></div><span class="help-text">The person needs a StudyTrack account. This creates an in-app chat; it does not send external email.</span><div id="people-search-result" aria-live="polite"></div></form></section>
    <div class="messages-layout"><section class="panel direct-thread-panel"><div class="direct-panel-heading"><div><h2 class="panel-title">Your conversations</h2><p class="panel-subtitle">Private messages with other accounts</p></div><button class="icon-btn" type="button" data-action="refresh-direct-messages" title="Refresh conversations">↻</button></div><div id="direct-thread-list"><div class="chat-empty">Loading conversations…</div></div></section><section class="panel direct-conversation-panel" id="direct-conversation-panel"><div class="direct-empty-state"><span class="empty-icon">✉</span><b>Choose a conversation</b><p>Search for someone's exact email address to start a chat.</p></div></section></div>
    <p class="direct-privacy-note">Only the two people in a direct chat can read its messages. Admin activity records show that a message was sent, not its contents.</p>`;
}

export function renderDirectThreads(threads=[],activeId=""){
  if(!threads.length)return `<div class="direct-thread-empty"><span>✦</span><b>No messages yet</b><small>Find someone by email to begin.</small></div>`;
  return `<div class="direct-thread-list">${threads.map(thread=>`<button type="button" class="direct-thread ${thread.peer_id===activeId?"active":""}" data-action="open-direct-chat" data-id="${escapeHtml(thread.peer_id)}"><span class="direct-avatar">${escapeHtml((thread.peer_name||"S").slice(0,1).toUpperCase())}</span><span class="direct-thread-copy"><b>${escapeHtml(thread.peer_name)}</b><small>${escapeHtml(thread.last_message||"Start a conversation")}</small></span><span class="direct-thread-time">${messageTime(thread.created_at)}</span></button>`).join("")}</div>`;
}

export function renderDirectConversation(peer,messages=[],userId=""){
  const body=renderDirectMessageFeed(messages,userId);
  return `<header class="direct-conversation-head"><button type="button" class="direct-person-link" data-action="view-profile" data-id="${escapeHtml(peer.id)}" aria-label="View ${escapeHtml(peer.name)}'s profile"><span class="direct-avatar large">${escapeHtml((peer.name||"S").slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(peer.name)}</b><small>${escapeHtml(peer.role||"StudyTrack member")} · View profile</small></span></button><span class="chat-privacy-tag">Private chat</span></header><div class="direct-message-feed" id="direct-message-feed" aria-live="polite">${body}</div><form class="direct-compose" id="direct-chat-form" data-peer-id="${escapeHtml(peer.id)}"><textarea name="body" rows="2" maxlength="2000" required placeholder="Write a message…" aria-label="Write a private message"></textarea><div class="direct-compose-foot"><small>Only you and ${escapeHtml(peer.name)} can read these messages.</small><button class="btn btn-primary btn-small" type="submit">Send <span>↑</span></button></div></form>`;
}

export function renderDirectMessageFeed(messages=[],userId=""){
  if(!messages.length)return `<div class="chat-empty"><span class="empty-icon">✦</span><b>Say hello</b><p>Your messages here are private to this conversation.</p></div>`;
  return messages.map(message=>`<article class="chat-message ${message.sender_id===userId?"mine":""}"><div class="chat-message-meta">${message.sender_id===userId?"You":escapeHtml(message.sender_name)} <span>· ${messageTime(message.created_at)}</span></div><p>${escapeHtml(message.body).replace(/\n/g,"<br>")}</p></article>`).join("");
}

export function renderPersonSearch(person){
  if(!person)return `<div class="people-search-message empty">No active account matched that email. Check the spelling and try again.</div>`;
  return `<div class="people-search-result"><span class="direct-avatar">${escapeHtml((person.name||"S").slice(0,1).toUpperCase())}</span><span><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.role)}</small></span><button type="button" class="btn btn-small btn-soft" data-action="start-direct-chat" data-id="${escapeHtml(person.id)}">Open chat <span>→</span></button><button type="button" class="text-action" data-action="view-profile" data-id="${escapeHtml(person.id)}">Profile</button></div>`;
}
