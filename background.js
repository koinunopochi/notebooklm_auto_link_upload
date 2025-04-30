// --- ヘルパー関数群 (ログ強化版) ---

function clickAddSourceButtonOnPage() {
    const buttonSelector = "button[aria-label='ソースを追加']";
    console.log('[NotebookLM Extension] Step 1 Func: Finding button:', buttonSelector);
    const button = document.querySelector(buttonSelector);
    if (button) {
        console.log('[NotebookLM Extension] Step 1 Func: Found button:', button);
        if (button.disabled) {
             console.warn('[NotebookLM Extension] Step 1 Func: Button IS DISABLED.');
             return 'Error: "Add Source" button is disabled.';
        }
        try {
             button.click();
             return "Add Source button clicked!";
        } catch (e) {
             console.error('[NotebookLM Extension] Step 1 Func: Click Error!', e);
             return `Error clicking Add Source: ${e.message}`;
        }
    } else {
        console.error(`[NotebookLM Extension] Step 1 Func: Button NOT FOUND with selector: ${buttonSelector}`);
        return 'Error: "Add Source" button not found.';
    }
}

function clickWebsiteChipOnPage() {
    const xpath = "//mat-chip[.//span[normalize-space(.)='ウェブサイト']]";
    console.log('[NotebookLM Extension] Step 2 Func: Finding chip via XPath:', xpath);
    try {
        const findElementByXPath = (xpathToExecute) => {
             const result = document.evaluate(xpathToExecute, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
             return result.singleNodeValue;
        };
        const chip = findElementByXPath(xpath);
        if (chip) {
            console.log('[NotebookLM Extension] Step 2 Func: Found chip:', chip);
             if (typeof chip.click === 'function') {
                 try {
                     chip.click();
                     return "Website chip clicked!";
                 } catch (e) {
                      console.error('[NotebookLM Extension] Step 2 Func: Click Error!', e);
                      return `Error clicking Website chip: ${e.message}`;
                 }
             } else {
                 console.error('[NotebookLM Extension] Step 2 Func: Found element is not clickable.', chip);
                 return 'Error: Found "Website" element but cannot click.';
             }
        } else {
            console.error(`[NotebookLM Extension] Step 2 Func: Chip NOT FOUND with XPath: ${xpath}`);
            return 'Error: "Website" chip not found.';
        }
    } catch (e) {
        console.error('[NotebookLM Extension] Step 2 Func: XPath/Find Error!', e);
        return `Error finding Website chip: ${e.message}`;
    }
}

function fillUrlInputOnPage(urlToFill) {
    const inputSelector = "input[formcontrolname='newUrl']";
    const submitButtonSelector = "website-upload button.submit-button[type='submit']"; // セレクタを 'website-upload' で限定
    console.log(`[NotebookLM Extension] Step 3 Func: Finding input: ${inputSelector} for URL: ${urlToFill}`);
    const inputElement = document.querySelector(inputSelector);
    if (inputElement) {
        console.log('[NotebookLM Extension] Step 3 Func: Found input field:', inputElement);
        try {
            inputElement.value = urlToFill;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`[NotebookLM Extension] Step 3 Func: Dispatched input/change events.`);
            // フォーカス処理
            const submitButton = document.querySelector(submitButtonSelector);
            if (submitButton) {
                submitButton.focus();
                console.log('[NotebookLM Extension] Step 3 Func: Focused on submit button.');
            } else {
                console.warn('[NotebookLM Extension] Step 3 Func: Submit button not found for focusing.');
                inputElement.blur();
            }
            return "URL input processed.";
        } catch (e) {
            console.error('[NotebookLM Extension] Step 3 Func: Error setting value or dispatching events!', e);
            return `Error processing input: ${e.message}`;
        }
    } else {
        console.error(`[NotebookLM Extension] Step 3 Func: Input NOT FOUND with selector: ${inputSelector}`);
        return "Error: URL input field not found.";
    }
}

function clickInsertButtonOnPage() {
    const buttonSelector = "website-upload button.submit-button[type='submit']"; // 限定したセレクタを使用
    console.log('[NotebookLM Extension] Step 4 Func: Finding button:', buttonSelector);
    const button = document.querySelector(buttonSelector);
    if (button) {
        console.log('[NotebookLM Extension] Step 4 Func: Found button:', button);
        if (button.disabled) {
             console.warn('[NotebookLM Extension] Step 4 Func: Button IS DISABLED.');
             return 'Error: "Insert" button is disabled.';
        }
        try {
             console.log('[NotebookLM Extension] Step 4 Func: Clicking enabled button.');
             button.click();
             return '"Insert" button clicked!';
        } catch (e) {
             console.error('[NotebookLM Extension] Step 4 Func: Click Error!', e);
             return `Error clicking Insert button: ${e.message}`;
        }
    } else {
        console.error(`[NotebookLM Extension] Step 4 Func: Button NOT FOUND with selector: ${buttonSelector}`);
        return 'Error: "Insert" button not found.';
    }
}

