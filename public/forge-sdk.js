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
 *     });
 *   </script>
 */
(function (global) {
  "use strict";

  var cfg = null;
  var queue = [];
  var sending = false;

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
    queue.push({
      fingerprint: fp,
      title: (type ? type + ": " : "") + (message || "Unknown error").slice(0, 250),
      description:
        "**Message:** " + (message || "") + "\n\n**Stack:**\n```\n" + (stack || "").slice(0, 4000) + "\n```",
    });
    if (queue.length > 20) queue.length = 20; // cap to avoid runaway queues
    flush();
  }

  function onError(event) {
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
