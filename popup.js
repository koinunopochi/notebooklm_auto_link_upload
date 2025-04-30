// 要素を取得
const startButton = document.getElementById('startButton');
const urlListTextArea = document.getElementById('urlList');
const statusDiv = document.getElementById('status');

// 開始ボタンのクリックリスナー
startButton.addEventListener('click', () => {
  // テキストエリアの値を取得し、区切り文字で分割、整形
  const urls = urlListTextArea.value
    .split(/[\s,;\t\n]+/) // 改行,空白,カンマ,セミコロン,タブで分割
    .map(url => url.trim())   // 前後の空白を削除
    .filter(url => url !== '' && url.length > 0); // 空の要素を除去

  // URLが見つからない場合は処理中断
  if (urls.length === 0) {
    statusDiv.textContent = 'No valid URLs entered. Please enter URLs.';
    statusDiv.className = 'error'; // エラースタイル適用
    urlListTextArea.focus(); // テキストエリアにフォーカス
    return;
  }

  // 処理開始の表示とUIの無効化
  statusDiv.textContent = `Found ${urls.length} URLs. Starting upload...`;
  statusDiv.className = ''; // 通常スタイルに戻す
  startButton.disabled = true;
  urlListTextArea.disabled = true;

  // バックグラウンドスクリプトにURLリストと処理開始メッセージを送信
  chrome.runtime.sendMessage(
    { type: 'PROCESS_URL_LIST', urls: urls }, // 新しいメッセージタイプ
    (response) => {
      // sendMessage 自体の即時エラーハンドリング (接続失敗など)
      if (chrome.runtime.lastError) {
        statusDiv.textContent = `Error sending message: ${chrome.runtime.lastError.message}`;
        statusDiv.className = 'error';
        console.error("Send message error:", chrome.runtime.lastError.message);
        // UIを有効に戻す
        startButton.disabled = false;
        urlListTextArea.disabled = false;
      }
      // background.js から非同期で応答が来るので、ここでは通常何もしない
      // console.log("Message sent to background.");
    }
  );
});

// バックグラウンドスクリプトからのメッセージ(進捗・完了)を受け取るリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received from background:", message); // デバッグ用ログ

  if (message.type === 'UPDATE_STATUS') {
    // 進捗メッセージをステータス表示
    statusDiv.textContent = message.text;
    statusDiv.className = ''; // 通常スタイル
  } else if (message.type === 'PROCESS_COMPLETE') {
    // 完了メッセージをステータス表示
    statusDiv.textContent = message.text;
    // 失敗が含まれているかなどでスタイルを変える（任意）
    if (message.text && message.text.toLowerCase().includes('failed')) {
         statusDiv.className = 'error';
    } else {
         statusDiv.className = 'success';
    }
    // 完了したらUIを再度有効化
    startButton.disabled = false;
    urlListTextArea.disabled = false;
  }
});

// ポップアップを開いたときにテキストエリアにフォーカス（任意）
document.addEventListener('DOMContentLoaded', () => {
    urlListTextArea.focus();
});
