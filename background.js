// ページ上で「ソースを追加」ボタンをクリックする関数
function clickAddSourceButtonOnPage() {
    // --- ★★★ 対象ボタンのセレクタ ★★★ ---
    // 属性 aria-label を使うのが比較的安定している可能性が高い
    const buttonSelector = "button[aria-label='ソースを追加']";
    // 代替案 (もし上記で動かなければ):
    // const buttonSelector = ".add-source-button";
    // --- ★★★ セレクタここまで ★★★ ---

    const button = document.querySelector(buttonSelector);

    if (button) {
        console.log('[NotebookLM Extension] Found button:', button);
        button.click();
        return "Button clicked!"; // 成功メッセージを返す
    } else {
        console.error(`[NotebookLM Extension] Error: Button not found with selector: ${buttonSelector}`);
        return "Error: Button not found."; // 失敗メッセージを返す
    }
}

// popup.jsからのメッセージを受け取るリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CLICK_ADD_SOURCE') {
        console.log('[NotebookLM Extension] Received CLICK_ADD_SOURCE request.');
        // 現在アクティブなタブを取得
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                console.error("[NotebookLM Extension] No active tab found.");
                sendResponse({ status: "Error: No active tab." });
                return;
            }
            const targetTabId = tabs[0].id;

            // スクリプトを注入して実行
            chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: clickAddSourceButtonOnPage // ページで実行する関数
            })
            .then(injectionResults => {
                // injectionResultsは配列。実行結果は results[0].result に入る
                if (chrome.runtime.lastError) {
                    // executeScript自体でエラー（権限不足など）
                     console.error("[NotebookLM Extension] Script injection error:", chrome.runtime.lastError.message);
                     sendResponse({ status: `Error: ${chrome.runtime.lastError.message}` });
                } else if (injectionResults && injectionResults[0]) {
                    // 注入した関数の戻り値で結果を判断
                    console.log('[NotebookLM Extension] Script execution result:', injectionResults[0].result);
                    sendResponse({ status: injectionResults[0].result });
                } else {
                     console.warn('[NotebookLM Extension] Script executed but no result returned.');
                     sendResponse({ status: 'Script executed (no result).' });
                }
            })
            .catch(error => {
                 console.error("[NotebookLM Extension] Error during script execution:", error);
                 sendResponse({ status: `Error: ${error.message}` });
            });
        });

        return true; // 非同期でsendResponseを呼ぶことを示す
    }
});
