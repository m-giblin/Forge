/**
 * Forge Browser SDK
 * Auto-captures unhandled errors and promise rejections and files them as
 * issues in your Forge workspace. Drop this before </body> and call init().
 *
 * Security note: the API key embedded here needs only the issues:write scope.
 * Anyone who finds it can file bug reports — they cannot read issues, alter
 * status, or access any other data.
 *
 * Usage:
 *   <script src="/forge-sdk.js"></script>
 *   <script>
 *     ForgeSDK.init({
 *       apiKey: "fk_...",
 *       endpoint: "https://your-forge.com/api/v1/issues",
 *       projectKey: "WEB",          // optional, defaults to your workspace default
 *       environment: "production",  // optional
 *       ignoreErrors: [/ResizeObserver/, /ChunkLoadError/],  // optional
 *       sessionReplay: true,        // optional, opt-in (FORGE-71) — see below
 *     });
 *   </script>
 *
 * Session replay (opt-in): when enabled, the SDK loads rrweb from a CDN and
 * keeps a silent, in-memory rolling buffer of the last ~45s of DOM events.
 * Nothing is ever sent anywhere unless an issue is actually filed — same
 * privacy model as Marker.io. All input fields are masked by default
 * (rrweb's maskAllInputs). On a captured error, the buffered events are
 * uploaded as an attachment on the new issue, and a note is appended to the
 * issue description pointing at it.
 */
