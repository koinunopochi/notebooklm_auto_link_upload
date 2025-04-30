// --- Helper Functions (to be injected) ---
function clickAddSourceButtonOnPage() {
    const buttonSelector = "button[aria-label='ソースを追加'], button[aria-label='Add source']";
    const button = document.querySelector(buttonSelector);
    if (button) {
         if (button.disabled) return 'Error: "Add Source" button is disabled.';
         try { button.click(); return "Add Source button clicked!"; }
         catch (e) { return `Error clicking Add Source: ${e.message}`; }
    } else { return 'Error: "Add Source" button not found.'; }
}

function clickWebsiteChipOnPage() {
    const xpath = "//mat-chip[.//span[normalize-space(.)='ウェブサイト' or normalize-space(.)='Website']]";
    try {
        const chip = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (chip) {
             try { chip.click(); return "Website chip clicked!"; }
             catch (e) { return `Error clicking Website chip: ${e.message}`; }
        } else { return 'Error: "Website" chip not found.'; }
    } catch (e) { return `Error finding Website chip: ${e.message}`; }
}

function fillUrlInputOnPage(urlToFill) {
    const inputSelector = "input[formcontrolname='newUrl']";
    const submitButtonSelector = "website-upload button.submit-button[type='submit']";
    const inputElement = document.querySelector(inputSelector);
    if (inputElement) {
        try {
            inputElement.value = urlToFill;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            const submitButton = document.querySelector(submitButtonSelector);
            if (submitButton) { submitButton.focus(); }
            else { inputElement.blur(); }
            return "URL input processed.";
        } catch (e) { return `Error processing input: ${e.message}`; }
    } else { return "Error: URL input field not found."; }
}

function clickInsertButtonOnPage() {
    const buttonSelector = "website-upload button.submit-button[type='submit']";
    const button = document.querySelector(buttonSelector);
    if (button) {
         if (button.disabled) { return 'Error: "Insert" button is disabled.'; }
         try { button.click(); return '"Insert" button clicked!'; }
         catch (e) { return `Error clicking Insert button: ${e.message}`; }
    } else { return 'Error: "Insert" button not found.'; }
}

// --- Sequence Function ---
async function processSingleUrlSequence(tabId, url) {
    let stepResult = '';
    const delayAfterStep1 = 1000;
    const delayAfterStep2 = 500;
    const delayAfterStep3 = 1500;
    const delayAfterStep4 = 2000; // Wait after insert

    try {
        // Step 1
        const results1 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickAddSourceButtonOnPage });
        stepResult = results1[0]?.result;
        if (!stepResult || String(stepResult).startsWith('Error:')) throw new Error(stepResult || 'Step 1 failed.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep1));

        // Step 2
        const results2 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickWebsiteChipOnPage });
        stepResult = results2[0]?.result;
         if (!stepResult || String(stepResult).startsWith('Error:')) throw new Error(stepResult || 'Step 2 failed.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep2));

        // Step 3
        const results3 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: fillUrlInputOnPage, args: [url] });
        stepResult = results3[0]?.result;
        if (!stepResult || String(stepResult).startsWith('Error:')) throw new Error(stepResult || 'Step 3 failed.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep3));

        // Step 4
        const results4 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickInsertButtonOnPage });
        stepResult = results4[0]?.result;
        if (!stepResult || String(stepResult).startsWith('Error:')) throw new Error(stepResult || 'Step 4 failed.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep4));

        return true; // Success

    } catch (error) {
        // Return the specific error message from the failed step if available
        return `Sequence Error: ${stepResult || error.message || 'Unknown error'}`;
    }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'PROCESS_URL_LIST' && message.urls) {
        (async () => {
            let tabId = sender.tab?.id;
            if (!tabId) {
                 try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    tabId = tabs[0]?.id;
                 } catch (e) { /* handle error */ }
            }

            if (!tabId) {
                 try {
                     chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: "Error: No active NotebookLM tab found." });
                 } catch(e) {/* Popup likely closed */}
                 return;
            }

            const urlsToProcess = message.urls;
            let successCount = 0;
            let failCount = 0;
            const totalUrls = urlsToProcess.length;
            const delayBetweenUrls = 2500; // Increased delay slightly

            for (let i = 0; i < totalUrls; i++) {
                const currentUrl = urlsToProcess[i];
                try {
                    chrome.runtime.sendMessage({
                        type: 'UPDATE_STATUS',
                        text: `Processing ${i + 1}/${totalUrls}: ${currentUrl.substring(0, 40)}...`,
                        isError: false
                    });
                } catch(e) {/* Popup likely closed */}

                const result = await processSingleUrlSequence(tabId, currentUrl);

                if (result === true) {
                    successCount++;
                } else {
                    failCount++;
                     try {
                         chrome.runtime.sendMessage({
                             type: 'UPDATE_STATUS',
                             text: `Failed ${i + 1}/${totalUrls}. Err: ${String(result).substring(0, 60)}...`,
                             isError: true
                            });
                     } catch(e) {/* Popup likely closed */}
                     // Optional: Add a longer delay after an error?
                     // await new Promise(resolve => setTimeout(resolve, 1000));
                }

                if (i < totalUrls - 1) {
                     await new Promise(resolve => setTimeout(resolve, delayBetweenUrls));
                }
            }

            const finalText = `Finished. Success: ${successCount}, Failed: ${failCount}`;
             try {
                 chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: finalText });
             } catch(e) {/* Popup likely closed */}

        })();
        return true; // Indicate async response

    } else if (message.type === 'FILE_SELECTED_PING') {
        // Acknowledge ping, no critical action needed. Helps keep popup alive.
        sendResponse({ status: "Ping received by background" });
        // No 'return true' here as sendResponse is called synchronously within this handler turn.
    }

    // If other synchronous message types were handled, return false or nothing.
    // If only async types handled, could return true unconditionally, but being specific is better.
    // For clarity, return true only if PROCESS_URL_LIST matched.
    return (message.type === 'PROCESS_URL_LIST');
});

// --- Optional: Initial setup or other listeners ---
// Example: Action button click listener (if using browserAction instead of pageAction)
// chrome.action.onClicked.addListener((tab) => {
//   // Logic to open popup or perform default action
// });
