document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
  loadLastProcessedUrl(); // 最後に処理したURLを読み込む

  const csvFileInput = document.getElementById('csvFileInput');
  const fileInfoDiv = document.getElementById('fileInfo');
  const csvPreviewDiv = document.getElementById('csvPreview');
  const csvPreviewHeader = document.getElementById('csvPreviewHeader');
  const csvPreviewBody = document.getElementById('csvPreviewBody');
  const fetchDataButton = document.getElementById('fetchData');
  const apiResultDiv = document.getElementById('apiResult');
  const apiResultHeader = document.getElementById('apiResultHeader');
  const apiResultBody = document.getElementById('apiResultBody');
  const saveColumnNameButton = document.getElementById('saveColumnName');

  if (saveColumnNameButton) {
    saveColumnNameButton.addEventListener('click', function() {
      const columnName = document.getElementById('columnName').value.trim() || 'URL';
      chrome.storage.local.set({
        columnName: columnName
      }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error saving column name:", chrome.runtime.lastError);
          showStatus('URL列設定の保存中にエラーが発生しました', 'error');
        } else {
          showStatus('URL列設定を保存しました', 'success');
        }
      });
    });
  }

  if (fetchDataButton) {
    fetchDataButton.addEventListener('click', async function() {
      const apiUrl = document.getElementById('apiUrl').value.trim();
      if (!apiUrl) {
        showStatus('API URLを入力してください', 'error');
        return;
      }

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.status === 'success' && Array.isArray(data.data) && data.data.length > 0) {
          // ヘッダー行を取得
          const headers = data.data[0];
          
          // データをCSV形式に変換
          const csvData = {
            data: data.data.slice(1).map(row => {
              const obj = {};
              headers.forEach((header, index) => {
                obj[header] = row[index];
              });
              return obj;
            }),
            meta: {
              fields: headers
            }
          };

          // is_success列を追加
          csvData.data = addIsSuccessColumn(csvData.data);
          if (!csvData.meta.fields.includes('is_success')) {
            csvData.meta.fields.unshift('is_success');
          }

          // データを保存してプレビューを更新
          window.csvData = csvData;
          updatePreview();
          saveCSVData();
          showStatus('データの取得に成功しました', 'success');
        } else {
          throw new Error('データの形式が正しくありません');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        showStatus(`データの取得中にエラーが発生しました: ${error.message}`, 'error');
      }
    });
  }

  if (csvFileInput) {
    csvFileInput.addEventListener('change', function(event) {
      const file = event.target.files[0];
      if (file) {
        fileInfoDiv.textContent = `選択されたファイル: ${file.name}`;
        
        const reader = new FileReader();
        reader.onload = function(e) {
          const csvData = e.target.result;
          
          Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
              if (results.errors.length > 0) {
                showStatus('CSVファイルの解析中にエラーが発生しました', 'error');
                console.error("PapaParse Errors:", results.errors);
                return;
              }

              // is_success列が存在しない場合に追加
              results.data = addIsSuccessColumn(results.data);
              
              // ヘッダーリストにもis_successを追加（もし存在しなければ）
              if (results.meta.fields && !results.meta.fields.includes('is_success')) {
                 // is_successを先頭に追加する
                results.meta.fields.unshift('is_success');
              }

              // 既存のデータを上書きして新しいCSVデータを設定
              window.csvData = results;
              updatePreview();
              saveCSVData(); // ファイル選択後すぐにデータを保存

              if (results.meta.fields && results.meta.fields.length > 0) {
                const columnNameInput = document.getElementById('columnName');
                if (!columnNameInput.value || columnNameInput.value === 'URL') {
                  const urlColumn = results.meta.fields.find(h => h.toLowerCase().includes('url'));
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
        window.csvData = null; // ファイル選択解除時にデータもクリア
        chrome.storage.local.remove('csvData'); // ストレージからも削除
      }
    });
  }

  document.getElementById('saveSettings').addEventListener('click', saveSettings);
});

function updatePreview() {
  const csvPreviewDiv = document.getElementById('csvPreview');
  const csvPreviewHeader = document.getElementById('csvPreviewHeader');
  const csvPreviewBody = document.getElementById('csvPreviewBody');

  if (!window.csvData || !window.csvData.data || !window.csvData.meta || !window.csvData.meta.fields) {
    csvPreviewDiv.style.display = 'none';
    return;
  }

  // ヘッダー行を表示 (meta.fieldsを使用)
  const headers = window.csvData.meta.fields;
  let headerHtml = '<tr>';
  headerHtml += '<th class="row-number">No</th>'; // 行番号のヘッダーを追加
  headers.forEach(header => {
    const isResultColumn = header === 'is_success';
    headerHtml += `<th class="${isResultColumn ? 'result-column' : ''}">${header}</th>`;
  });
  headerHtml += '</tr>';
  csvPreviewHeader.innerHTML = headerHtml;

  // データ行を表示
  let bodyHtml = '';
  window.csvData.data.forEach((row, index) => {
    bodyHtml += '<tr>';
    bodyHtml += `<td class="row-number">${index + 1}</td>`; // 行番号を追加
    headers.forEach(header => {
       if (header === 'is_success') {
          bodyHtml += `<td class="result-column">`;
          // is_successがundefinedやnullの場合も考慮し、falseとして扱う
          const isChecked = row['is_success'] === true || String(row['is_success']).toLowerCase() === 'true';
          bodyHtml += `<input type="checkbox" class="result-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''}>`;
          bodyHtml += `</td>`;
       } else {
         bodyHtml += `<td>${row[header] || ''}</td>`;
       }
    });
    bodyHtml += '</tr>';
  });
  csvPreviewBody.innerHTML = bodyHtml;

  // チェックボックスのイベントリスナーを設定
  document.querySelectorAll('.result-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const index = parseInt(this.dataset.index);
      if (window.csvData && window.csvData.data[index]) {
          window.csvData.data[index]['is_success'] = this.checked;
          saveCSVData(); // チェックボックス変更時に保存
      }
    });
  });

  csvPreviewDiv.style.display = 'block';
}