(function (global) {
  "use strict";

  // Guard against this file executing more than once on the same page. In an
  // SPA, a <script src="forge-sdk.js"> placed anywhere other than the true
  // root layout can get re-inserted on client-side route changes — each
  // re-execution of this IIFE would otherwise silently reset every
  // module-scope variable (replayBuffer, queue, cfg) and start a brand-new
  // rrweb.record() session, discarding whatever had already been captured.
  // Real symptom seen in production: 30+ seconds of real user interaction
  // across several page navigations, but the attached replay showed only a
  // fraction of a second — because the buffer had been silently reset by a
  // reload of this script moments before the bug was reported. First
  // execution wins; every later one is a no-op so the original recording
  // session (and its accumulated buffer) keeps running undisturbed.
  if (global.__forgeSdkInstalled) return;
  global.__forgeSdkInstalled = true;

  // NOTE: two third-party CDN dead ends before landing here. (1) jsDelivr's
  // "rrweb.min.js" auto-resolves to the ESM build (`export {...}`), which
  // can't run in a plain <script> tag and never defines window.rrweb, with no
  // load error to catch. (2) jsDelivr serves the real UMD build
  // (rrweb.umd.min.cjs) with Content-Type: application/node because of the
  // .cjs extension — browsers refuse to execute that under strict MIME
  // checking, even though the content is valid JS. Rather than depend on any
  // CDN's file-serving quirks (or a customer's CSP allowing a third-party
  // domain at all), the recorder is self-hosted alongside this script and
  // resolved relative to wherever this script itself was loaded from.
  var SDK_SRC = (document.currentScript && document.currentScript.src) || "";
  var RRWEB_SRC = SDK_SRC ? SDK_SRC.replace(/forge-sdk\.js(\?.*)?$/, "rrweb-recorder.min.js") : "";
  var REPLAY_WINDOW_MS = 45000;
  var REPLAY_CONTENT_TYPE = "application/x-forge-replay+json";

  var cfg = null;
  var queue = [];
  var sending = false;

  var replayBuffer = [];
  var replayReady = false;

  function fingerprint(type, message, frame) {
    return btoa(unescape(encodeURIComponent([type, message, frame].join("|")))).slice(0, 128);
  }

  function firstFrame(stack) {
    if (!stack) return "";
    var lines = stack.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l && !l.startsWith("Error")) return l.slice(0, 200);
    }
    return "";
  }

  function shouldIgnore(message) {
    if (!cfg || !cfg.ignoreErrors) return false;
    for (var i = 0; i < cfg.ignoreErrors.length; i++) {
      if (cfg.ignoreErrors[i].test && cfg.ignoreErrors[i].test(message)) return true;
      if (cfg.ignoreErrors[i] === message) return true;
    }
    return false;
  }

  // --- Session replay (FORGE-71) -------------------------------------------

  function trimReplayBuffer() {
    var cutoff = Date.now() - REPLAY_WINDOW_MS;
    while (replayBuffer.length && replayBuffer[0].timestamp < cutoff) replayBuffer.shift();
  }

  function startReplayCapture() {
    if (!global.rrweb || replayReady) return;
    replayReady = true;
    global.rrweb.record({
      emit: function (event) {
        replayBuffer.push(event);
        trimReplayBuffer();
      },
      maskAllInputs: true,
      checkoutEveryNms: 15000,
    });
  }

  function loadReplayScript() {
    if (global.rrweb) { startReplayCapture(); return; }
    if (!RRWEB_SRC) {
      console.warn("[ForgeSDK] Session replay enabled but couldn't resolve forge-sdk.js's own URL (document.currentScript unavailable) — continuing without it.");
      return;
    }
    var s = document.createElement("script");
    s.src = RRWEB_SRC;
    s.async = true;
    s.onload = startReplayCapture;
    s.onerror = function () {
      console.warn("[ForgeSDK] Session replay enabled but rrweb failed to load — continuing without it.");
    };
    document.head.appendChild(s);
  }

  /** Upload the buffered replay events as an attachment, then note it on the issue description. */
  function attachReplay(issueId, issueKey, originalDescription, events) {
    if (!events || events.length === 0) return;
    var blob = new Blob([JSON.stringify(events)], { type: REPLAY_CONTENT_TYPE });
    var form = new FormData();
    form.append("file", blob, "session-replay.json");

    var attachmentsUrl = cfg.endpoint.replace(/\/$/, "") + "/" + issueId + "/attachments";
    fetch(attachmentsUrl, {
      method: "POST",
      headers: { Authorization: "Bearer " + cfg.apiKey },
      body: form,
      keepalive: true,
    })
      .then(function () {
        var note = "\n\n📹 A session replay is attached — see the Session Replay card above, showing what the user did in the ~45s before this was reported.";
        return fetch(cfg.endpoint.replace(/\/$/, "") + "/" + issueId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.apiKey },
          body: JSON.stringify({ description: (originalDescription || "") + note }),
          keepalive: true,
        });
      })
      .catch(function () {});
  }

  // --- Error capture + issue creation --------------------------------------

  function flush() {
    if (sending || queue.length === 0 || !cfg) return;
    sending = true;
    var item = queue.shift();
    var body = {
      title: item.title,
      description: item.description,
      type: "bug",
      priority: "high",
      source: "sdk",
      environment: cfg.environment || "production",
      fingerprint: item.fingerprint,
    };
    if (cfg.projectKey) body.projectKey = cfg.projectKey;

    fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(function (res) {
        if (!res.ok) {
          // Previously swallowed silently — a rejected/suspended-past-grace
          // response was invisible to the host app's own dev team unless
          // they happened to be watching the console at that exact moment.
          console.warn("[ForgeSDK] Issue was not created (status " + res.status + "). It was not filed anywhere.");
          return null;
        }
        return res.json();
      })
      .then(function (json) {
        var issue = json && json.data;
        if (issue && item.replayEvents) {
          attachReplay(issue.id, issue.key, body.description, item.replayEvents);
        }
      })
      .catch(function () {})
      .finally(function () {
        sending = false;
        if (queue.length > 0) flush();
      });
  }

  function capture(type, message, stack) {
    if (!cfg) return;
    if (shouldIgnore(message)) return;
    var fp = fingerprint(type, message, firstFrame(stack));
    var item = {
      fingerprint: fp,
      title: (type ? type + ": " : "") + (message || "Unknown error").slice(0, 250),
      description:
        "**Message:** " + (message || "") + "\n\n**Stack:**\n```\n" + (stack || "").slice(0, 4000) + "\n```",
    };
    if (cfg.sessionReplay) {
      trimReplayBuffer();
      item.replayEvents = replayBuffer.slice();
    }
    queue.push(item);
    if (queue.length > 20) queue.length = 20; // cap to avoid runaway queues
    flush();
  }

  function onError(event) {
    // The listener is registered with capture:true so it also sees DOM
    // resource-load failures bubbling up (a broken <img>, a blocked <script>,
    // a missing favicon) — those fire as plain Events with no .message or
    // .error, and previously got filed as a useless "Error: [object Event]"
    // bug. Real JS errors always come through as ErrorEvent with a message;
    // skip anything that isn't one.
    if (!(event instanceof ErrorEvent) && typeof event.message !== "string") return;
    var err = event.error;
    capture(
      err && err.name ? err.name : "Error",
      err && err.message ? err.message : event.message || String(event),
      err && err.stack ? err.stack : ""
    );
  }

  function onUnhandledRejection(event) {
    var reason = event.reason;
    var message = reason instanceof Error
      ? reason.message
      : typeof reason === "string" ? reason : JSON.stringify(reason);
    var stack = reason instanceof Error ? reason.stack : "";
    capture(reason instanceof Error ? reason.name : "UnhandledRejection", message, stack);
  }

  global.ForgeSDK = {
    init: function (options) {
      if (!options || !options.apiKey || !options.endpoint) {
        console.warn("[ForgeSDK] init() requires apiKey and endpoint.");
        return;
      }
      cfg = options;
      global.addEventListener("error", onError, true);
      global.addEventListener("unhandledrejection", onUnhandledRejection, true);
      if (cfg.sessionReplay) loadReplayScript();
    },

    /** Manually capture an error (e.g. from a try/catch block). */
    captureError: function (error, context) {
      if (!error) return;
      var message = error instanceof Error ? error.message : String(error);
      var stack = error instanceof Error ? error.stack : "";
      var type = error instanceof Error ? error.name : "Error";
      if (context) message = "[" + context + "] " + message;
      capture(type, message, stack);
    },

    /** Manually capture a message string. */
    captureMessage: function (message, level) {
      capture(level || "Info", message, "");
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