// --- Sequence Function (変更なし) ---
async function processSingleUrlSequence(tabId, url) {
    console.log(`[NotebookLM Extension] Sequence: Starting for URL: ${url}`);
    let stepResult = '';
    const delayAfterStep1 = 1000;
    const delayAfterStep2 = 500;
    const delayAfterStep3 = 1500; // 挿入ボタン有効化待ち

    try {
        // Step 1
        console.log('[NotebookLM Extension] Sequence: Executing Step 1 script.');
        const results1 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickAddSourceButtonOnPage });
        stepResult = results1[0]?.result;
        console.log('[NotebookLM Extension] Sequence: Step 1 raw result:', stepResult);
        if (!stepResult || stepResult.startsWith('Error:')) throw new Error(stepResult || 'Step 1 failed.');
        console.log('[NotebookLM Extension] Sequence: Step 1 OK.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep1));

        // Step 2
        console.log('[NotebookLM Extension] Sequence: Executing Step 2 script.');
        const results2 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickWebsiteChipOnPage });
        stepResult = results2[0]?.result;
        console.log('[NotebookLM Extension] Sequence: Step 2 raw result:', stepResult);
        if (!stepResult || stepResult.startsWith('Error:')) throw new Error(stepResult || 'Step 2 failed.');
        console.log('[NotebookLM Extension] Sequence: Step 2 OK.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep2));

        // Step 3
        console.log('[NotebookLM Extension] Sequence: Executing Step 3 script.');
        const results3 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: fillUrlInputOnPage, args: [url] });
        stepResult = results3[0]?.result;
        console.log('[NotebookLM Extension] Sequence: Step 3 raw result:', stepResult);
        if (!stepResult || stepResult.startsWith('Error:')) throw new Error(stepResult || 'Step 3 failed.');
        console.log('[NotebookLM Extension] Sequence: Step 3 OK.');
        await new Promise(resolve => setTimeout(resolve, delayAfterStep3));

        // Step 4
        console.log('[NotebookLM Extension] Sequence: Executing Step 4 script.');
        const results4 = await chrome.scripting.executeScript({ target: { tabId: tabId }, func: clickInsertButtonOnPage });
        stepResult = results4[0]?.result;
        console.log('[NotebookLM Extension] Sequence: Step 4 raw result:', stepResult);
        if (!stepResult || stepResult.startsWith('Error:')) throw new Error(stepResult || 'Step 4 failed.');
        console.log('[NotebookLM Extension] Sequence: Step 4 OK.');

        return true; // Success

    } catch (error) {
        console.error(`[NotebookLM Extension] Sequence FAILED for URL: ${url}`, error);
        return error.message || 'Unknown error in sequence.'; // Return error message
    }
}

// --- Message Listener (PROCESS_URL_LIST を処理) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ★ PROCESS_URL_LIST メッセージを処理するようにする
    if (message.type === 'PROCESS_URL_LIST' && message.urls) {
        const urlsToProcess = message.urls;
        console.log(`[NotebookLM Extension] Listener: Received PROCESS_URL_LIST with ${urlsToProcess.length} URLs.`);

        (async () => {
            const tabId = sender.tab ? sender.tab.id : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!tabId) {
                 console.error("[NotebookLM Extension] No active tab found.");
                 chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: "Error: No active tab found." });
                 return;
            }

            console.log(`[NotebookLM Extension] Listener: Starting loop for ${urlsToProcess.length} URLs on tab ${tabId}.`);
            let successCount = 0;
            let failCount = 0;
            const totalUrls = urlsToProcess.length; // totalUrls を定義
            const delayBetweenUrls = 2000; // ★ 各URL処理間の待機時間

            for (let i = 0; i < totalUrls; i++) {
                const currentUrl = urlsToProcess[i];
                console.log(`[NotebookLM Extension] Listener: --- Processing URL ${i + 1}/${totalUrls}: ${currentUrl} ---`);
                // ポップアップに進捗を送信
                chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `Processing ${i + 1}/${totalUrls}: ${currentUrl.substring(0, 30)}...` });

                // 1つのURLシーケンスを実行し、結果を取得 (true or エラーメッセージ)
                const result = await processSingleUrlSequence(tabId, currentUrl);

                if (result === true) {
                    successCount++;
                    console.log(`[NotebookLM Extension] Listener: Successfully processed URL ${i + 1}: ${currentUrl}`);
                } else {
                    failCount++;
                    // 具体的なエラー理由をログに出力
                    console.error(`[NotebookLM Extension] Listener: Failed URL ${i + 1}: ${currentUrl}. Reason: ${result}`);
                    // ポップアップにもエラー情報を一部表示
                    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `Failed ${i + 1}/${totalUrls}. Error: ${result.substring(0, 50)}...` });
                    // エラー時にループを中断したい場合はここで break;
                }

                // 最後以外のURL処理後には待機する
                if (i < totalUrls - 1) {
                     console.log(`[NotebookLM Extension] Listener: Waiting ${delayBetweenUrls}ms before next URL...`);
                     await new Promise(resolve => setTimeout(resolve, delayBetweenUrls));
                }
            } // End of loop

            // 全URL処理完了
            const finalText = `Finished. Success: ${successCount}, Failed: ${failCount}`;
            console.log(`[NotebookLM Extension] Listener: ${finalText}`);
            chrome.runtime.sendMessage({ type: 'PROCESS_COMPLETE', text: finalText });

        })(); // async IIFE end

        return true; // Indicate async response
    }
    // 古い 'CLICK_ADD_SOURCE' リスナーは不要なら削除
});
