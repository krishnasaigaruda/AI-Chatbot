// ══════════════════════════════
//  ORBIX CODE — Web IDE
// ══════════════════════════════

const API_URL = "/api/chat";

// ── Elements ──
const projectScreen = document.getElementById("project-screen");
const ideScreen = document.getElementById("ide-screen");
const projectList = document.getElementById("project-list");
const projectSearch = document.getElementById("project-search");
const newProjectBtn = document.getElementById("new-project-btn");
const newProjectModal = document.getElementById("new-project-modal");
const projectNameInput = document.getElementById("project-name-input");
const projectCancel = document.getElementById("project-cancel");
const projectCreate = document.getElementById("project-create");
const savePathInput = document.getElementById("save-path-input");
const pickSaveLocation = document.getElementById("pick-save-location");
const saveLocationText = document.getElementById("save-location-text");
const toolbarProjectName = document.getElementById("toolbar-project-name");
const ideBackBtn = document.getElementById("ide-back-btn");
const fileTree = document.getElementById("file-tree");
const tabBar = document.getElementById("tab-bar");
const editorContainer = document.getElementById("editor-container");
const editorLoading = document.getElementById("editor-loading");
const previewBtn = document.getElementById("preview-btn");
const downloadBtn = document.getElementById("download-btn");
const saveFolderBtn = document.getElementById("save-folder-btn");
const searchBtn = document.getElementById("search-btn");
const searchModal = document.getElementById("search-modal");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const aiToggleBtn = document.getElementById("ai-toggle-btn");
const aiPanel = document.getElementById("ide-ai-panel");
const aiCloseBtn = document.getElementById("ai-close-btn");
const aiClearBtn = document.getElementById("ai-clear-btn");
const aiMessages = document.getElementById("ai-messages");
const aiWelcome = document.getElementById("ai-welcome");
const aiForm = document.getElementById("ai-form");
const aiInput = document.getElementById("ai-input");
const aiSendBtn = document.getElementById("ai-send-btn");
const newFileBtn = document.getElementById("new-file-btn");
const newFolderBtn = document.getElementById("new-folder-btn");

// ── State ──
let projects = JSON.parse(localStorage.getItem("orbix-projects") || "[]");
let activeProject = null;
let activeFile = null;
let openTabs = [];
let selectedTemplate = "html";
let aiChatMessages = [];
let aiGenerating = false;
let dirtyFiles = new Set();
let saveDirHandle = null;
let homeDir = "~";

// Get home dir from server
fetch("/api/fs/home").then(r => r.json()).then(d => { homeDir = d.home; }).catch(() => {});

// No system message — keep it simple to avoid API issues

// ══════════════════════════════
//  AUTO-RESIZE TEXTAREA
// ══════════════════════════════
aiInput.addEventListener("input", () => {
  aiInput.style.height = "auto";
  aiInput.style.height = Math.min(aiInput.scrollHeight, 120) + "px";
});

// ══════════════════════════════
//  CUSTOM DIALOG SYSTEM
// ══════════════════════════════
const dialogOverlay = document.getElementById("orbix-dialog");
const dialogTitle = document.getElementById("dialog-title");
const dialogMessage = document.getElementById("dialog-message");
const dialogInput = document.getElementById("dialog-input");
const dialogCancel = document.getElementById("dialog-cancel");
const dialogOk = document.getElementById("dialog-ok");
let dialogResolve = null;

function orbixAlert(msg, title = "Orbix Code") {
  return new Promise(resolve => {
    dialogTitle.textContent = title;
    dialogMessage.textContent = msg;
    dialogInput.style.display = "none";
    dialogCancel.style.display = "none";
    dialogOk.textContent = "OK";
    dialogOk.className = "modal-confirm";
    dialogOverlay.style.display = "flex";
    dialogResolve = () => resolve();
  });
}

function orbixConfirm(msg, title = "Confirm", dangerText = "Delete") {
  return new Promise(resolve => {
    dialogTitle.textContent = title;
    dialogMessage.textContent = msg;
    dialogInput.style.display = "none";
    dialogCancel.style.display = "";
    dialogCancel.textContent = "Cancel";
    dialogOk.textContent = dangerText;
    dialogOk.className = "modal-confirm";
    dialogOverlay.style.display = "flex";
    dialogResolve = resolve;
  });
}

function orbixPrompt(msg, defaultVal = "", title = "Rename") {
  return new Promise(resolve => {
    dialogTitle.textContent = title;
    dialogMessage.textContent = msg;
    dialogInput.style.display = "";
    dialogInput.value = defaultVal;
    dialogCancel.style.display = "";
    dialogCancel.textContent = "Cancel";
    dialogOk.textContent = "OK";
    dialogOk.className = "modal-confirm";
    dialogOverlay.style.display = "flex";
    dialogResolve = resolve;
    setTimeout(() => { dialogInput.focus(); dialogInput.select(); }, 50);
  });
}

dialogOk.addEventListener("click", () => {
  dialogOverlay.style.display = "none";
  if (dialogResolve) {
    if (dialogInput.style.display !== "none") {
      dialogResolve(dialogInput.value);
    } else if (dialogCancel.style.display !== "none") {
      dialogResolve(true);
    } else {
      dialogResolve();
    }
    dialogResolve = null;
  }
});

