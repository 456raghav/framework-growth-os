(function () {
  "use strict";

  // Find this script's own tag to read the client ID and host URL
  // off its attributes — this is how the snippet knows which client
  // it belongs to without any manual config beyond pasting the tag.
  var scriptTag = document.currentScript;
  if (!scriptTag) {
    console.error("[FGOS Widget] Could not find script tag.");
    return;
  }

  var clientId = scriptTag.getAttribute("data-client-id");
  var hostUrl = scriptTag.getAttribute("data-host") || "http://localhost:3000";

  if (!clientId) {
    console.error("[FGOS Widget] Missing data-client-id attribute.");
    return;
  }

  // ---- Create the floating bubble button ----
  var bubble = document.createElement("button");
  bubble.setAttribute("aria-label", "Open chat assistant");
  bubble.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  bubble.style.cssText = [
    "position: fixed",
    "bottom: 24px",
    "right: 24px",
    "width: 60px",
    "height: 60px",
    "border-radius: 50%",
    "background: #0D0D0D",
    "border: none",
    "cursor: pointer",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "box-shadow: 0 4px 16px rgba(0,0,0,0.25)",
    "z-index: 2147483646",
    "transition: transform 0.15s ease",
  ].join(";");
  bubble.onmouseenter = function () {
    bubble.style.transform = "scale(1.06)";
  };
  bubble.onmouseleave = function () {
    bubble.style.transform = "scale(1)";
  };

  // ---- Create the iframe container (hidden until opened) ----
  var frameWrapper = document.createElement("div");
  frameWrapper.style.cssText = [
    "position: fixed",
    "bottom: 96px",
    "right: 24px",
    "width: 380px",
    "height: 600px",
    "max-width: calc(100vw - 32px)",
    "max-height: calc(100vh - 120px)",
    "border-radius: 16px",
    "overflow: hidden",
    "box-shadow: 0 8px 32px rgba(0,0,0,0.25)",
    "z-index: 2147483647",
    "display: none",
  ].join(";");

  var iframe = document.createElement("iframe");
  // Pass the PARENT page's own origin explicitly as a query parameter.
  // This is more reliable than relying on Referer headers, which only
  // ever report the immediate caller of a request — when the widget
  // page itself fetches /api/embed-config, the Referer shows the widget's
  // OWN url (localhost:3000/widget/...), not the page that embedded it
  // one level up. embed.js, by contrast, runs directly in the client's
  // real page and knows its true origin with certainty via window.location.
  var parentOrigin = window.location.origin;
  iframe.src =
    hostUrl + "/widget/" + clientId + "?parentOrigin=" + encodeURIComponent(parentOrigin);
  iframe.style.cssText = "width: 100%; height: 100%; border: none;";
  iframe.title = "Chat assistant";

  frameWrapper.appendChild(iframe);

  var isOpen = false;
  bubble.addEventListener("click", function () {
    isOpen = !isOpen;
    frameWrapper.style.display = isOpen ? "block" : "none";
  });

  document.body.appendChild(bubble);
  document.body.appendChild(frameWrapper);
})();