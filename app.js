// ── Config ──
const API_URL = "/api/chat";

// ── Elements ──
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const loadBtn = document.getElementById("load-btn");
const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");
const sidebar = document.getElementById("sidebar");
const menuBtn = document.getElementById("menu-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const chatList = document.getElementById("chat-list");
const chatSearch = document.getElementById("chat-search");
const headerTitle = document.getElementById("header-title");
const fileInput = document.getElementById("file-input");
const attachmentPreview = document.getElementById("attachment-preview");
const renameModal = document.getElementById("rename-modal");
const renameInput = document.getElementById("rename-input");
const renameCancel = document.getElementById("rename-cancel");
const renameConfirm = document.getElementById("rename-confirm");

// ── State ──
let isGenerating = false;
let isReady = false;
let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let activeChatId = null;
let pendingFiles = []; // files to attach
let renamingChatId = null;

const SYSTEM_MSG = {
  role: "system",
  content:
    "You are a helpful AI assistant. Give direct, useful answers. When asked to code, write actual working code with markdown code blocks using triple backticks and language name (```python, ```javascript, ```bash, ```html, ```css, etc). Be concise but thorough.",
};

// ── Init ──
renderChatList();
if (activeChatId) updateHeaderTitle();

// ══════════════════════════════
//  SIDEBAR
// ══════════════════════════════
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("hidden");
  sidebar.classList.toggle("visible");
});

// Sidebar only closes via the menu button

newChatBtn.addEventListener("click", () => createNewChat());

// Search chats
chatSearch.addEventListener("input", () => renderChatList());

function createNewChat() {
  const chat = {
    id: Date.now().toString(),
    title: "New chat",
    messages: [SYSTEM_MSG],
  };
  chats.unshift(chat);
  activeChatId = chat.id;
  saveChats();
  renderChatList();
  renderMessages();
  updateHeaderTitle();
}

function switchChat(id) {
  activeChatId = id;
  renderChatList();
  renderMessages();
  updateHeaderTitle();
}

function deleteChat(id) {
  chats = chats.filter((c) => c.id !== id);
  if (activeChatId === id) {
    activeChatId = chats.length > 0 ? chats[0].id : null;
  }
  saveChats();
  renderChatList();
  renderMessages();
  updateHeaderTitle();
}

function getActiveChat() {
  return chats.find((c) => c.id === activeChatId);
}

function saveChats() {
  // Don't save file data to localStorage (too big), just metadata
  const toSave = chats.map((c) => ({
    ...c,
    messages: c.messages.map((m) => ({
      ...m,
      attachments: m.attachments
        ? m.attachments.map((a) => ({
            name: a.name,
            type: a.type,
            // Keep small images, skip large data
            data: a.data && a.data.length < 50000 ? a.data : null,
          }))
        : undefined,
    })),
  }));
  try {
    localStorage.setItem("chats", JSON.stringify(toSave));
  } catch (e) {
    // Storage full, remove oldest chat
    if (chats.length > 1) {
      chats.pop();
      saveChats();
    }
  }
}

function updateHeaderTitle() {
  const chat = getActiveChat();
  headerTitle.textContent = chat ? chat.title : "My AI Chatbot";
}

function renderChatList() {
  chatList.innerHTML = "";
  const query = chatSearch.value.toLowerCase().trim();

  for (const chat of chats) {
    if (query && !chat.title.toLowerCase().includes(query)) continue;

    const el = document.createElement("div");
    el.className = "chat-list-item" + (chat.id === activeChatId ? " active" : "");

    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = chat.title;

    const actions = document.createElement("div");
    actions.className = "chat-actions";

    // Rename button
    const renameBtn = document.createElement("button");
    renameBtn.className = "chat-action-btn";
    renameBtn.title = "Rename";
    renameBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openRenameModal(chat.id);
    });

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "chat-action-btn";
    delBtn.title = "Delete";
    delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    el.appendChild(title);
    el.appendChild(actions);
    el.addEventListener("click", () => switchChat(chat.id));
    chatList.appendChild(el);
  }
}

function renderMessages() {
  chatMessages.innerHTML = "";
  const chat = getActiveChat();
  if (!chat || chat.messages.length <= 1) {
    chatMessages.appendChild(createWelcome());
    return;
  }

  for (const msg of chat.messages) {
    if (msg.role === "system") continue;
    appendMessageEl(
      msg.role === "user" ? "user" : "bot",
      msg.content,
      msg.attachments
    );
  }
  scrollToBottom();
}

