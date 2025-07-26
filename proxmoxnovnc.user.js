// ==UserScript==
// @name         noVNC Paste for Proxmox
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Read & Paste the whole clipboard , count chars , with enhanced visual feedback
// @author       Wolfyrion
// @match        https://*/:8006/*
// @include      /^https?:\/\/.*:8006\/.*novnc.*/
// @require      http://code.jquery.com/jquery-3.3.1.min.js
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // SVG icon for the paste button (Material Icons: content_paste)
    const PASTE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>';

    // Load saved state or default to true
    let pasteMode = GM_getValue('pasteMode', true);
    let statusTimeout;
    let isProcessingPaste = false;
    let toggleButton; // Variable to hold the button element

    /**
     * Shows a temporary status message for actions like pasting or errors.
     * @param {string} message - The text to display.
     * @param {boolean} [isError=false] - If true, displays the message with an error color.
     */
    function showStatus(message, isError = false) {
        clearTimeout(statusTimeout);

        const existing = document.getElementById("paste-action-indicator");
        if (existing) existing.remove();

        const div = document.createElement("div");
        div.id = "paste-action-indicator";
        div.textContent = message;
        div.style.position = "fixed";
        div.style.bottom = "60px";
        div.style.right = "20px";
        div.style.backgroundColor = isError ? "#d32f2f" : "#388e3c";
        div.style.color = "white";
        div.style.padding = "8px 16px";
        div.style.borderRadius = "8px";
        div.style.fontFamily = "Arial, sans-serif";
        div.style.fontSize = "14px";
        div.style.zIndex = "9998";
        div.style.opacity = "0.9";
        div.style.boxShadow = "0 0 8px rgba(0,0,0,0.3)";
        div.style.transition = "opacity 0.3s ease";
        div.style.maxWidth = "300px";
        div.style.wordWrap = "break-word";

        document.body.appendChild(div);

        statusTimeout = setTimeout(() => {
            div.style.opacity = "0";
            setTimeout(() => div.remove(), 300);
        }, isError ? 5000 : 3000);
    }

    /**
     * Updates the background color of the toggle button based on the current pasteMode.
     */
    function updateToggleButton() {
        if (!toggleButton) return;
        toggleButton.style.backgroundColor = pasteMode ? "#388e3c" : "#d32f2f";
    }

    /**
     * Creates and adds the icon toggle button to the page.
     */
    function addToggleButton() {
        toggleButton = document.createElement("div");
        toggleButton.id = "paste-toggle-button";
        toggleButton.innerHTML = PASTE_ICON_SVG; // Set the button's content to the SVG icon
        toggleButton.style.position = "fixed";
        toggleButton.style.top = "20px";
        toggleButton.style.right = "20px";
        toggleButton.style.width = "40px"; // Set a fixed width
        toggleButton.style.height = "40px"; // Set a fixed height
        toggleButton.style.borderRadius = "50%"; // Make it a circle
        toggleButton.style.zIndex = "9999";
        toggleButton.style.cursor = "pointer";
        toggleButton.style.boxShadow = "0 0 8px rgba(0,0,0,0.4)";
        toggleButton.style.userSelect = "none";
        toggleButton.style.display = "flex"; // Use flexbox to center the icon
        toggleButton.style.alignItems = "center";
        toggleButton.style.justifyContent = "center";
        toggleButton.style.transition = "background-color 0.2s ease";

        // Set initial state
        updateToggleButton();

        // Add click listener to toggle the mode
        toggleButton.addEventListener("click", () => {
            pasteMode = !pasteMode;
            GM_setValue('pasteMode', pasteMode);
            updateToggleButton();
            showStatus("Paste Mode: " + (pasteMode ? "ON" : "OFF")); // Show temporary feedback
        });

        document.body.appendChild(toggleButton);
    }


    async function sendString(text) {
        const el = document.getElementById("canvas-id");
        if (!el) {
            const errorMsg = "noVNC canvas element not found";
            console.error(errorMsg);
            showStatus("Paste Failed: Canvas not found", true);
            GM_notification({
                title: "noVNC Paste Error",
                text: errorMsg,
                silent: true
            });
            return false;
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        try {
            isProcessingPaste = true;
            showStatus("Pasting...", false);

            el.focus();
            await sleep(50);

            const charCount = text.length;
            let processed = 0;

            for (const char of text) {
                if (char === '\n') {
                    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
                    await sleep(10);
                    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
                } else {
                    const needsShift = char.match(/[A-Z!@#$%^&*()_+{}:"<>?~|]/);

                    if (needsShift) {
                        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", bubbles: true }));
                        await sleep(10);
                        el.dispatchEvent(new KeyboardEvent("keydown", { key: char.toLowerCase(), shiftKey: true, bubbles: true }));
                        await sleep(10);
                        el.dispatchEvent(new KeyboardEvent("keyup", { key: char.toLowerCase(), shiftKey: true, bubbles: true }));
                        await sleep(10);
                        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", code: "ShiftLeft", bubbles: true }));
                    } else {
                        el.dispatchEvent(new KeyboardEvent("keydown", { key: char.toLowerCase(), bubbles: true }));
                        await sleep(10);
                        el.dispatchEvent(new KeyboardEvent("keyup", { key: char.toLowerCase(), bubbles: true }));
                    }
                }
                processed++;

                if (processed % 10 === 0) {
                    showStatus(`Pasting... (${processed}/${charCount})`, false);
                }

                await sleep(20);
            }

            showStatus(`Pasted ${charCount} characters successfully`, false);
            return true;
        } catch (error) {
            const errorMsg = `Paste Failed: ${error.message}`;
            console.error(errorMsg, error);
            showStatus(errorMsg, true);
            GM_notification({
                title: "Paste Error",
                text: errorMsg,
                silent: true
            });
            return false;
        } finally {
            setTimeout(() => {
                isProcessingPaste = false;
            }, 100);
        }
    }

    function initCanvas() {
        const canvas = $("canvas").first();
        if (canvas.length > 0 && !canvas.attr("id")) {
            canvas.attr("id", "canvas-id");

            canvas.on("contextmenu", (e) => {
                if (pasteMode) {
                    e.preventDefault();
                    return false;
                }
            });

            canvas.on("mousedown", (e) => {
                if (isProcessingPaste) {
                    e.preventDefault();
                    return false;
                }

                if (e.button === 2 && pasteMode) {
                    e.preventDefault();
                    showStatus("Reading clipboard...", false);

                    navigator.clipboard.readText().then(text => {
                        if (text && text.length > 0) {
                            const trimmedText = text.trim();
                            if (trimmedText.length > 1000) {
                                showStatus(`Pasting large text (${trimmedText.length} chars)...`, false);
                            }
                            sendString(trimmedText);
                        } else {
                            showStatus("Clipboard is empty.", true);
                        }
                    }).catch(err => {
                        const errorMsg = "Clipboard access denied. Check permissions.";
                        console.error(errorMsg, err);
                        showStatus(errorMsg, true);
                        GM_notification({
                            title: "Clipboard Error",
                            text: errorMsg,
                            silent: true
                        });
                    });
                    return false;
                }
            });

            canvas.on("mouseup", (e) => {
                if (isProcessingPaste) {
                    e.preventDefault();
                    return false;
                }
            });
        }
    }

    $(document).ready(function () {
        // Add the toggle button to the UI
        addToggleButton();
        initCanvas();

        const canvasCheckInterval = setInterval(() => {
            if ($("canvas").length > 0) {
                initCanvas();
                clearInterval(canvasCheckInterval);
            }
        }, 1000);

        // Listen for Alt+P to toggle the mode
        $(document).on("keydown", (e) => {
            if (e.altKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                pasteMode = !pasteMode;
                GM_setValue('pasteMode', pasteMode);
                updateToggleButton(); // Update the button's appearance
                showStatus("Paste Mode: " + (pasteMode ? "ON" : "OFF")); // Show temporary feedback
            }
        });

        console.log("noVNC Paste Script Loaded (v1.1) (Paste Mode: " + (pasteMode ? "ON" : "OFF") + ")");
    });

})();