dialogCancel.addEventListener("click", () => {
  dialogOverlay.style.display = "none";
  if (dialogResolve) {
    if (dialogInput.style.display !== "none") {
      dialogResolve(null);
    } else {
      dialogResolve(false);
    }
    dialogResolve = null;
  }
});

dialogOverlay.addEventListener("click", (e) => {
  if (e.target === dialogOverlay) dialogCancel.click();
});

dialogInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dialogOk.click();
  if (e.key === "Escape") dialogCancel.click();
});

// ══════════════════════════════
//  FILESYSTEM HELPERS
// ══════════════════════════════
async function fsWrite(filePath, content) {
  try {
    await fetch("/api/fs/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });
  } catch (e) {}
}

async function fsMkdir(dirPath) {
  try {
    await fetch("/api/fs/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath }),
    });
  } catch (e) {}
}

async function fsDelete(filePath) {
  try {
    await fetch("/api/fs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
  } catch (e) {}
}

function diskPath(filename) {
  if (!activeProject || !activeProject.savePath) return null;
  return activeProject.savePath + "/" + filename;
}

// ══════════════════════════════
//  PROJECT MANAGEMENT
// ══════════════════════════════
function saveProjects() {
  try {
    localStorage.setItem("orbix-projects", JSON.stringify(projects));
    dirtyFiles.clear();
    renderTabs();
    renderFileTree();
  } catch (e) {
    console.error("Storage full. Try deleting old projects.");
  }
}

function renderProjectList() {
  projectList.innerHTML = "";
  const query = (projectSearch ? projectSearch.value : "").toLowerCase().trim();
  const filtered = projects.filter(p => !query || p.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    projectList.innerHTML = `<p style="color:var(--text-dim);font-size:0.85rem;text-align:center;margin-top:12px;">${query ? "No matching projects" : "No projects yet"}</p>`;
    return;
  }
  for (const proj of filtered) {
    const card = document.createElement("div");
    card.className = "project-card";
    const info = document.createElement("div");
    info.className = "project-card-info";
    info.innerHTML = `
      <div class="project-card-name">${escapeHtml(proj.name)}</div>
      <div class="project-card-meta">${Object.keys(proj.files).length} files &middot; ${new Date(parseInt(proj.id)).toLocaleDateString()}</div>
    `;
    const actions = document.createElement("div");
    actions.className = "project-card-actions";

    const renBtn = document.createElement("button");
    renBtn.className = "project-card-btn rename";
    renBtn.title = "Rename";
    renBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    renBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newName = await orbixPrompt("New project name:", proj.name, "Rename Project");
      if (!newName || newName === proj.name) return;
      proj.name = newName;
      saveProjects();
      renderProjectList();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "project-card-btn delete";
    delBtn.title = "Delete";
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await orbixConfirm('Delete project "' + proj.name + '"? This cannot be undone.');
      if (!ok) return;
      projects = projects.filter(p => p.id !== proj.id);
      saveProjects();
      renderProjectList();
    });

    actions.appendChild(renBtn);
    actions.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(actions);
    card.addEventListener("click", () => openProject(proj));
    projectList.appendChild(card);
  }
}

if (projectSearch) {
  projectSearch.addEventListener("input", () => renderProjectList());
}

function getTemplateFiles(template) {
  if (template === "blank") {
    return { "index.html": { content: "", language: "html" } };
  }
  return {
    "index.html": {
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello World</h1>
  <p>Edit this file to get started!</p>
  <script src="script.js"><\/script>
</body>
</html>`,
      language: "html"
    },
    "style.css": {
      content: `* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex-direction: column;\n  gap: 12px;\n  background: #0a0a0a;\n  color: #e4e4e7;\n}\n\nh1 {\n  font-size: 2rem;\n}`,
      language: "css"
    },
    "script.js": {
      content: `console.log("Hello from Orbix Code!");`,
      language: "javascript"
    }
  };
}

// ── New Project Modal ──
newProjectBtn.addEventListener("click", () => {
  newProjectModal.style.display = "flex";
  projectNameInput.value = "";
  savePathInput.value = "";
  saveDirHandle = null;
  saveLocationText.textContent = "Choose folder...";
  projectNameInput.focus();
});

projectCancel.addEventListener("click", () => { newProjectModal.style.display = "none"; });
newProjectModal.addEventListener("click", (e) => { if (e.target === newProjectModal) newProjectModal.style.display = "none"; });

pickSaveLocation.addEventListener("click", async () => {
  if (!window.showDirectoryPicker) {
    saveLocationText.textContent = "Not supported — type path below";
    return;
  }
  try {
    saveDirHandle = await window.showDirectoryPicker();
    saveLocationText.textContent = "\u2713 " + saveDirHandle.name;
  } catch (e) {
    if (e.name !== "AbortError") saveLocationText.textContent = "Failed to pick folder";
  }
});

document.querySelectorAll(".template-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".template-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTemplate = btn.dataset.template;
  });
});

projectCreate.addEventListener("click", createProject);
projectNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createProject();
  if (e.key === "Escape") newProjectModal.style.display = "none";
});

