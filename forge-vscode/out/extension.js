"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
// ── Config helpers ───────────────────────────────────────────────────────────
function cfg() {
    const c = vscode.workspace.getConfiguration("forge");
    return {
        apiUrl: (c.get("apiUrl") ?? "https://useforge.dev").replace(/\/$/, ""),
        apiKey: c.get("apiKey") ?? "",
        projectKey: c.get("projectKey") ?? "",
        tenantSlug: c.get("tenantSlug") ?? "",
    };
}
function isConfigured() {
    const { apiUrl, apiKey, tenantSlug } = cfg();
    return !!(apiUrl && apiKey && tenantSlug);
}
// ── HTTP fetch (no node-fetch dep) ───────────────────────────────────────────
function apiFetch(path) {
    const { apiUrl, apiKey } = cfg();
    const fullUrl = `${apiUrl}${path}`;
    const parsed = new URL(fullUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        }, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk.toString(); });
            res.on("end", () => {
                if (res.statusCode === 401) {
                    reject(new Error("401: Invalid API key. Check your forge.apiKey setting."));
                    return;
                }
                if (res.statusCode === 403) {
                    reject(new Error("403: Forbidden. Check your API key permissions."));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                }
                catch {
                    reject(new Error(`Non-JSON response (${res.statusCode}): ${body.slice(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        req.setTimeout(10000, () => { req.destroy(new Error("Request timed out")); });
        req.end();
    });
}
async function apiPost(path, body) {
    const { apiUrl, apiKey } = cfg();
    const fullUrl = `${apiUrl}${path}`;
    const parsed = new URL(fullUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
            },
        }, (res) => {
            let raw = "";
            res.on("data", (chunk) => { raw += chunk.toString(); });
            res.on("end", () => {
                try {
                    const parsed2 = JSON.parse(raw);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(parsed2.error ?? `HTTP ${res.statusCode}`));
                    }
                    else {
                        resolve(parsed2);
                    }
                }
                catch {
                    reject(new Error(`Non-JSON response: ${raw.slice(0, 200)}`));
                }
            });
        });
        req.on("error", reject);
        req.setTimeout(10000, () => { req.destroy(new Error("Request timed out")); });
        req.write(payload);
        req.end();
    });
}
// ── Tree item ────────────────────────────────────────────────────────────────
const PRIORITY_ICON = {
    urgent: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "⚪",
};
const STATUS_ICON = {
    backlog: "○",
    todo: "◻",
    in_progress: "◈",
    in_review: "◎",
    done: "✓",
};
class IssueItem extends vscode.TreeItem {
    constructor(issue, slug, apiUrl) {
        super(`${STATUS_ICON[issue.status] ?? "○"} ${issue.project_key}-${issue.number}  ${issue.title}`, vscode.TreeItemCollapsibleState.None);
        this.issue = issue;
        this.contextValue = "forgeIssue";
        this.tooltip = new vscode.MarkdownString(`**${issue.project_key}-${issue.number}**: ${issue.title}\n\n` +
            `**Status:** ${issue.status.replace(/_/g, " ")}\n\n` +
            `**Priority:** ${PRIORITY_ICON[issue.priority] ?? ""} ${issue.priority}\n\n` +
            `**Type:** ${issue.type}\n\n` +
            (issue.assignee_name ? `**Assignee:** ${issue.assignee_name}\n\n` : "") +
            `**Updated:** ${new Date(issue.updated_at).toLocaleDateString()}`);
        const issueUrl = `${apiUrl}/${slug}/issues/${issue.id}`;
        this.command = {
            command: "vscode.open",
            title: "Open in Browser",
            arguments: [vscode.Uri.parse(issueUrl)],
        };
        this.description = issue.assignee_name ?? "";
        this.iconPath = new vscode.ThemeIcon(issue.status === "done" ? "pass" :
            issue.status === "in_progress" ? "loading~spin" :
                issue.status === "in_review" ? "eye" :
                    issue.status === "backlog" ? "circle-outline" :
                        "circle-filled");
    }
}
class StatusGroupItem extends vscode.TreeItem {
    constructor(status, issues, slug, apiUrl) {
        const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        super(`${STATUS_ICON[status] ?? "○"} ${label} (${issues.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.status = status;
        this.issues = issues;
        this.slug = slug;
        this.apiUrl = apiUrl;
        this.contextValue = "forgeStatusGroup";
    }
}
class MessageItem extends vscode.TreeItem {
    constructor(label, description) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = description;
        this.iconPath = new vscode.ThemeIcon("info");
    }
}
class IssuesProvider {
    constructor(myIssues) {
        this.myIssues = myIssues;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.groups = [];
        this.loading = false;
        this.errorMsg = null;
        this.filterMyIssues = false;
        this.filterMyIssues = myIssues;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    async load() {
        if (!isConfigured())
            return;
        this.loading = true;
        this.errorMsg = null;
        this._onDidChangeTreeData.fire();
        const { projectKey, tenantSlug } = cfg();
        let url = `/api/v1/issues?limit=200&project=${projectKey}`;
        if (this.filterMyIssues)
            url += "&assignee=me";
        try {
            const res = await apiFetch(url);
            const issues = (res.data ?? []);
            const { apiUrl } = cfg();
            const ORDER = ["in_progress", "in_review", "todo", "backlog", "done"];
            const grouped = new Map();
            for (const s of ORDER)
                grouped.set(s, []);
            for (const issue of issues) {
                const key = issue.status in { in_progress: 1, in_review: 1, todo: 1, backlog: 1, done: 1 }
                    ? issue.status : "backlog";
                grouped.get(key).push(issue);
            }
            this.groups = [];
            for (const [status, grpIssues] of grouped.entries()) {
                if (grpIssues.length > 0) {
                    this.groups.push(new StatusGroupItem(status, grpIssues, tenantSlug, apiUrl));
                }
            }
        }
        catch (e) {
            this.errorMsg = e instanceof Error ? e.message : String(e);
        }
        finally {
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!isConfigured()) {
            return [new MessageItem("Forge not configured", "Click ⚙ to set up")];
        }
        if (this.loading) {
            return [new MessageItem("Loading issues…")];
        }
        if (this.errorMsg) {
            return [new MessageItem("Error: " + this.errorMsg.slice(0, 80))];
        }
        if (!element) {
            if (this.groups.length === 0) {
                return [new MessageItem("No issues found", "Try changing your project key")];
            }
            return this.groups;
        }
        if (element instanceof StatusGroupItem) {
            const { apiUrl } = cfg();
            return element.issues.map((i) => new IssueItem(i, element.slug, apiUrl));
        }
        return [];
    }
}
// ── Create issue panel ───────────────────────────────────────────────────────
async function showCreateIssueForm(context) {
    const { apiUrl, projectKey, tenantSlug } = cfg();
    const panel = vscode.window.createWebviewPanel("forge.createIssue", "New Forge Issue", vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
    panel.webview.html = createIssueHtml(projectKey);
    panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.command !== "submit")
            return;
        if (!msg.title.trim()) {
            void vscode.window.showErrorMessage("Title is required.");
            return;
        }
        try {
            const result = await apiPost("/api/v1/issues", {
                projectKey: projectKey || undefined,
                title: msg.title.trim(),
                description: msg.description.trim() || undefined,
                priority: msg.priority,
                type: msg.type,
            });
            const issue = result.data;
            const url = `${apiUrl}/${tenantSlug}/issues/${issue.id}`;
            void vscode.window.showInformationMessage(`Created ${issue.project_key}-${issue.number}: ${issue.title}`, "Open in Browser").then((choice) => {
                if (choice === "Open in Browser")
                    void vscode.env.openExternal(vscode.Uri.parse(url));
            });
            panel.dispose();
            void vscode.commands.executeCommand("forge.refresh");
        }
        catch (e) {
            void vscode.window.showErrorMessage("Failed to create issue: " + (e instanceof Error ? e.message : String(e)));
        }
    }, undefined, context.subscriptions);
}
function createIssueHtml(defaultProject) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Issue</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; max-width: 600px; }
    label { display: block; margin-bottom: 4px; font-size: 12px; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: .05em; }
    input, textarea, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 7px 10px; font-family: inherit; font-size: 13px; margin-bottom: 16px; }
    textarea { height: 120px; resize: vertical; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 8px 20px; font-size: 13px; cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .row { display: flex; gap: 12px; }
    .row > div { flex: 1; }
    h2 { margin: 0 0 20px; font-size: 16px; font-weight: 600; }
  </style>
</head>
<body>
  <h2>🐛 New Forge Issue</h2>
  <label>Title *</label>
  <input id="title" type="text" placeholder="Short, action-oriented title" autofocus />
  <label>Description</label>
  <textarea id="description" placeholder="Steps to reproduce, context, expected vs actual…"></textarea>
  <div class="row">
    <div>
      <label>Type</label>
      <select id="type">
        <option value="bug">Bug</option>
        <option value="feature">Feature</option>
        <option value="task" selected>Task</option>
      </select>
    </div>
    <div>
      <label>Priority</label>
      <select id="priority">
        <option value="urgent">🔴 Urgent</option>
        <option value="high">🟠 High</option>
        <option value="medium" selected>🟡 Medium</option>
        <option value="low">⚪ Low</option>
      </select>
    </div>
  </div>
  <button onclick="submit()">Create Issue</button>
  <script>
    const vscode = acquireVsCodeApi();
    function submit() {
      vscode.postMessage({
        command: 'submit',
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        priority: document.getElementById('priority').value,
        type: document.getElementById('type').value,
      });
    }
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
    });
  </script>