function createWelcome() {
  const div = document.createElement("div");
  div.className = "welcome-screen";
  div.innerHTML = `
    <div class="welcome-icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><path d="M12 2a7 7 0 017 7c0 3-2 5.5-4 7l-1 4H10l-1-4c-2-1.5-4-4-4-7a7 7 0 017-7z"/><path d="M9 20h6"/><path d="M10 22h4"/></svg>
    </div>
    <h2>My AI Chatbot</h2>
    <p>Free AI chatbot powered by open-source models.<br>No account needed. Click <strong>Connect</strong> then start chatting.</p>
    <div class="welcome-tags">
      <span>Write code</span><span>Answer questions</span><span>Brainstorm ideas</span><span>Explain concepts</span>
    </div>
    <button class="welcome-connect-btn" id="welcome-connect-btn">Connect to AI</button>
  `;
  // Wire up the welcome connect button
  const btn = div.querySelector(".welcome-connect-btn");
  btn.addEventListener("click", () => loadBtn.click());
  return div;
}

// ══════════════════════════════
//  RENAME MODAL
// ══════════════════════════════
function openRenameModal(chatId) {
  renamingChatId = chatId;
  const chat = chats.find((c) => c.id === chatId);
  renameInput.value = chat ? chat.title : "";
  renameModal.style.display = "flex";
  renameInput.focus();
  renameInput.select();
}

renameCancel.addEventListener("click", () => {
  renameModal.style.display = "none";
  renamingChatId = null;
});

renameConfirm.addEventListener("click", doRename);
renameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doRename();
  if (e.key === "Escape") {
    renameModal.style.display = "none";
    renamingChatId = null;
  }
});

renameModal.addEventListener("click", (e) => {
  if (e.target === renameModal) {
    renameModal.style.display = "none";
    renamingChatId = null;
  }
});

function doRename() {
  const name = renameInput.value.trim();
  if (!name || !renamingChatId) return;
  const chat = chats.find((c) => c.id === renamingChatId);
  if (chat) {
    chat.title = name;
    saveChats();
    renderChatList();
    updateHeaderTitle();
  }
  renameModal.style.display = "none";
  renamingChatId = null;
}

// ══════════════════════════════
//  FILE ATTACHMENTS
// ══════════════════════════════
fileInput.addEventListener("change", () => {
  for (const file of fileInput.files) {
    if (pendingFiles.length >= 5) break; // max 5 files

    const reader = new FileReader();
    const isImage = file.type.startsWith("image/");

    reader.onload = () => {
      pendingFiles.push({
        name: file.name,
        type: file.type,
        data: reader.result,
        isImage,
      });
      renderAttachmentPreview();
    };

    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }
  fileInput.value = "";
});

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = "";
  for (let i = 0; i < pendingFiles.length; i++) {
    const f = pendingFiles[i];
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    if (f.isImage) {
      const img = document.createElement("img");
      img.src = f.data;
      img.alt = f.name;
      chip.appendChild(img);
    } else {
      const icon = document.createElement("span");
      icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
      chip.appendChild(icon);
    }

    const name = document.createElement("span");
    name.textContent = f.name.length > 20 ? f.name.slice(0, 17) + "..." : f.name;
    chip.appendChild(name);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-attach";
    removeBtn.textContent = "\u00d7";
    removeBtn.addEventListener("click", () => {
      pendingFiles.splice(i, 1);
      renderAttachmentPreview();
    });
    chip.appendChild(removeBtn);

    attachmentPreview.appendChild(chip);
  }
}

// ══════════════════════════════
//  CONNECT
// ══════════════════════════════
loadBtn.addEventListener("click", async () => {
  loadBtn.disabled = true;
  loadBtn.textContent = "...";
  statusText.textContent = "Connecting";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Say hi in 3 words" }],
      }),
    });

    const text = await res.text();
    if (res.ok && text.length > 0) {
      isReady = true;
      statusText.textContent = "Online";
      statusDot.classList.add("connected");
      loadBtn.style.display = "none";
      userInput.disabled = false;
      sendBtn.disabled = false;
      userInput.focus();
      // Hide welcome connect button too
      const wcb = document.getElementById("welcome-connect-btn");
      if (wcb) wcb.style.display = "none";
      if (chats.length === 0) createNewChat();
    } else {
      throw new Error(text || "No response");
    }
  } catch (err) {
    console.error(err);
    statusText.textContent = "Offline";
    loadBtn.disabled = false;
    loadBtn.textContent = "Retry";
  }
});

// ══════════════════════════════
//  SEND MESSAGE
// ══════════════════════════════
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 150) + "px";
});

// Paste images
userInput.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        pendingFiles.push({
          name: file.name || "pasted-image.png",
          type: file.type,
          data: reader.result,
          isImage: true,
        });
        renderAttachmentPreview();
      };
      reader.readAsDataURL(file);
    }
  }
});