async function createProject() {
  const name = projectNameInput.value.trim();
  if (!name) return;

  let savePath = savePathInput.value.trim();

  if (!saveDirHandle && !savePath) {
    if (window.showDirectoryPicker) {
      try {
        saveDirHandle = await window.showDirectoryPicker();
        saveLocationText.textContent = "\u2713 " + saveDirHandle.name;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    if (!saveDirHandle && !savePath) {
      savePathInput.style.borderColor = "var(--red)";
      savePathInput.focus();
      setTimeout(() => { savePathInput.style.borderColor = ""; }, 2000);
      return;
    }
  }

  if (savePath && savePath.startsWith("~")) {
    savePath = homeDir + savePath.slice(1);
  }
  if (savePath) savePath = savePath.replace(/\/+$/, "");

  const proj = {
    id: Date.now().toString(),
    name,
    savePath: savePath || null,
    files: getTemplateFiles(selectedTemplate),
    openTabs: selectedTemplate === "blank" ? ["index.html"] : ["index.html", "style.css", "script.js"],
    activeTab: "index.html"
  };
  projects.unshift(proj);
  saveProjects();
  newProjectModal.style.display = "none";

  if (saveDirHandle) {
    try {
      const projDir = await saveDirHandle.getDirectoryHandle(name.replace(/\s+/g, "-"), { create: true });
      for (const [fname, file] of Object.entries(proj.files)) {
        const parts = fname.split("/");
        let dir = projDir;
        for (let i = 0; i < parts.length - 1; i++) {
          dir = await dir.getDirectoryHandle(parts[i], { create: true });
        }
        const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const w = await fh.createWritable();
        await w.write(file.content);
        await w.close();
      }
    } catch (e) {}
  } else if (savePath) {
    await fsMkdir(savePath);
    for (const [fname, file] of Object.entries(proj.files)) {
      await fsWrite(savePath + "/" + fname, file.content);
    }
  }

  openProject(proj);
}

function openProject(proj) {
  activeProject = proj;
  openTabs = [...(proj.openTabs || Object.keys(proj.files))];
  activeFile = proj.activeTab || openTabs[0] || null;
  dirtyFiles.clear();

  projectScreen.style.display = "none";
  ideScreen.style.display = "flex";
  toolbarProjectName.textContent = proj.name;

  renderFileTree();
  renderTabs();
  loadFileInEditor(activeFile);
}

ideBackBtn.addEventListener("click", () => {
  saveCurrentFile();
  saveProjects();
  ideScreen.style.display = "none";
  projectScreen.style.display = "flex";
  activeProject = null;
  aiChatMessages = [];
  clearAIChat();
  renderProjectList();
});

// ══════════════════════════════
//  FILE EXPLORER
// ══════════════════════════════
function getFileIconSvg(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const colors = { html: "#e44d26", css: "#264de4", js: "#f7df1e", json: "#5b9bd5", md: "#83b4c6", py: "#3572A5" };
  const color = colors[ext] || "#71717a";
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>`;
}

function getFolderSvg() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>';
}

function renderFileTree() {
  fileTree.innerHTML = "";
  if (!activeProject) return;

  const files = Object.keys(activeProject.files).filter(f => !f.endsWith("/.folder")).sort();
  const folders = new Set();
  const filesByFolder = {};

  for (const f of files) {
    const parts = f.split("/");
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join("/");
      folders.add(folder);
      if (!filesByFolder[folder]) filesByFolder[folder] = [];
      filesByFolder[folder].push(f);
    } else {
      if (!filesByFolder["."]) filesByFolder["."] = [];
      filesByFolder["."].push(f);
    }
  }

  if (filesByFolder["."]) {
    for (const filename of filesByFolder["."]) {
      fileTree.appendChild(createFileItem(filename, filename));
    }
  }

  for (const folder of [...folders].sort()) {
    const folderEl = document.createElement("div");
    folderEl.className = "folder-item";
    folderEl.innerHTML = `<span class="file-icon">${getFolderSvg()}</span><span style="flex:1">${folder}</span>`;
    folderEl.addEventListener("click", () => folderEl.classList.toggle("collapsed"));
    fileTree.appendChild(folderEl);

    const folderContents = document.createElement("div");
    folderContents.className = "folder-contents";
    for (const filename of filesByFolder[folder] || []) {
      const displayName = filename.split("/").pop();
      const item = createFileItem(filename, displayName);
      item.style.paddingLeft = "24px";
      folderContents.appendChild(item);
    }
    fileTree.appendChild(folderContents);
  }
}

function createFileItem(filename, displayName) {
  const item = document.createElement("div");
  item.className = "file-item" + (filename === activeFile ? " active" : "");

  const icon = document.createElement("span");
  icon.className = "file-icon";
  icon.innerHTML = getFileIconSvg(filename);

  const name = document.createElement("span");
  name.textContent = displayName;
  name.style.flex = "1";

  if (dirtyFiles.has(filename)) {
    const dot = document.createElement("span");
    dot.className = "dirty-dot";
    dot.textContent = "\u25CF";
    name.appendChild(dot);
  }

  const delBtn = document.createElement("button");
  delBtn.className = "delete-file-btn";
  delBtn.textContent = "\u00d7";
  delBtn.title = "Delete file";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteFile(filename);
  });

  item.appendChild(icon);
  item.appendChild(name);
  item.appendChild(delBtn);
  item.addEventListener("click", () => openFile(filename));
  return item;
}

function openFile(filename) {
  saveCurrentFile();
  if (!openTabs.includes(filename)) openTabs.push(filename);
  activeFile = filename;
  activeProject.activeTab = filename;
  activeProject.openTabs = [...openTabs];
  renderFileTree();
  renderTabs();
  loadFileInEditor(filename);
}

async function deleteFile(filename) {
  if (Object.keys(activeProject.files).length <= 1) return;
  const ok = await orbixConfirm('Delete "' + filename + '"? This cannot be undone.', "Delete File");
  if (!ok) return;

  delete activeProject.files[filename];
  openTabs = openTabs.filter(t => t !== filename);
  dirtyFiles.delete(filename);
  if (activeFile === filename) {
    activeFile = openTabs[0] || Object.keys(activeProject.files)[0];
  }
  activeProject.openTabs = [...openTabs];
  activeProject.activeTab = activeFile;
  saveProjects();
  renderFileTree();
  renderTabs();
  loadFileInEditor(activeFile);

  const dp = diskPath(filename);
  if (dp) fsDelete(dp);
}

newFileBtn.addEventListener("click", () => showNewFileInput("file"));
newFolderBtn.addEventListener("click", () => showNewFileInput("folder"));

function showNewFileInput(type) {
  const existing = fileTree.querySelector(".new-file-input");
  if (existing) existing.remove();

  const input = document.createElement("input");
  input.className = "new-file-input";
  input.placeholder = type === "folder" ? "folder-name" : "filename.ext";
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      let name = input.value.trim();
      if (!name) { input.remove(); return; }

      if (type === "folder") {
        const folderName = name;
        const hasFolder = Object.keys(activeProject.files).some(f => f.startsWith(folderName + "/"));
        if (hasFolder) { input.remove(); return; }
        activeProject.files[folderName + "/.folder"] = { content: "", language: "text" };
        const dp = diskPath(folderName);
        if (dp) await fsMkdir(dp);
        saveProjects();
        renderFileTree();
        input.remove();
      } else {
        if (activeProject.files[name]) { input.remove(); return; }
        const ext = name.split(".").pop().toLowerCase();
        const langMap = { html: "html", css: "css", js: "javascript", json: "json", py: "python", md: "markdown", txt: "text" };
        activeProject.files[name] = { content: "", language: langMap[ext] || "text" };
        const dp = diskPath(name);
        if (dp) await fsWrite(dp, "");
        saveProjects();
        renderFileTree();
        openFile(name);
        input.remove();
      }
    }
    if (e.key === "Escape") input.remove();
  });
  input.addEventListener("blur", () => setTimeout(() => input.remove(), 150));
  fileTree.prepend(input);
  input.focus();
}

// ══════════════════════════════
//  TAB BAR
// ══════════════════════════════
function renderTabs() {
  tabBar.innerHTML = "";
  for (const filename of openTabs) {
    if (!activeProject || !activeProject.files[filename] || filename.endsWith("/.folder")) continue;
    const tab = document.createElement("div");
    tab.className = "tab" + (filename === activeFile ? " active" : "");

    const label = document.createElement("span");
    const isDirty = dirtyFiles.has(filename);
    label.textContent = filename.split("/").pop() + (isDirty ? " \u25CF" : "");
    if (isDirty) label.classList.add("dirty");

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(filename);
    });

    tab.appendChild(label);
    tab.appendChild(closeBtn);
    tab.addEventListener("click", () => openFile(filename));
    tabBar.appendChild(tab);
  }
}

function closeTab(filename) {
  openTabs = openTabs.filter(t => t !== filename);
  if (activeFile === filename) {
    activeFile = openTabs[openTabs.length - 1] || Object.keys(activeProject.files)[0] || null;
  }
  activeProject.openTabs = [...openTabs];
  activeProject.activeTab = activeFile;
  renderTabs();
  renderFileTree();
  if (activeFile) loadFileInEditor(activeFile);
}

// ══════════════════════════════
//  CODE EDITOR (CodeMirror)
// ══════════════════════════════
let cmEditor = null;
let editorLoading_ = false;

function getCMMode(filename) {
  if (!filename) return "text/plain";
  const ext = filename.split(".").pop().toLowerCase();
  const modes = {
    html: "htmlmixed", htm: "htmlmixed",
    css: "css", scss: "css", less: "css",
    js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript",
    json: "application/json",
    py: "python",
    md: "markdown",
  };
  return modes[ext] || "text/plain";
}

function initEditor() {
  editorLoading.style.display = "none";
  cmEditor = CodeMirror(editorContainer, {
    value: "",
    theme: "orbix-dark",
    lineNumbers: true,
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: false,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    mode: "htmlmixed",
    scrollbarStyle: "native",
    extraKeys: {
      "Cmd-S": () => { saveCurrentFile(); saveAllToDisk(); saveProjects(); },
      "Ctrl-S": () => { saveCurrentFile(); saveAllToDisk(); saveProjects(); },
      "Cmd-F": () => openSearchModal(),
      "Ctrl-F": () => openSearchModal(),
    },
  });

  cmEditor.on("change", () => {
    if (editorLoading_) return;
    if (activeProject && activeFile) {
      activeProject.files[activeFile].content = cmEditor.getValue();
      dirtyFiles.add(activeFile);
      renderTabs();
      renderFileTree();
    }
  });
}

function loadFileInEditor(filename) {
  if (!cmEditor) initEditor();
  if (!filename || !activeProject || !activeProject.files[filename]) {
    cmEditor.setValue("");
    cmEditor.setOption("readOnly", true);
    return;
  }
  editorLoading_ = true;
  cmEditor.setOption("readOnly", false);
  cmEditor.setValue(activeProject.files[filename].content);
  cmEditor.setOption("mode", getCMMode(filename));
  cmEditor.clearHistory();
  editorLoading_ = false;
  setTimeout(() => cmEditor.refresh(), 10);
}

function saveCurrentFile() {
  if (cmEditor && activeProject && activeFile && activeProject.files[activeFile]) {
    activeProject.files[activeFile].content = cmEditor.getValue();
  }
}

async function saveAllToDisk() {
  if (!activeProject) return;

  if (activeProject.savePath) {
    for (const [name, file] of Object.entries(activeProject.files)) {
      if (name.endsWith("/.folder")) continue;
      await fsWrite(activeProject.savePath + "/" + name, file.content);
    }
  } else if (saveDirHandle) {
    try {
      const projName = activeProject.name.replace(/\s+/g, "-");
      let projDir;
      try { projDir = await saveDirHandle.getDirectoryHandle(projName); }
      catch { projDir = saveDirHandle; }
      for (const [name, file] of Object.entries(activeProject.files)) {
        if (name.endsWith("/.folder")) continue;
        const parts = name.split("/");
        let dir = projDir;
        for (let i = 0; i < parts.length - 1; i++) {
          dir = await dir.getDirectoryHandle(parts[i], { create: true });
        }
        const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
        const w = await fh.createWritable();
        await w.write(file.content);
        await w.close();
      }
    } catch (e) {}
  }
}

// ══════════════════════════════
//  PREVIEW
// ══════════════════════════════
const previewPicker = document.getElementById("preview-picker");
const previewFileList = document.getElementById("preview-file-list");
const previewCancel = document.getElementById("preview-cancel");

previewBtn.addEventListener("click", () => {
  if (!activeProject) return;
  saveCurrentFile();

  const htmlFiles = Object.keys(activeProject.files).filter(f => f.endsWith(".html"));
  if (htmlFiles.length === 0) {
    orbixAlert("No HTML files found. Create an HTML file first.", "No Preview Available");
    return;
  }
  if (htmlFiles.length === 1) {
    openPreviewForFile(htmlFiles[0]);
    return;
  }

  previewFileList.innerHTML = "";
  for (const f of htmlFiles) {
    const item = document.createElement("div");
    item.className = "preview-file-item";
    item.innerHTML = getFileIconSvg(f) + " " + escapeHtml(f);
    item.addEventListener("click", () => {
      previewPicker.style.display = "none";
      openPreviewForFile(f);
    });
    previewFileList.appendChild(item);
  }
  previewPicker.style.display = "flex";
});

previewCancel.addEventListener("click", () => { previewPicker.style.display = "none"; });
previewPicker.addEventListener("click", (e) => { if (e.target === previewPicker) previewPicker.style.display = "none"; });

function openPreviewForFile(filename) {
  let html = activeProject.files[filename].content;

  for (const [name, file] of Object.entries(activeProject.files)) {
    if (name.endsWith(".css")) {
      const linkRegex = new RegExp(`<link[^>]*href=["']${name.replace(/\./g, "\\.")}["'][^>]*>`, "gi");
      html = html.replace(linkRegex, `<style>/* ${name} */\n${file.content}\n</style>`);
    }
  }
  for (const [name, file] of Object.entries(activeProject.files)) {
    if (name.endsWith(".js")) {
      const scriptRegex = new RegExp(`<script[^>]*src=["']${name.replace(/\./g, "\\.")}["'][^>]*>[\\s\\S]*?<\\/script>`, "gi");
      html = html.replace(scriptRegex, `<script>/* ${name} */\n${file.content}\n<\/script>`);
    }
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ══════════════════════════════
//  SEARCH (Ctrl+F)
// ══════════════════════════════
searchBtn.addEventListener("click", openSearchModal);

function openSearchModal() {
  searchModal.style.display = "flex";
  searchInput.value = "";
  searchResults.innerHTML = "";
  searchInput.focus();
}

searchModal.addEventListener("click", (e) => {
  if (e.target === searchModal) searchModal.style.display = "none";
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") searchModal.style.display = "none";
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!query || !activeProject) return;

  for (const [filename, file] of Object.entries(activeProject.files)) {
    if (filename.endsWith("/.folder")) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        const result = document.createElement("div");
        result.className = "search-result-item";

        const lineNum = i + 1;
        const line = lines[i].trim().substring(0, 80);
        const highlighted = line.replace(new RegExp(`(${escapeRegex(query)})`, "gi"), "<mark>$1</mark>");

        result.innerHTML = `
          <span class="search-file">${escapeHtml(filename)}:${lineNum}</span>
          <span class="search-line">${highlighted}</span>
        `;
        result.addEventListener("click", () => {
          searchModal.style.display = "none";
          openFile(filename);
          setTimeout(() => {
            if (cmEditor) {
              cmEditor.setCursor(i, 0);
              cmEditor.setSelection({ line: i, ch: 0 }, { line: i, ch: lines[i].length });
              cmEditor.scrollIntoView({ line: i, ch: 0 }, 100);
              cmEditor.focus();
            }
          }, 50);
        });
        searchResults.appendChild(result);
      }
    }
  }

  if (!searchResults.children.length) {
    searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
  }
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "f" && activeProject) {
    e.preventDefault();
    openSearchModal();
  }
});

