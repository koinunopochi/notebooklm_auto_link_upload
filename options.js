document.addEventListener('DOMContentLoaded', function() {
  loadSettings();

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
  document.getElementById('saveUrlPatterns').addEventListener('click', saveUrlPatterns);
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
  chrome.storage.local.get(['columnName', 'urlPatterns', 'csvData'], function(result) {
    if (chrome.runtime.lastError) {
      console.error("Error loading settings:", chrome.runtime.lastError);
      showStatus('設定の読み込み中にエラーが発生しました', 'error');
      return;
    }

    if (result.columnName) {
      document.getElementById('columnName').value = result.columnName;
    } else {
      document.getElementById('columnName').value = 'URL';
    }
    if (result.urlPatterns) {
      document.getElementById('urlPatterns').value = result.urlPatterns.join('\n');
    }
    if (result.csvData) {
      Papa.parse(result.csvData, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          if (results.errors.length > 0) {
            showStatus('保存されたCSVデータの解析中にエラーが発生しました', 'error');
            console.error("PapaParse Errors on load:", results.errors);
            // エラーがあっても、部分的に解析できたデータで続行を試みる場合がある
            // return; // ここで処理を中断しない方が良い場合もある
          }

          // is_success列の処理とヘッダーリストの整合性を確認
          results.data = addIsSuccessColumn(results.data);
          if (results.meta.fields && !results.meta.fields.includes('is_success')) {
             // is_successを先頭に追加する
            results.meta.fields.unshift('is_success');
          }

          // 既存のデータを上書きして新しいCSVデータを設定
          window.csvData = results;
          updatePreview();
          
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
          showStatus(`保存されたCSVデータの解析中にエラーが発生しました: ${error.message}`, 'error');
        }
      });
    } else {
        // 保存されたCSVデータがない場合はプレビューを隠す
        document.getElementById('csvPreview').style.display = 'none';
    }
  });
}

function saveSettings() {
  const columnName = document.getElementById('columnName').value.trim() || 'URL'; // 空の場合のデフォルト
  const csvFile = document.getElementById('csvFileInput').files[0];

  // 重要：設定保存時は、現在メモリにあるデータ(window.csvData)を保存する
  // ファイルが選択されていても、それがまだ読み込まれていない、
  // または読み込み後に変更（チェックボックス操作）が加えられている可能性があるため。
  if (window.csvData) {
      chrome.storage.local.set({
          columnName: columnName,
          csvData: Papa.unparse(window.csvData) // 現在のデータを文字列化して保存
      }, function() {
          if (chrome.runtime.lastError) {
              console.error("Error saving settings:", chrome.runtime.lastError);
              showStatus('設定の保存中にエラーが発生しました', 'error');
          } else {
              showStatus('設定を保存しました', 'success');
          }
      });
  } else if (csvFile) {
      // window.csvData がなく、ファイルが選択されている場合（通常はファイル選択時に読み込まれるはずだが念のため）
      // ファイルを読み込んで保存する処理をここに入れることもできるが、
      // 通常のフローではファイル選択 -> load -> window.csvDataに反映 -> saveSettings の流れを期待する
      showStatus('CSVデータが読み込まれていません。ファイルを再選択するか、読み込みが完了するまでお待ちください。', 'error');
  } else {
      // window.csvData もなく、ファイルも選択されていない場合
       chrome.storage.local.set({
          columnName: columnName,
          // csvData は保存しないか、空として保存するかを選択
          // csvData: '' // 空のCSVとして保存する場合
       }, function() {
           if (chrome.runtime.lastError) {
               console.error("Error saving settings (no data):", chrome.runtime.lastError);
               showStatus('設定の保存中にエラーが発生しました', 'error');
           } else {
              showStatus('設定を保存しました (CSVデータなし)', 'success');
              // プレビュー等をクリアする処理が必要なら追加
              document.getElementById('csvPreview').style.display = 'none';
              window.csvData = null;
              chrome.storage.local.remove('csvData'); // ストレージからも削除
           }
       });
  }
}


function saveUrlPatterns() {
  const urlPatterns = document.getElementById('urlPatterns').value
    .split('\n')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0);

  chrome.storage.local.set({
    urlPatterns: urlPatterns
  }, function() {
     if (chrome.runtime.lastError) {
        console.error("Error saving URL patterns:", chrome.runtime.lastError);
        showStatus('URLパターンの保存中にエラーが発生しました', 'error');
     } else {
        showStatus('URLパターンを保存しました', 'success');
     }
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