function addIsSuccessColumn(data) {
  if (!Array.isArray(data)) return []; // データが配列でない場合は空配列を返す
  return data.map(row => {
    // is_success キーが存在しない場合にのみ false を設定
    if (!Object.prototype.hasOwnProperty.call(row, 'is_success')) {
      row['is_success'] = false;
    } else {
      // 既存の値が boolean でない場合、評価して boolean に変換
      if (typeof row['is_success'] !== 'boolean') {
         // 文字列の "true" (大文字小文字問わず) を true に、それ以外を false にする
         row['is_success'] = String(row['is_success']).toLowerCase() === 'true';
      }
    }
    return row;
  });
}


function saveCSVData() {
  if (!window.csvData) return;
  
  // 既存のCSVデータを上書きして保存
  const csvString = Papa.unparse(window.csvData);
  
  chrome.storage.local.set({
    csvData: csvString
  }, function() {
     if (chrome.runtime.lastError) {
        console.error("Error saving CSV data:", chrome.runtime.lastError);
        showStatus('CSVデータの保存中にエラーが発生しました', 'error');
     } else {
        // console.log("CSV data saved to local storage."); // デバッグ用
     }
  });
}

function loadSettings() {
  chrome.storage.local.get(['columnName'], function(result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading settings:", chrome.runtime.lastError);
      showStatus('設定の読み込み中にエラーが発生しました', 'error');
      return;
    }

    const columnNameInput = document.getElementById('columnName');
    if (result.columnName) {
      columnNameInput.value = result.columnName;
    } else {
      columnNameInput.value = 'URL';
    }

    // CSVデータの読み込み
    chrome.storage.local.get(['csvData'], function(result) {
      if (chrome.runtime.lastError) {
        console.error("Error loading CSV data:", chrome.runtime.lastError);
        return;
      }

      if (result.csvData) {
        Papa.parse(result.csvData, {
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            if (results.errors.length > 0) {
              showStatus('保存されたCSVデータの解析中にエラーが発生しました', 'error');
              console.error("PapaParse Errors on load:", results.errors);
              return;
            }

            // is_success列の処理とヘッダーリストの整合性を確認
            results.data = addIsSuccessColumn(results.data);
            if (results.meta.fields && !results.meta.fields.includes('is_success')) {
              results.meta.fields.unshift('is_success');
            }

            window.csvData = results;
            updatePreview();
          },
          error: function(error) {
            showStatus(`保存されたCSVデータの解析中にエラーが発生しました: ${error.message}`, 'error');
          }
        });
      } else {
        document.getElementById('csvPreview').style.display = 'none';
      }
    });
  });
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type; // classを直接設定
  statusDiv.style.display = 'block';

  // 以前のタイマーがあればクリア
  if (window.statusTimeout) {
    clearTimeout(window.statusTimeout);
  }

  window.statusTimeout = setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// 最後に処理したURLを読み込んで表示する関数
function loadLastProcessedUrl() {
  chrome.storage.local.get(['lastProcessedUrl'], function(result) {
    if (result.lastProcessedUrl) {
      const apiUrlInput = document.getElementById('apiUrl');
      if (apiUrlInput) {
        apiUrlInput.value = result.lastProcessedUrl;
      }
    }
  });
}

// URL_PROCESS_SUCCESSメッセージを受信したときに処理済みURLを更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'URL_PROCESS_SUCCESS') {
    loadProcessedUrls();
  }
});
