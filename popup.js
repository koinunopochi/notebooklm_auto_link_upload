const addSourceButton = document.getElementById('addSourceButton');
const statusDiv = document.getElementById('status');

addSourceButton.addEventListener('click', () => {
  statusDiv.textContent = 'Trying to click...';
  addSourceButton.disabled = true;

  // バックグラウンドスクリプトにクリック指示メッセージを送る
  chrome.runtime.sendMessage({ type: 'CLICK_ADD_SOURCE' }, (response) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
      console.error(chrome.runtime.lastError.message);
    } else if (response) {
        statusDiv.textContent = response.status; // backgroundからの結果を表示
    } else {
        // 応答がない場合 (background側でsendResponseを呼ばなかった場合など)
        statusDiv.textContent = 'Action requested.';
    }
     addSourceButton.disabled = false; // ボタンを再度有効化
  });
});

// バックグラウンドからのステータス更新を受け取る場合（今回はsendResponseで直接返信）
/*
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATUS') {
        statusDiv.textContent = message.text;
        addSourceButton.disabled = message.disableButton;
    }
});
*/
