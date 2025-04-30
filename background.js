// ページ上で「ソースを追加」ボタンをクリックする関数 (変更なし)
function clickAddSourceButtonOnPage() {
    const buttonSelector = "button[aria-label='ソースを追加']";
    const button = document.querySelector(buttonSelector);
    if (button) {
        console.log('[NotebookLM Extension] Found "Add Source" button:', button);
        button.click();
        return "Add Source button clicked!";
    } else {
        console.error(`[NotebookLM Extension] Error: "Add Source" Button not found with selector: ${buttonSelector}`);
        return 'Error: "Add Source" button not found.';
    }
}

// ページ上で「ウェブサイト」チップをクリックする関数 (変更なし)
function clickWebsiteChipOnPage() {
    const xpath = "//mat-chip[.//span[normalize-space(.)='ウェブサイト']]";
    try {
        const findElementByXPath = (xpathToExecute) => {
            const result = document.evaluate(xpathToExecute, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue;
        };
        const chip = findElementByXPath(xpath);
        if (chip) {
            console.log('[NotebookLM Extension] Found "Website" chip:', chip);
             if (typeof chip.click === 'function') {
                 chip.click();
                 return "Website chip clicked!";
             } else {
                 console.error('[NotebookLM Extension] Error: Found element is not clickable.', chip);
                 return 'Error: Found "Website" element but cannot click.';
             }
        } else {
            console.error(`[NotebookLM Extension] Error: "Website" chip not found with XPath: ${xpath}`);
            return 'Error: "Website" chip not found.';
        }
    } catch (e) {
        console.error('[NotebookLM Extension] Error during XPath evaluation or click:', e);
        return `Error: Exception during "Website" chip click - ${e.message}`;
    }
}

// ★ 新しい関数: ページ上のURL入力欄にURLを入力する関数
function fillUrlInputOnPage(urlToFill) {
    // --- ★★★ 対象URL入力欄のセレクタ ★★★ ---
    // 提供されたHTMLから、formcontrolname="newUrl" を持つ input 要素を探すのが良さそう
    const inputSelector = "input[formcontrolname='newUrl']";
    // --- ★★★ セレクタここまで ★★★ ---

    const inputElement = document.querySelector(inputSelector);

    if (inputElement) {
        console.log(`[NotebookLM Extension] Found URL input field with selector: ${inputSelector}`);
        inputElement.value = urlToFill; // 値を設定

        // --- ★★★ 重要: フレームワークに変更を認識させる ★★★ ---
        // Angularなどのフレームワークでは、.value を直接変更しただけでは
        // 変更が検知されないことがあるため、イベントを発火させる。
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        // ----------------------------------------------------

        console.log(`[NotebookLM Extension] Filled input with URL: ${urlToFill}`);
        return "URL input filled!"; // 成功メッセージ
    } else {
        console.error(`[NotebookLM Extension] Error: URL input field not found with selector: ${inputSelector}`);
        return "Error: URL input field not found."; // 失敗メッセージ
    }
}


// popup.jsからのメッセージを受け取るリスナー (ステップ3を追加)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLICK_ADD_SOURCE') {
        console.log('[NotebookLM Extension] Received CLICK_ADD_SOURCE request (initiating sequence).');
        const dummyUrl = "https://example.com/dummy-url"; // ★ ダミーURLを定義

        // 非同期処理を開始
        (async () => {
            let step1Result = 'Error: Step 1 did not run.';
            let step2Result = 'Error: Step 2 did not run.';
            let step3Result = 'Error: Step 3 did not run.';
            const delayAfterStep1 = 1000; // ステップ1後の待機時間(ms)
            const delayAfterStep2 = 500;  // ステップ2後の待機時間(ms) - ★調整が必要かも

            // --- ステップ1: 「ソースを追加」ボタンをクリック ---
            const targetTabId = sender.tab ? sender.tab.id : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!targetTabId) {
                 console.error("[NotebookLM Extension] No active tab found.");
                 sendResponse({ status: "Error: No active tab." });
                 return;
            }

            try {
                console.log('[NotebookLM Extension] Executing Step 1: Click "Add Source" button.');
                const results1 = await chrome.scripting.executeScript({
                    target: { tabId: targetTabId }, func: clickAddSourceButtonOnPage
                });
                step1Result = results1[0]?.result || 'Error: No result from step 1 script.';
                console.log('[NotebookLM Extension] Step 1 Result:', step1Result);
                if (step1Result.startsWith('Error:')) throw new Error(step1Result);

            } catch (error) {
                console.error("[NotebookLM Extension] Error during Step 1 execution:", error);
                sendResponse({ status: `Step 1 Failed: ${error.message}` }); return;
            }

            // --- ステップ2: 「ウェブサイト」チップをクリック ---
            console.log(`[NotebookLM Extension] Waiting ${delayAfterStep1}ms after Step 1...`);
            await new Promise(resolve => setTimeout(resolve, delayAfterStep1));
            try {
                 console.log('[NotebookLM Extension] Executing Step 2: Click "Website" chip.');
                 const results2 = await chrome.scripting.executeScript({
                     target: { tabId: targetTabId }, func: clickWebsiteChipOnPage
                 });
                 step2Result = results2[0]?.result || 'Error: No result from step 2 script.';
                 console.log('[NotebookLM Extension] Step 2 Result:', step2Result);
                 if (step2Result.startsWith('Error:')) throw new Error(step2Result);

             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 2 execution:", error);
                 sendResponse({ status: `Step 1 OK, Step 2 Failed: ${error.message}` }); return;
             }

            // --- ステップ3: URL入力欄にダミーURLを入力 ---
            console.log(`[NotebookLM Extension] Waiting ${delayAfterStep2}ms after Step 2...`);
            await new Promise(resolve => setTimeout(resolve, delayAfterStep2));
             try {
                 console.log('[NotebookLM Extension] Executing Step 3: Fill URL input.');
                 const results3 = await chrome.scripting.executeScript({
                     target: { tabId: targetTabId },
                     func: fillUrlInputOnPage,
                     args: [dummyUrl] // ★ 注入する関数にダミーURLを引数として渡す
                 });
                 step3Result = results3[0]?.result || 'Error: No result from step 3 script.';
                 console.log('[NotebookLM Extension] Step 3 Result:', step3Result);
                 if (step3Result.startsWith('Error:')) throw new Error(step3Result);

             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 3 execution:", error);
                 sendResponse({ status: `Steps 1&2 OK, Step 3 Failed: ${error.message}` }); return;
             }

            // --- 全ステップ成功 ---
            console.log('[NotebookLM Extension] All steps completed successfully.');
            sendResponse({ status: "Steps 1, 2 & 3 successful!" });

        })(); // 非同期関数を実行

        return true; // 非同期でsendResponseを呼ぶことを示す
    }
});