// ══════════════════════════════
//  DOWNLOAD / SAVE
// ══════════════════════════════
downloadBtn.addEventListener("click", async () => {
  if (!activeProject) return;
  saveCurrentFile();
  const zip = new JSZip();
  for (const [name, file] of Object.entries(activeProject.files)) {
    if (name.endsWith("/.folder")) continue;
    zip.file(name, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, activeProject.name + ".zip");
});

saveFolderBtn.addEventListener("click", async () => {
  if (!activeProject) return;
  saveCurrentFile();
  saveProjects();

  if (activeProject.savePath || saveDirHandle) {
    await saveAllToDisk();
  } else if (window.showDirectoryPicker) {
    try {
      saveDirHandle = await window.showDirectoryPicker();
      await saveAllToDisk();
    } catch (e) {
      if (e.name !== "AbortError") orbixAlert("Save failed: " + e.message, "Error");
    }
  } else {
    orbixAlert("No save location set. Use ZIP download instead.", "No Save Location");
  }
});

// ══════════════════════════════
//  AI CHAT PANEL
// ══════════════════════════════
aiToggleBtn.addEventListener("click", () => { aiPanel.classList.toggle("hidden"); });
aiCloseBtn.addEventListener("click", () => { aiPanel.classList.add("hidden"); });

aiClearBtn.addEventListener("click", () => {
  aiChatMessages = [];
  clearAIChat();
});

function clearAIChat() {
  aiMessages.innerHTML = "";
  if (aiWelcome) {
    aiMessages.appendChild(aiWelcome);
    aiWelcome.style.display = "";
  }
}

aiForm.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
  sendAIMessage().catch(err => console.error("AI send error:", err));
  return false;
});
aiInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    sendAIMessage().catch(err => console.error("AI send error:", err));
    return false;
  }
});