</body>
</html>`;
}
// ── Activation ───────────────────────────────────────────────────────────────
function activate(context) {
    const allIssuesProvider = new IssuesProvider(false);
    const myIssuesProvider = new IssuesProvider(true);
    vscode.window.registerTreeDataProvider("forge.issuesView", allIssuesProvider);
    vscode.window.registerTreeDataProvider("forge.myIssuesView", myIssuesProvider);
    function refreshAll() {
        void allIssuesProvider.load();
        void myIssuesProvider.load();
    }
    // Auto-load on activation if configured
    if (isConfigured())
        refreshAll();
    // Reload when config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("forge"))
            refreshAll();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("forge.refresh", refreshAll), vscode.commands.registerCommand("forge.configure", () => {
        void vscode.commands.executeCommand("workbench.action.openSettings", "forge.");
    }), vscode.commands.registerCommand("forge.createIssue", () => {
        void showCreateIssueForm(context);
    }), vscode.commands.registerCommand("forge.openInBrowser", (item) => {
        const { apiUrl, tenantSlug } = cfg();
        const url = `${apiUrl}/${tenantSlug}/issues/${item.issue.id}`;
        void vscode.env.openExternal(vscode.Uri.parse(url));
    }), vscode.commands.registerCommand("forge.copyIssueKey", (item) => {
        const key = `${item.issue.project_key}-${item.issue.number}`;
        void vscode.env.clipboard.writeText(key).then(() => {
            void vscode.window.showInformationMessage(`Copied ${key} to clipboard`);
        });
    }));
    // Show setup prompt if not configured
    if (!isConfigured()) {
        void vscode.window.showInformationMessage("Forge: Set your API key and workspace slug to get started.", "Open Settings").then((choice) => {
            if (choice === "Open Settings") {
                void vscode.commands.executeCommand("workbench.action.openSettings", "forge.");
            }
        });
    }
}
function deactivate() {
    // nothing to clean up
}
//# sourceMappingURL=extension.js.map