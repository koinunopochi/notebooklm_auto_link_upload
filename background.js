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

// ページ上のURL入力欄にURLを入力する関数 (変更なし)
// ページ上のURL入力欄にURLを入力し、その後「挿入」ボタンにフォーカスする関数
function fillUrlInputOnPage(urlToFill) {
    const inputSelector = "input[formcontrolname='newUrl']";
    // ★ 「挿入」ボタンのセレクタもここで定義しておく
    const submitButtonSelector = "button.submit-button[type='submit']";
    let status = "Error: Unknown state."; // デフォルトステータス

    const inputElement = document.querySelector(inputSelector);

    if (inputElement) {
        console.log(`[NotebookLM Extension] Found URL input field: ${inputSelector}`);
        inputElement.value = urlToFill; // 値を設定

        // input/change イベントを発火
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[NotebookLM Extension] Dispatched input/change events for URL: ${urlToFill}`);
        status = "URL input filled.";

        // ★★★ blur() の代わりに submit ボタンを探して focus() する ★★★
        try {
            const submitButton = document.querySelector(submitButtonSelector);
            if (submitButton) {
                console.log(`[NotebookLM Extension] Found submit button to focus: ${submitButtonSelector}`);
                submitButton.focus(); // 「挿入」ボタンにフォーカスを当てる
                console.log('[NotebookLM Extension] Focused on submit button.');
                status = "URL input filled & focused submit."; // ステータス更新
            } else {
                // 挿入ボタンが見つからなかった場合のフォールバック（念のためblur）
                console.warn(`[NotebookLM Extension] Submit button (${submitButtonSelector}) not found for focusing. Falling back to blur.`);
                inputElement.blur();
                console.log('[NotebookLM Extension] Blurred input field as fallback.');
                status = "URL input filled & blurred (submit not found).";
            }
        } catch(e) {
             console.error('[NotebookLM Extension] Error while trying to focus submit button:', e);
             // フォーカスでエラーが起きても、入力自体は終わっているので続行するかもしれない
             status = "URL input filled, error focusing submit.";
        }
        // ★★★ 変更ここまで ★★★

        return status; // 最終的なステータスを返す
    } else {
        console.error(`[NotebookLM Extension] Error: URL input field not found with selector: ${inputSelector}`);
        return "Error: URL input field not found.";
    }
}

// 他の関数やメッセージリスナー内の待機時間(delayAfterStep3)はそのまま維持してください

// ★ 新しい関数: ページ上で「挿入」ボタンをクリックする関数
// ページ上で「挿入」ボタンをクリックする関数 (セレクタを変更)
function clickInsertButtonOnPage() {
    // --- ★★★ 対象「挿入」ボタンのセレクタ (変更案) ★★★ ---
    // website-upload 要素内のボタンに限定してみる
    const buttonSelector = "website-upload button.submit-button[type='submit']";
    // 元のセレクタ: "button.submit-button[type='submit']";
    // ユーザー提示の不安定なセレクタ: "#mat-mdc-dialog-9 > ... > button"; (非推奨)
    // --- ★★★ セレクタここまで ★★★ ---

    console.log(`[NotebookLM Extension] Attempting to find "Insert" button with selector: ${buttonSelector}`);
    const button = document.querySelector(buttonSelector);

    if (button) {
        console.log('[NotebookLM Extension] Found "Insert" button:', button);

        // ★ Disabled チェックはテストのためコメントアウトしたまま
        /*
        if (button.disabled) { ... }
        */

        try {
            console.log('[NotebookLM Extension] Attempting to click "Insert" button (regardless of disabled state).');
            button.click(); // disabled状態でもクリックを試行
            return '"Insert" button click attempted.';
        } catch (e) {
             console.error('[NotebookLM Extension] Error occurred during button click attempt:', e);
             return `Error clicking button: ${e.message}`;
        }

    } else {
        console.error(`[NotebookLM Extension] Error: "Insert" button not found with selector: ${buttonSelector}`);
        return 'Error: "Insert" button not found.';
    }
}

// 他の関数やメッセージリスナーは変更なし

// 他の関数やメッセージリスナー内の待機時間はそのまま維持してください


// popup.jsからのメッセージを受け取るリスナー (ステップ4を追加)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLICK_ADD_SOURCE') { // トリガーメッセージ名はそのまま
        console.log('[NotebookLM Extension] Received request (initiating sequence).');
        const dummyUrl = "https://example.com/dummy-url";

        // 非同期処理を開始
        (async () => {
            let step1Result = 'Error: Step 1 did not run.';
            let step2Result = 'Error: Step 2 did not run.';
            let step3Result = 'Error: Step 3 did not run.';
            let step4Result = 'Error: Step 4 did not run.';
            const delayAfterStep1 = 1000; // ms
            const delayAfterStep2 = 500;  // ms
            const delayAfterStep3 = 1500;  // URL入力後、挿入ボタンが有効になるまでの待機時間(ms) - ★調整が必要かも

            // --- ステップ1: 「ソースを追加」ボタン ---
            const targetTabId = sender.tab ? sender.tab.id : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (!targetTabId) {
                 console.error("[NotebookLM Extension] No active tab found.");
                 sendResponse({ status: "Error: No active tab." }); return;
            }
            try {
                console.log('[NotebookLM Extension] Executing Step 1: Click "Add Source".');
                const results1 = await chrome.scripting.executeScript({ target: { tabId: targetTabId }, func: clickAddSourceButtonOnPage });
                step1Result = results1[0]?.result || 'Error: No result from step 1.';
                console.log('[NotebookLM Extension] Step 1 Result:', step1Result);
                if (step1Result.startsWith('Error:')) throw new Error(step1Result);
            } catch (error) {
                console.error("[NotebookLM Extension] Error during Step 1:", error);
                sendResponse({ status: `Step 1 Failed: ${error.message}` }); return;
            }

            // --- ステップ2: 「ウェブサイト」チップ ---
            console.log(`[NotebookLM Extension] Waiting ${delayAfterStep1}ms after Step 1...`);
            await new Promise(resolve => setTimeout(resolve, delayAfterStep1));
            try {
                 console.log('[NotebookLM Extension] Executing Step 2: Click "Website".');
                 const results2 = await chrome.scripting.executeScript({ target: { tabId: targetTabId }, func: clickWebsiteChipOnPage });
                 step2Result = results2[0]?.result || 'Error: No result from step 2.';
                 console.log('[NotebookLM Extension] Step 2 Result:', step2Result);
                 if (step2Result.startsWith('Error:')) throw new Error(step2Result);
             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 2:", error);
                 sendResponse({ status: `Step 1 OK, Step 2 Failed: ${error.message}` }); return;
             }

            // --- ステップ3: URL入力 ---
            console.log(`[NotebookLM Extension] Waiting ${delayAfterStep2}ms after Step 2...`);
            await new Promise(resolve => setTimeout(resolve, delayAfterStep2));
             try {
                 console.log('[NotebookLM Extension] Executing Step 3: Fill URL input.');
                 const results3 = await chrome.scripting.executeScript({
                     target: { tabId: targetTabId }, func: fillUrlInputOnPage, args: [dummyUrl]
                 });
                 step3Result = results3[0]?.result || 'Error: No result from step 3.';
                 console.log('[NotebookLM Extension] Step 3 Result:', step3Result);
                 if (step3Result.startsWith('Error:')) throw new Error(step3Result);
             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 3:", error);
                 sendResponse({ status: `Steps 1&2 OK, Step 3 Failed: ${error.message}` }); return;
             }

             // --- ステップ4: 「挿入」ボタン ---
             console.log(`[NotebookLM Extension] Waiting ${delayAfterStep3}ms after Step 3...`); // ログも更新後の値で表示される
             await new Promise(resolve => setTimeout(resolve, delayAfterStep3));
             try {
                 console.log('[NotebookLM Extension] Executing Step 4: Click "Insert".');
                 const results4 = await chrome.scripting.executeScript({
                     target: { tabId: targetTabId }, func: clickInsertButtonOnPage
                 });
                 step4Result = results4[0]?.result || 'Error: No result from step 4.';
                 console.log('[NotebookLM Extension] Step 4 Result:', step4Result);
                 if (step4Result.startsWith('Error:')) throw new Error(step4Result);
             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 4:", error);
                 sendResponse({ status: `Steps 1-3 OK, Step 4 Failed: ${error.message}` }); return;
             }

            // --- 全ステップ成功 ---
            console.log('[NotebookLM Extension] All 4 steps completed successfully.');
            sendResponse({ status: "All 4 steps successful!" });

        })(); // 非同期関数を実行

        return true; // 非同期でsendResponseを呼ぶことを示す
    }
});