document.querySelectorAll(".ai-suggest-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    aiInput.value = btn.dataset.prompt;
    sendAIMessage();
  });
});

function addAIMsg(role, html) {
  if (aiWelcome) aiWelcome.style.display = "none";
  const div = document.createElement("div");
  div.className = "ai-msg " + role;
  div.innerHTML = html;
  aiMessages.appendChild(div);
  aiMessages.scrollTop = aiMessages.scrollHeight;
  return div;
}

async function sendAIMessage() {
  try {
    const text = aiInput.value.trim();
    if (!text || aiGenerating) return;
    aiInput.value = "";
    aiInput.style.height = "auto";

    addAIMsg("user", escapeHtml(text));

    // Keep prompt SHORT — long prompts cause the free API to fail
    aiChatMessages.push({ role: "user", content: text });

    const thinkingEl = addAIMsg("bot", '<span class="ai-thinking">Generating code...</span>');
    aiGenerating = true;
    aiSendBtn.disabled = true;

    try {
      const messages = aiChatMessages.slice(-4);
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });
      const reply = (await res.text()).trim();
      thinkingEl.remove();

      if (res.ok && reply) {
        aiChatMessages.push({ role: "assistant", content: reply });
        renderAIResponse(reply);
      } else {
        addAIMsg("bot", '<span style="color:var(--red)">Error getting response. Try again.</span>');
      }
    } catch (err) {
      thinkingEl.remove();
      addAIMsg("bot", '<span style="color:var(--red)">Network error: ' + escapeHtml(err.message) + '</span>');
    }

    aiGenerating = false;
    aiSendBtn.disabled = false;
    aiInput.focus();
  } catch (outerErr) {
    console.error("sendAIMessage error:", outerErr);
    aiGenerating = false;
    aiSendBtn.disabled = false;
  }
}

