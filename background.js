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

async function processSingleUrlSequence(tabId, url) {
    let stepResult = '';
    const delayBeforeStep1 = 300;
    const delayAfterStep1 = 1000;
    const delayAfterStep2 = 500;
    const delayAfterStep3 = 1500;
    const delayAfterStep4 = 2000;

    try {
        await new Promise(resolve => setTimeout(resolve, delayBeforeStep1));

        const results1 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickAddSourceButtonOnPage });
        stepResult = results1[0]?.result;
        if (!stepResult || typeof stepResult !== 'string' || stepResult.startsWith('Error:')) {
             throw new Error(stepResult || 'Step 1: Add Source button failed or invalid response.');
        }
        await new Promise(resolve => setTimeout(resolve, delayAfterStep1));

        const results2 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickWebsiteChipOnPage });
        stepResult = results2[0]?.result;
        if (!stepResult || typeof stepResult !== 'string' || stepResult.startsWith('Error:')) {
            throw new Error(stepResult || 'Step 2: Website chip failed or invalid response.');
        }
        await new Promise(resolve => setTimeout(resolve, delayAfterStep2));

        const results3 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: fillUrlInputOnPage, args: [url] });
        stepResult = results3[0]?.result;
         if (!stepResult || typeof stepResult !== 'string' || stepResult.startsWith('Error:')) {
            throw new Error(stepResult || 'Step 3: Fill URL failed or invalid response.');
        }
        await new Promise(resolve => setTimeout(resolve, delayAfterStep3));

        const results4 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickInsertButtonOnPage });
        stepResult = results4[0]?.result;
         if (!stepResult || typeof stepResult !== 'string' || stepResult.startsWith('Error:')) {
            throw new Error(stepResult || 'Step 4: Insert button failed or invalid response.');
        }
        await new Promise(resolve => setTimeout(resolve, delayAfterStep4));

        return { success: true };

    } catch (error) {
        const errorMessage = String(stepResult || error.message || 'Unknown sequence error');
        return { success: false, error: `Sequence Error: ${errorMessage.substring(0, 150)}` };
    }
}

let isProcessing = false;
let shouldStop = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'PROCESS_URL_LIST' && (message.items || message.urls)) {
        if (isProcessing) {
            sendResponse({ error: "Processing already in progress." });
            return false;
        }
        isProcessing = true;
        shouldStop = false;

        const hasItems = Array.isArray(message.items);
        const dataToProcess = hasItems ? message.items : message.urls.map(url => ({ url }));
        const totalCount = dataToProcess.length;

        (async () => {
            let tabId = null;
            try {
                const notebookTabs = await chrome.tabs.query({ url: "*://notebooklm.google.com/*" });
                if (notebookTabs.length > 0) {
                    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    const activeNotebookTab = activeTabs.find(t => notebookTabs.some(nt => nt.id === t.id));
                    tabId = activeNotebookTab ? activeNotebookTab.id : notebookTabs[0].id;
                }
            } catch (e) {
                // Tab query error - log removed
            }

            if (!tabId) {
                try {
                    chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: "Error: NotebookLM tab not found.", isError: true });
                } catch(e) {}
                isProcessing = false;
                return;
            }

            sendResponse({ status: "received" });

            let successCount = 0;
            let failCount = 0;
            const delayBetweenUrls = 2500;

            for (let i = 0; i < totalCount; i++) {
                if (shouldStop) {
                    try {
                        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `Stopped. Success: ${successCount}, Failed: ${failCount}`, isError: false });
                    } catch(e) {}
                    break;
                }

                const currentData = dataToProcess[i];
                const currentUrl = currentData.url;
                const originalIndex = hasItems ? currentData.index : -1;

                const progressText = `Processing ${i + 1}/${totalCount}: ${currentUrl.substring(0, 40)}...`;
                try {
                    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: progressText, isError: false });
                } catch(e) {}

                const result = await processSingleUrlSequence(tabId, currentUrl);

                if (result.success) {
                    successCount++;
                    if (hasItems && originalIndex !== -1) {
                        try {
                             chrome.runtime.sendMessage({
                                 type: 'URL_PROCESS_SUCCESS',
                                 itemIndex: originalIndex
                             }, (response) => {
                                  if (chrome.runtime.lastError && !String(chrome.runtime.lastError.message).includes("Receiving end does not exist")) {
                                      // Send success error - log removed
                                  }
                             });
                        } catch (e) {}
                    }
                } else {
                    failCount++;
                    const failText = `Failed ${i + 1}/${totalCount}. Err: ${result.error}`;
                    try {
                        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: failText, isError: true });
                    } catch(e) {}
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                if (i < totalCount - 1 && !shouldStop) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenUrls));
                }
            }

            const finalText = shouldStop
                ? `Stopped. Success: ${successCount}, Failed: ${failCount}`
                : `Finished. Success: ${successCount}, Failed: ${failCount}`;
            const finalIsError = failCount > 0 || shouldStop;
             try {
                 chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: finalText, isError: finalIsError });
             } catch(e) {}

             isProcessing = false;
             shouldStop = false;

        })();

        return true;
    }
    else if (message.type === 'STOP_PROCESSING') {
        if (isProcessing) {
            shouldStop = true;
            sendResponse({ status: "stopping" });
        } else {
            sendResponse({ status: "not_running" });
        }
        return false;
    }

    return false;
});

chrome.runtime.onInstalled.addListener(() => {
  // Install/update message - log removed
});
