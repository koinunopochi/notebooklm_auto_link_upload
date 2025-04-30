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

// ★ 新しい関数: ページ上で「ウェブサイト」チップをクリックする関数
function clickWebsiteChipOnPage() {
    // --- ★★★ 対象「ウェブサイト」チップのセレクタ (XPathを使用) ★★★ ---
    // 提供されたHTMLから、内部テキスト「ウェブサイト」を持つ mat-chip をXPathで探すのが確実そう
    const xpath = "//mat-chip[.//span[normalize-space(.)='ウェブサイト']]";
    // --- ★★★ セレクタここまで ★★★ ---

    try {
        // XPathを使って要素を検索するヘルパー関数
        const findElementByXPath = (xpathToExecute) => {
            const result = document.evaluate(xpathToExecute, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return result.singleNodeValue; // 最初に見つかった要素を返す
        };

        const chip = findElementByXPath(xpath);

        if (chip) {
            console.log('[NotebookLM Extension] Found "Website" chip:', chip);
            // 要素がクリック可能であることを確認 (より安全にするため)
             if (typeof chip.click === 'function') {
                 chip.click();
                 return "Website chip clicked!"; // 成功メッセージ
             } else {
                 console.error('[NotebookLM Extension] Error: Found element is not clickable.', chip);
                 return 'Error: Found "Website" element but cannot click.';
             }
        } else {
            console.error(`[NotebookLM Extension] Error: "Website" chip not found with XPath: ${xpath}`);
            return 'Error: "Website" chip not found.'; // 失敗メッセージ
        }
    } catch (e) {
        console.error('[NotebookLM Extension] Error during XPath evaluation or click:', e);
        return `Error: Exception during "Website" chip click - ${e.message}`;
    }
}


// popup.jsからのメッセージを受け取るリスナー (処理を非同期化し、ステップを追加)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLICK_ADD_SOURCE') {
        console.log('[NotebookLM Extension] Received CLICK_ADD_SOURCE request (initiating sequence).');

        // 非同期処理を開始
        (async () => {
            let step1Result = 'Error: Step 1 did not run.';
            let step2Result = 'Error: Step 2 did not run.';

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
                    target: { tabId: targetTabId },
                    func: clickAddSourceButtonOnPage
                });
                step1Result = results1[0]?.result || 'Error: No result from step 1 script.';
                console.log('[NotebookLM Extension] Step 1 Result:', step1Result);

                if (step1Result.startsWith('Error:')) {
                    throw new Error(step1Result); // エラーならここで中断
                }

            } catch (error) {
                console.error("[NotebookLM Extension] Error during Step 1 execution:", error);
                step1Result = `Error: ${error.message}`;
                sendResponse({ status: `Step 1 Failed: ${step1Result}` }); // ポップアップにエラーを返す
                return; // 処理中断
            }


            // --- ステップ2: 「ウェブサイト」チップをクリック ---
            // ステップ1成功後、UIが表示されるのを少し待つ
            const delayAfterStep1 = 1000; // 1秒待機 (ミリ秒単位) - ★必要に応じて調整
            console.log(`[NotebookLM Extension] Waiting ${delayAfterStep1}ms after Step 1...`);
            await new Promise(resolve => setTimeout(resolve, delayAfterStep1));

            try {
                 console.log('[NotebookLM Extension] Executing Step 2: Click "Website" chip.');
                 const results2 = await chrome.scripting.executeScript({
                     target: { tabId: targetTabId },
                     func: clickWebsiteChipOnPage
                 });
                 step2Result = results2[0]?.result || 'Error: No result from step 2 script.';
                 console.log('[NotebookLM Extension] Step 2 Result:', step2Result);

                 if (step2Result.startsWith('Error:')) {
                     throw new Error(step2Result); // エラーならここで中断
                 }

             } catch (error) {
                 console.error("[NotebookLM Extension] Error during Step 2 execution:", error);
                 step2Result = `Error: ${error.message}`;
                 // ステップ1は成功しているので、その情報も含めて返す
                 sendResponse({ status: `Step 1 OK, Step 2 Failed: ${step2Result}` });
                 return; // 処理中断
             }

            // --- 全ステップ成功 ---
            console.log('[NotebookLM Extension] Both steps completed successfully.');
            sendResponse({ status: "Step 1 & 2 successful!" }); // ポップアップに成功を返す

        })(); // 非同期関数を実行

        return true; // 非同期でsendResponseを呼ぶことを示す
    }
});