function renderAIResponse(text) {
  const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let codeBlocks = [];
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const beforeText = text.substring(lastIndex, match.index);
    if (beforeText.trim()) {
      addAIMsg("bot", "<p>" + escapeHtml(beforeText).replace(/\n/g, "<br>") + "</p>");
    }

    const lang = match[1] || "";
    const filename = match[2] || "";
    const code = match[3];

    const blockData = { filename: filename || guessFilename(lang), code, lang };

    // Build code block with header
    let html = "";
    if (blockData.filename) {
      html += `<div class="code-block-header"><span class="code-block-filename">${escapeHtml(blockData.filename)}</span><span class="code-block-lang">${escapeHtml(lang)}</span></div>`;
    }
    html += `<pre><code>${escapeHtml(code)}</code></pre>`;

    if (blockData.filename) {
      html += `<button class="apply-btn" data-idx="${codeBlocks.length}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Apply to ${escapeHtml(blockData.filename)}
      </button>`;
    }

    codeBlocks.push(blockData);
    const msgEl = addAIMsg("bot", html);

    const applyBtn = msgEl.querySelector(".apply-btn");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        const idx = parseInt(applyBtn.dataset.idx);
        const block = codeBlocks[idx];
        if (block && block.filename) {
          applyCodeToFile(block.filename, block.code, block.lang);
          applyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Applied!`;
          applyBtn.classList.add("applied");
          applyBtn.disabled = true;
        }
      });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.substring(lastIndex);
  if (remaining.trim()) {
    addAIMsg("bot", "<p>" + escapeHtml(remaining).replace(/\n/g, "<br>") + "</p>");
  }

  // If multiple code blocks, add "Apply All" button
  if (codeBlocks.filter(b => b.filename).length > 1) {
    const applyAllEl = addAIMsg("bot",
      `<button class="apply-all-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        Apply All ${codeBlocks.filter(b => b.filename).length} Files
      </button>`
    );
    const applyAllBtn = applyAllEl.querySelector(".apply-all-btn");
    applyAllBtn.addEventListener("click", () => {
      for (const block of codeBlocks) {
        if (block.filename) {
          applyCodeToFile(block.filename, block.code, block.lang);
        }
      }
      // Mark all individual apply buttons as applied
      aiMessages.querySelectorAll(".apply-btn:not(.applied)").forEach(btn => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Applied!`;
        btn.classList.add("applied");
        btn.disabled = true;
      });
      applyAllBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> All Applied!`;
      applyAllBtn.disabled = true;
    });
  }
}

function guessFilename(lang) {
  // Try to match against existing project files first
  if (activeProject) {
    const files = Object.keys(activeProject.files).filter(f => !f.endsWith("/.folder"));
    const extMap = { html: [".html", ".htm"], css: [".css"], javascript: [".js"], js: [".js"], python: [".py"], json: [".json"] };
    const exts = extMap[lang] || [];
    for (const ext of exts) {
      const match = files.find(f => f.endsWith(ext));
      if (match) return match;
    }
  }
  const map = { html: "index.html", css: "style.css", javascript: "script.js", js: "script.js", python: "main.py", json: "data.json" };
  return map[lang] || null;
}

async function applyCodeToFile(filename, code, lang) {
  if (!activeProject) return;
  const ext = filename.split(".").pop().toLowerCase();
  const langMap = { html: "html", css: "css", js: "javascript", json: "json", py: "python", md: "markdown" };

  const isNew = !activeProject.files[filename];
  activeProject.files[filename] = { content: code, language: langMap[ext] || lang || "text" };

  const dp = diskPath(filename);
  if (dp) await fsWrite(dp, code);

  saveProjects();
  renderFileTree();

  if (!openTabs.includes(filename)) openTabs.push(filename);
  activeFile = filename;
  activeProject.activeTab = filename;
  activeProject.openTabs = [...openTabs];
  renderTabs();
  loadFileInEditor(filename);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ══════════════════════════════
//  RESIZABLE PANELS
// ══════════════════════════════
document.querySelectorAll(".resize-handle").forEach(handle => {
  let startX, startY, startSize, target;
  const resizeType = handle.dataset.resize;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;

    if (resizeType === "sidebar") {
      target = document.getElementById("ide-sidebar");
      startSize = target.offsetWidth;
    } else if (resizeType === "ai-panel") {
      target = document.getElementById("ide-ai-panel");
      startSize = target.offsetWidth;
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (e) => {
      if (resizeType === "sidebar") {
        target.style.width = Math.max(140, Math.min(400, startSize + (e.clientX - startX))) + "px";
      } else if (resizeType === "ai-panel") {
        target.style.width = Math.max(260, Math.min(700, startSize - (e.clientX - startX))) + "px";
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (cmEditor) cmEditor.refresh();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
});

// ══════════════════════════════
//  RIGHT-CLICK CONTEXT MENU
// ══════════════════════════════
let activeContextMenu = null;

function showContextMenu(x, y, items) {
  closeContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.left = Math.min(x, window.innerWidth - 180) + "px";
  menu.style.top = Math.min(y, window.innerHeight - items.length * 35) + "px";

  for (const item of items) {
    if (item === "---") {
      const sep = document.createElement("div");
      sep.className = "context-menu-sep";
      menu.appendChild(sep);
      continue;
    }
    const el = document.createElement("div");
    el.className = "context-menu-item" + (item.danger ? " danger" : "");
    el.textContent = item.label;
    el.addEventListener("click", () => { closeContextMenu(); item.action(); });
    menu.appendChild(el);
  }

  document.body.appendChild(menu);
  activeContextMenu = menu;
}

function closeContextMenu() {
  if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
}

document.addEventListener("click", closeContextMenu);
document.addEventListener("contextmenu", (e) => {
  const fileItem = e.target.closest(".file-item");
  const folderItem = e.target.closest(".folder-item");
  const editorArea = e.target.closest(".CodeMirror");
  const tabItem = e.target.closest(".tab");

  if (!fileItem && !folderItem && !editorArea && !tabItem) return;
  e.preventDefault();
  closeContextMenu();

  if (fileItem) {
    const allFileItems = [...fileTree.querySelectorAll(".file-item")];
    const allFiles = Object.keys(activeProject.files).filter(f => !f.endsWith("/.folder")).sort();
    const displayName = fileItem.querySelector("span:nth-child(2)")?.textContent?.replace(/ \u25CF$/, "");
    const filename = allFiles.find(f => f === displayName || f.endsWith("/" + displayName)) || displayName;
    if (!filename) return;

    showContextMenu(e.clientX, e.clientY, [
      { label: "Open", action: () => openFile(filename) },
      { label: "Rename...", action: () => renameFilePrompt(filename) },
      { label: "Copy Path", action: () => { navigator.clipboard.writeText(filename); } },
      "---",
      { label: "Delete", danger: true, action: () => deleteFile(filename) },
    ]);
  } else if (folderItem) {
    const folderName = folderItem.querySelector("span:nth-child(2)")?.textContent;
    if (!folderName) return;
    showContextMenu(e.clientX, e.clientY, [
      { label: "Rename Folder...", action: () => renameFolderPrompt(folderName) },
      { label: "New File in " + folderName, action: () => newFileInFolder(folderName) },
      "---",
      { label: "Delete Folder", danger: true, action: () => deleteFolderPrompt(folderName) },
    ]);
  } else if (tabItem) {
    const tabLabel = tabItem.querySelector("span")?.textContent?.replace(/ \u25CF$/, "");
    if (!tabLabel) return;
    const filename = openTabs.find(t => t.endsWith(tabLabel)) || tabLabel;
    showContextMenu(e.clientX, e.clientY, [
      { label: "Close", action: () => closeTab(filename) },
      { label: "Close Others", action: () => { openTabs = [filename]; activeFile = filename; renderTabs(); } },
      { label: "Close All", action: () => { openTabs = []; activeFile = Object.keys(activeProject.files)[0]; openTabs = [activeFile]; renderTabs(); renderFileTree(); loadFileInEditor(activeFile); } },
      "---",
      { label: "Copy Path", action: () => { navigator.clipboard.writeText(filename); } },
    ]);
  } else if (editorArea) {
    showContextMenu(e.clientX, e.clientY, [
      { label: "Cut", action: () => { if (cmEditor) { const sel = cmEditor.getSelection(); navigator.clipboard.writeText(sel); cmEditor.replaceSelection(""); } } },
      { label: "Copy", action: () => { if (cmEditor) navigator.clipboard.writeText(cmEditor.getSelection()); } },
      { label: "Paste", action: async () => { if (cmEditor) { const text = await navigator.clipboard.readText(); cmEditor.replaceSelection(text); } } },
      "---",
      { label: "Select All", action: () => { if (cmEditor) cmEditor.execCommand("selectAll"); } },
      { label: "Search (Ctrl+F)", action: () => openSearchModal() },
    ]);
  }
});

async function renameFilePrompt(oldName) {
  const newName = await orbixPrompt("New filename:", oldName, "Rename File");
  if (!newName || newName === oldName) return;
  if (activeProject.files[newName]) return;
  activeProject.files[newName] = { ...activeProject.files[oldName] };
  delete activeProject.files[oldName];
  if (activeFile === oldName) activeFile = newName;
  openTabs = openTabs.map(t => t === oldName ? newName : t);
  activeProject.openTabs = [...openTabs];
  activeProject.activeTab = activeFile;
  saveProjects();
  renderFileTree();
  renderTabs();
  loadFileInEditor(activeFile);

  if (activeProject.savePath) {
    const oldPath = activeProject.savePath + "/" + oldName;
    const newPath = activeProject.savePath + "/" + newName;
    await fsDelete(oldPath);
    await fsWrite(newPath, activeProject.files[newName].content);
  }
}

async function renameFolderPrompt(oldFolder) {
  const newFolder = await orbixPrompt("New folder name:", oldFolder, "Rename Folder");
  if (!newFolder || newFolder === oldFolder) return;

  const filesToRename = Object.keys(activeProject.files).filter(f => f.startsWith(oldFolder + "/"));
  for (const oldFile of filesToRename) {
    const newFile = newFolder + oldFile.slice(oldFolder.length);
    activeProject.files[newFile] = activeProject.files[oldFile];
    delete activeProject.files[oldFile];
    if (activeFile === oldFile) activeFile = newFile;
    openTabs = openTabs.map(t => t === oldFile ? newFile : t);
  }

  activeProject.openTabs = [...openTabs];
  activeProject.activeTab = activeFile;
  saveProjects();
  renderFileTree();
  renderTabs();
  if (activeFile) loadFileInEditor(activeFile);
}

async function deleteFolderPrompt(folder) {
  const filesInFolder = Object.keys(activeProject.files).filter(f => f.startsWith(folder + "/"));
  const ok = await orbixConfirm('Delete folder "' + folder + '" and its ' + filesInFolder.length + ' file(s)?', "Delete Folder");
  if (!ok) return;

  for (const f of filesInFolder) {
    delete activeProject.files[f];
    openTabs = openTabs.filter(t => t !== f);
    dirtyFiles.delete(f);
  }
  if (!activeProject.files[activeFile]) {
    activeFile = openTabs[0] || Object.keys(activeProject.files)[0] || null;
  }
  activeProject.openTabs = [...openTabs];
  activeProject.activeTab = activeFile;
  saveProjects();
  renderFileTree();
  renderTabs();
  if (activeFile) loadFileInEditor(activeFile);

  if (activeProject.savePath) {
    await fsDelete(activeProject.savePath + "/" + folder);
  }
}

async function newFileInFolder(folder) {
  const name = await orbixPrompt("New file name:", "", "New File in " + folder);
  if (!name) return;
  const fullName = folder + "/" + name;
  if (activeProject.files[fullName]) return;
  const ext = name.split(".").pop().toLowerCase();
  const langMap = { html: "html", css: "css", js: "javascript", json: "json", py: "python", md: "markdown", txt: "text" };
  activeProject.files[fullName] = { content: "", language: langMap[ext] || "text" };

  const dp = diskPath(fullName);
  if (dp) await fsWrite(dp, "");

  saveProjects();
  renderFileTree();
  openFile(fullName);
}

// ══════════════════════════════
//  INIT
// ══════════════════════════════
renderProjectList();
initEditor();

const hashProject = window.location.hash.slice(1);
if (hashProject) {
  const proj = projects.find(p => p.id === hashProject);
  if (proj) openProject(proj);
}