async function sendMessage() {
  const text = userInput.value.trim();
  if ((!text && pendingFiles.length === 0) || !isReady || isGenerating) return;

  if (!getActiveChat()) createNewChat();
  const chat = getActiveChat();

  // Remove welcome
  chatMessages.querySelectorAll(".welcome-screen").forEach((el) => el.remove());

  // Build attachments
  const attachments = [...pendingFiles];
  pendingFiles = [];
  renderAttachmentPreview();

  // Display user message
  const displayText = text || "(attached files)";
  appendMessageEl("user", displayText, attachments);
  userInput.value = "";
  userInput.style.height = "auto";

  // Build the content to send to AI
  let contentForAI = text;
  for (const f of attachments) {
    if (!f.isImage && f.data) {
      contentForAI += `\n\n[File: ${f.name}]\n${f.data}`;
    } else if (f.isImage) {
      contentForAI += `\n\n[User attached an image: ${f.name}. Note: you cannot see images, just acknowledge it was shared.]`;
    }
  }

  chat.messages.push({
    role: "user",
    content: contentForAI,
    attachments: attachments.map((a) => ({
      name: a.name,
      type: a.type,
      data: a.data,
      isImage: a.isImage,
    })),
  });

  // Title from first message
  if (chat.messages.filter((m) => m.role === "user").length === 1) {
    chat.title = (text || attachments[0]?.name || "New chat").slice(0, 40);
    if (chat.title.length >= 40) chat.title += "...";
    renderChatList();
    updateHeaderTitle();
  }

  const typingEl = appendTypingIndicator();

  isGenerating = true;
  sendBtn.disabled = true;
  userInput.disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chat.messages.map((m) => ({ role: m.role, content: m.content })) }),
    });

    typingEl.remove();
    const reply = (await res.text()).trim();

    if (res.ok && reply) {
      appendMessageEl("bot", reply);
      chat.messages.push({ role: "assistant", content: reply });
    } else {
      appendMessageEl("bot", "Error getting response. Try again.");
    }
  } catch (err) {
    console.error(err);
    typingEl.remove();
    appendMessageEl("bot", "Network error: " + err.message);
  }

  saveChats();
  isGenerating = false;
  sendBtn.disabled = false;
  userInput.disabled = false;
  userInput.focus();
}

// ══════════════════════════════
//  MARKDOWN RENDERING
// ══════════════════════════════
function renderMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```lang\ncode\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const id = "code-" + Math.random().toString(36).slice(2, 8);
    const label = lang || "code";
    return `<div class="code-block">
      <div class="code-block-header">
        <span class="code-lang">${label}</span>
        <button class="copy-btn" onclick="copyCode('${id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        </button>
      </div>
      <pre><code id="${id}">${code.trim()}</code></pre>
    </div>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" class="msg-link" target="_blank" rel="noopener">$1</a>');

  // Plain URLs
  html = html.replace(/(?<!")(?<!')(https?:\/\/[^\s<"']+)/g,
    '<a href="$1" class="msg-link" target="_blank" rel="noopener">$1</a>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, (match) => `<ul>${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Paragraphs
  html = html
    .split(/\n\n+/)
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      if (/^<(div|ul|ol|li|h[1-3]|pre)/.test(p)) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html;
}

window.copyCode = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.closest(".code-block").querySelector(".copy-btn");
    const original = btn.innerHTML;
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("copied");
    }, 2000);
  });
};

// ══════════════════════════════
//  UI HELPERS
// ══════════════════════════════
function appendMessageEl(role, text, attachments) {
  const isUser = role === "user";
  const div = document.createElement("div");
  div.className = `message ${isUser ? "user-message" : "bot-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = isUser ? "You" : "AI";

  const content = document.createElement("div");
  content.className = "message-content";

  // Show attachments
  if (attachments && attachments.length > 0) {
    const attachDiv = document.createElement("div");
    attachDiv.className = "msg-attachments";
    for (const a of attachments) {
      if (a.isImage && a.data) {
        const img = document.createElement("img");
        img.className = "msg-image";
        img.src = a.data;
        img.alt = a.name;
        attachDiv.appendChild(img);
      } else {
        const fileEl = document.createElement("div");
        fileEl.className = "msg-file";
        fileEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>';
        const fname = document.createElement("span");
        fname.textContent = a.name;
        fileEl.appendChild(fname);
        attachDiv.appendChild(fileEl);
      }
    }
    content.appendChild(attachDiv);
  }

  if (isUser) {
    const textNode = document.createElement("span");
    textNode.textContent = text;
    content.appendChild(textNode);
  } else {
    const md = document.createElement("div");
    md.innerHTML = renderMarkdown(text);
    content.appendChild(md);
  }

  div.appendChild(avatar);
  div.appendChild(content);
  chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function appendTypingIndicator() {
  const div = document.createElement("div");
  div.className = "message bot-message";
  div.innerHTML = `
    <div class="message-avatar">AI</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
