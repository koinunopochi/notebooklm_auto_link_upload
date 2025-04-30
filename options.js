document.addEventListener('DOMContentLoaded', function() {
  // 保存された設定を読み込む
  loadSettings();

  // CSVファイル選択時の処理
  const csvFileInput = document.getElementById('csvFileInput');
  const fileInfoDiv = document.getElementById('fileInfo');
  const csvPreviewDiv = document.getElementById('csvPreview');
  const csvPreviewHeader = document.getElementById('csvPreviewHeader');
  const csvPreviewBody = document.getElementById('csvPreviewBody');

  if (csvFileInput) {
    csvFileInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (file) {
        fileInfoDiv.textContent = `選択されたファイル: ${file.name}`;
        
        const reader = new FileReader();
        reader.onload = function(e) {
          const csvData = e.target.result;
          
          // PapaParseを使用してCSVを解析
          Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
              if (results.errors.length > 0) {
                showStatus('CSVファイルの解析中にエラーが発生しました', 'error');
                return;
              }

              // ヘッダー行を表示
              const headers = results.meta.fields;
              let headerHtml = '<tr>';
              headers.forEach(header => {
                headerHtml += `<th>${header}</th>`;
              });
              headerHtml += '</tr>';
              csvPreviewHeader.innerHTML = headerHtml;

              // データ行を表示（最初の5行のみ）
              let bodyHtml = '';
              results.data.slice(0, 5).forEach(row => {
                bodyHtml += '<tr>';
                headers.forEach(header => {
                  bodyHtml += `<td>${row[header] || ''}</td>`;
                });
                bodyHtml += '</tr>';
              });
              csvPreviewBody.innerHTML = bodyHtml;

              // プレビューを表示
              csvPreviewDiv.style.display = 'block';
              
              // ヘッダー行を取得してカラム名の候補を表示
              if (headers && headers.length > 0) {
                const columnNameInput = document.getElementById('columnName');
                if (!columnNameInput.value || columnNameInput.value === 'URL') {
                  // URLを含むカラム名を探す
                  const urlColumn = headers.find(h => h.toLowerCase().includes('url'));
                  if (urlColumn) {
                    columnNameInput.value = urlColumn;
                  }
                }
              }
            },
            error: function(error) {
              showStatus(`CSVファイルの解析中にエラーが発生しました: ${error.message}`, 'error');
            }
          });
        };
        reader.onerror = function() {
          showStatus('ファイルの読み込み中にエラーが発生しました', 'error');
        };
        reader.readAsText(file);
      } else {
        fileInfoDiv.textContent = 'ファイルが選択されていません';
        csvPreviewDiv.style.display = 'none';
      }
    });
  }

  // 設定保存ボタンのイベントリスナー
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('saveUrlPatterns').addEventListener('click', saveUrlPatterns);
});

function loadSettings() {
  chrome.storage.local.get(['columnName', 'urlPatterns'], function(result) {
    if (result.columnName) {
      document.getElementById('columnName').value = result.columnName;
    } else {
      document.getElementById('columnName').value = 'URL'; // デフォルト値
    }
    if (result.urlPatterns) {
      document.getElementById('urlPatterns').value = result.urlPatterns.join('\n');
    }
  });
}

function saveSettings() {
  const columnName = document.getElementById('columnName').value.trim();
  const csvFile = document.getElementById('csvFileInput').files[0];

  if (!csvFile) {
    showStatus('CSVファイルを選択してください', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const csvData = e.target.result;
    
    chrome.storage.local.set({
      columnName: columnName || 'URL',
      csvData: csvData
    }, function() {
      showStatus('設定を保存しました', 'success');
    });
  };
  reader.onerror = function() {
    showStatus('ファイルの読み込み中にエラーが発生しました', 'error');
  };
  reader.readAsText(csvFile);
}

function saveUrlPatterns() {
  const urlPatterns = document.getElementById('urlPatterns').value
    .split('\n')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0);

  chrome.storage.local.set({
    urlPatterns: urlPatterns
  }, function() {
    showStatus('URLパターンを保存しました', 'success');
  });
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
} 
