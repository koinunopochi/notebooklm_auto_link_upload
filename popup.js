let currentCsvData = null;
let statusTimeout = null;

// --- Helper Functions (addIsSuccessColumn, saveCurrentCsvData, showStatus) remain the same ---

function addIsSuccessColumn(data) {
  if (!Array.isArray(data)) return [];
  return data.map(row => {
    if (!row) return null;
    const newRow = { ...row };
    if (!Object.prototype.hasOwnProperty.call(newRow, 'is_success') || newRow['is_success'] == null) {
      newRow['is_success'] = false;
    } else {
      if (typeof newRow['is_success'] !== 'boolean') {
        newRow['is_success'] = String(newRow['is_success']).toLowerCase() === 'true';
      }
    }
    return newRow;
  }).filter(row => row !== null);
}

function saveCurrentCsvData() {
  if (!currentCsvData || !currentCsvData.data) {
    return;
  }
  if (currentCsvData.meta && currentCsvData.meta.fields && !currentCsvData.meta.fields.includes('is_success')) {
    currentCsvData.meta.fields.unshift('is_success');
  }
  try {
    // Papa.unparse に渡す前に is_success が boolean であることを確認
    const dataToSave = currentCsvData.data.map(row => ({
        ...row,
        is_success: row.is_success === true // Ensure boolean true/false, not null/undefined
    }));
    const csvString = Papa.unparse({
        fields: currentCsvData.meta.fields,
        data: dataToSave
    });
    chrome.storage.local.set({ csvData: csvString }, () => {
      if (chrome.runtime.lastError) {
         console.error("Error saving CSV data:", chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
     console.error("Papa.unparse error:", e);
  }
}

function showStatus(message, type = '') {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    // ★ HTML構造に合わせてクラス名を調整 (CSS変数を使う場合)
    statusDiv.className = ''; // Reset classes
    if (type) {
      statusDiv.classList.add(type); // Add 'error' or 'success' class
    }
    statusDiv.style.display = 'block';

    if (statusTimeout) {
        clearTimeout(statusTimeout);
    }
    // エラーメッセージは自動で消さないように変更
    if (type !== 'error') {
        statusTimeout = setTimeout(() => {
            // メッセージが変わっていなければ非表示にする
            if (statusDiv.textContent === message) {
                statusDiv.style.display = 'none';
                statusDiv.className = '';
                statusDiv.textContent = '';
            }
        }, 5000);
    }
}

// --- Get Element References ---
const columnNameInput = document.getElementById('columnNameInput'); // URL Column
const startButton = document.getElementById('startButton');
const urlListTextArea = document.getElementById('urlList');
const startTextHtmlButton = document.getElementById('startTextHtmlButton');
const statusDiv = document.getElementById('status');
const stopButton = document.getElementById('stopButton');
const optionsButton = document.getElementById('optionsButton'); // May be created dynamically later

// ★★★ 追加: フィルター用 Input への参照 ★★★
const filterColumnInput = document.getElementById('filterColumnInput');
const filterValueInput = document.getElementById('filterValueInput');

function disableUI(showStop = true) {
    if (startButton) startButton.disabled = true;
    if (startTextHtmlButton) startTextHtmlButton.disabled = true;
    if (columnNameInput) columnNameInput.disabled = true;
    if (urlListTextArea) urlListTextArea.disabled = true;
    const optionsBtn = document.getElementById('optionsButton'); // ID で再取得
    if(optionsBtn) optionsBtn.disabled = true;

    // ★★★ 追加: フィルター用 Input を無効化 ★★★
    if (filterColumnInput) filterColumnInput.disabled = true;
    if (filterValueInput) filterValueInput.disabled = true;

    if (stopButton) {
        stopButton.style.display = showStop ? 'block' : 'none';
        stopButton.disabled = false;
    }
}
function enableUI() {
    if (startButton) startButton.disabled = false;
    if (startTextHtmlButton) startTextHtmlButton.disabled = false;
    if (columnNameInput) columnNameInput.disabled = false;
    if (urlListTextArea) urlListTextArea.disabled = false;
    const optionsBtn = document.getElementById('optionsButton'); // ID で再取得
    if(optionsBtn) optionsBtn.disabled = false;

    // ★★★ 追加: フィルター用 Input を有効化 ★★★
    if (filterColumnInput) filterColumnInput.disabled = false;
    if (filterValueInput) filterValueInput.disabled = false;

    if (stopButton) {
        stopButton.style.display = 'none';
        stopButton.disabled = true;
    }
}

// --- Event Listener for Start Button (CSV Processing) ---
if (startButton) {
    startButton.addEventListener('click', () => {
        // ★★★ input 要素の存在チェックを追加 ★★★
        if (!columnNameInput || !statusDiv || !filterColumnInput || !filterValueInput) {
             alert("Popup Error: Required elements missing.");
             return;
        }
        const columnName = columnNameInput.value.trim(); // URL Column Name
        // ★★★ 追加: フィルター用の値を取得 ★★★
        const filterColumnName = filterColumnInput.value.trim();
        const filterValue = filterValueInput.value.trim();

        if (!columnName) {
            showStatus('Please enter the column name for URLs.', 'error');
            return;
        }
        // ★★★ 追加: フィルターカラム名はあるのに値がない場合はエラー ★★★
        if (filterColumnName && !filterValue) {
            showStatus('Filter value is required when filter column is specified.', 'error');
            return;
        }

        showStatus('Loading saved CSV data...', '');
        disableUI();

        chrome.storage.local.get(['csvData'], (result) => {
            if (chrome.runtime.lastError) {
                showStatus(`Error loading data: ${chrome.runtime.lastError.message}`, 'error');
                enableUI();
                return;
            }
            if (!result.csvData) {
                showStatus('No CSV data found in storage. Load data via Options page.', 'error');
                enableUI();
                return;
            }

            showStatus('Parsing CSV data...', '');
            if (typeof Papa === 'undefined') {
                showStatus('Error: PapaParse library not loaded.', 'error');
                enableUI();
                return;
            }

            Papa.parse(result.csvData, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.errors.length > 0) {
                        // エラー内容を具体的に表示
                        const errorMessages = results.errors.map(e => `Row ${e.row}: ${e.message}`).join('\n');
                        console.error("CSV Parsing Errors:", results.errors);
                        showStatus(`Error parsing saved CSV:\n${errorMessages}`, 'error');
                        enableUI(); return;
                    }
                    if (!results.data || !results.meta || !results.meta.fields) {
                         showStatus('Error parsing CSV: Invalid structure.', 'error');
                         enableUI(); return;
                    }

                    results.data = addIsSuccessColumn(results.data);
                    if (!results.meta.fields.includes('is_success')) {
                        results.meta.fields.unshift('is_success');
                    }
                    currentCsvData = results; // Keep parsed data including meta

                    // URLカラムの存在チェック
                    if (!results.meta.fields.includes(columnName)) {
                        const available = results.meta.fields.join(', ');
                        showStatus(`Error: URL Column "${columnName}" not found. Available: ${available}`, 'error');
                        enableUI(); currentCsvData = null; return;
                    }

                    // ★★★ 追加: フィルターカラムの存在チェック (指定されている場合) ★★★
                    if (filterColumnName && !results.meta.fields.includes(filterColumnName)) {
                        const available = results.meta.fields.join(', ');
                        showStatus(`Error: Filter Column "${filterColumnName}" not found. Available: ${available}`, 'error');
                        enableUI(); currentCsvData = null; return;
                    }

                    // ★★★ 修正: フィルターロジックを強化 ★★★
                    const itemsToProcess = results.data
                        .map((row, index) => ({ row, index })) // 元のインデックスを保持
                        .filter(item => {
                            const rowData = item.row;
                            // 1. is_success が true でないかチェック
                            const isSuccess = rowData['is_success'] === true;
                            if (isSuccess) return false; // 処理済みならスキップ

                            // 2. URLカラムの値が有効かチェック
                            const urlValue = rowData[columnName];
                            const isValidUrl = urlValue && typeof urlValue === 'string' && urlValue.trim() !== '' && !urlValue.startsWith('#');
                            if (!isValidUrl) return false; // URLが無効ならスキップ

                            // 3. ★★★ 追加: フィルター条件のチェック (指定されている場合) ★★★
                            let filterMatch = true; // デフォルトは true (フィルターしない場合)
                            if (filterColumnName && filterValue) {
                                // filterColumnName が rowData に存在するか確認
                                if (Object.prototype.hasOwnProperty.call(rowData, filterColumnName)) {
                                    const columnData = rowData[filterColumnName];
                                    // 値が存在し、かつ指定された値と一致するか (大文字小文字無視)
                                    filterMatch = (columnData != null) && (String(columnData).trim().toLowerCase() === filterValue.toLowerCase());
                                } else {
                                    // rowData に filterColumnName が存在しない場合は false とする
                                    filterMatch = false;
                                }
                            }
                            // すべての条件を満たす場合のみ true を返す
                            return filterMatch;
                        })
                        .map(item => ({ // バックグラウンドに送るデータを整形
                            index: item.index, // 元のCSVデータにおけるインデックス
                            url: String(item.row[columnName]).trim()
                        }));

                    // 重複URLを除外 (同じURLがフィルター条件を満たす複数の行にある場合、最初のものだけ処理)
                    const uniqueUrls = new Map();
                    itemsToProcess.forEach(item => { if (!uniqueUrls.has(item.url)) uniqueUrls.set(item.url, item); });
                    const finalItemsToProcess = Array.from(uniqueUrls.values());


                    if (finalItemsToProcess.length === 0) {
                         let msg = `No new valid URLs found in column "${columnName}"`;
                         if (filterColumnName && filterValue) {
                           msg += ` matching filter [${filterColumnName} = "${filterValue}"]`;
                         }
                         msg += `.`;
                         showStatus(msg, 'success');
                         enableUI();
                         currentCsvData = null; // No need to hold data if nothing to process
                         return;
                    }

                    let startMsg = `Found ${finalItemsToProcess.length} new URLs`;
                    if (filterColumnName && filterValue) {
                        startMsg += ` matching filter [${filterColumnName} = "${filterValue}"]`;
                    }
                    startMsg += `. Sending...`;
                    showStatus(startMsg, '');

                    // バックグラウンドに処理対象リストを送信
                    chrome.runtime.sendMessage(
                        { type: 'PROCESS_URL_LIST', items: finalItemsToProcess }, // items 配列を送信
                        (response) => {
                            if (chrome.runtime.lastError) {
                                 showStatus(`Error sending data: ${chrome.runtime.lastError.message}`, 'error');
                                 enableUI();
                                 currentCsvData = null; // エラー時はデータを保持しない
                            } else if (response && response.error) {
                                 showStatus(`Error from background: ${response.error}`, 'error');
                                 enableUI();
                                 currentCsvData = null; // エラー時はデータを保持しない
                            } else if (response && response.status === 'received') {
                                 showStatus('Processing started in background...', '');
                                 // UIは無効のまま (disableUIが呼ばれている)
                            } else {
                                 showStatus('Background did not confirm start.', 'error');
                                 enableUI();
                                 currentCsvData = null; // エラー時はデータを保持しない
                            }
                        }
                     );
                },
                error: function(error) {
                     // PapaParse自体のエラー
                     console.error("PapaParse Error:", error);
                     showStatus(`CSV parsing failed: ${error.message}`, 'error');
                     enableUI();
                     currentCsvData = null; // パース失敗時はデータを保持しない
                }
            });
        });
    });
}

// --- Event Listener for Start Text/HTML Button (remains mostly the same) ---
if (startTextHtmlButton) {
    startTextHtmlButton.addEventListener('click', () => {
        if (!urlListTextArea || !statusDiv) return;
        const inputText = urlListTextArea.value.trim();
        if (!inputText) { showStatus('Paste URLs or HTML.', 'error'); return; }

        showStatus('Processing pasted text/HTML...', '');
        disableUI(); // Disable UI including options button

        let urls = [];
        // HTMLリンクの抽出を試みる
        try {
            // DOMParserを使う方がより安全で確実
            const parser = new DOMParser();
            const doc = parser.parseFromString(inputText, 'text/html');
            const anchors = doc.querySelectorAll('a');

            if (anchors.length > 0 && inputText.toLowerCase().includes('<a')) {
                 anchors.forEach(anchor => {
                     const href = anchor.getAttribute('href');
                     if (href && href.trim() !== '' && !href.startsWith('#') && !href.startsWith('javascript:')) {
                         try {
                             // 相対URLを絶対URLに変換 (ベースURLが必要な場合があるが、ここでは単純化)
                             urls.push(new URL(href.trim(), 'https://example.com').href);
                         } catch (e) {
                            // 無効なURLは無視
                            console.warn(`Invalid URL skipped: ${href}`, e);
                         }
                     }
                 });
                 urls = [...new Set(urls)]; // 重複削除
            }
        } catch (e) {
            console.error("Error parsing HTML for links:", e);
            // HTMLパースに失敗した場合でも、次のテキスト処理に進む
        }

        // URLが抽出できなかった、またはHTMLではなかった場合、テキストとして処理
        if (urls.length === 0) {
            urls = inputText.split(/[\s,;\t\n"']+/).map(u => u.trim()).filter(u => u); // 区切り文字を増やし、空要素を削除
             // 簡単なURL形式チェックを追加（ドットが含まれるか、特定文字で始まらないか）
            urls = urls.filter(u => u.includes('.') && !u.startsWith('#') && !u.startsWith('javascript:'));
            urls = urls.map(u => (!/^(https?:\/\/)/i.test(u) ? 'https://' + u : u)); // http(s):// がなければ追加
            urls = urls.filter(u => { // 最終的なURL妥当性チェック
                try {
                    new URL(u);
                    return true;
                } catch (e) {
                    return false;
                 }
             });
            urls = [...new Set(urls)]; // 重複削除
        }


        if (urls.length === 0) {
             showStatus(`No valid URLs found in pasted content.`, 'error');
             enableUI(); return;
        }

        showStatus(`Found ${urls.length} URLs from text/HTML. Sending...`, '');
        // テキスト/HTMLからの場合はインデックス情報がないため、URLリストのみ送信
         chrome.runtime.sendMessage(
             { type: 'PROCESS_URL_LIST', urls: urls }, // itemsではなくurlsを送信
             (response) => {
                  if (chrome.runtime.lastError) { showStatus(`Send Error: ${chrome.runtime.lastError.message}`, 'error'); enableUI(); }
                  else if (response && response.error) { showStatus(`BG Error: ${response.error}`, 'error'); enableUI(); }
                  else if (response && response.status === 'received') { showStatus('Processing started...', ''); }
                  else { showStatus('BG did not confirm.', 'error'); enableUI(); }
             }
         );
    });
}

// --- Event Listener for Stop Button (remains the same) ---
if (stopButton) {
    stopButton.addEventListener('click', () => {
        showStatus('Sending stop request...', '');
        stopButton.disabled = true;
        chrome.runtime.sendMessage({ type: 'STOP_PROCESSING' }, (response) => {
             if (chrome.runtime.lastError) { showStatus(`Stop Error: ${chrome.runtime.lastError.message}`, 'error'); stopButton.disabled = false; }
             else if (response && response.status === 'stopping') { showStatus('Stop request sent...', ''); }
             else if (response && response.status === 'not_running') { showStatus('Not running.', 'success'); enableUI(); currentCsvData = null;} // 停止したらデータ不要
             else { showStatus('Stop response unclear.', 'error'); stopButton.disabled = false; }
        });
    });
}

// --- Message Listener (Update status, acknowledge success, handle completion) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // バックグラウンドからのメッセージタイプに応じて処理
  switch (message.type) {
      case 'UPDATE_STATUS':
          showStatus(message.text, message.isError ? 'error' : (message.isSuccess ? 'success' : ''));
          break;
      case 'URL_PROCESS_SUCCESS':
          // currentCsvData が存在し、かつ message.itemIndex が有効な場合に更新
          if (currentCsvData && currentCsvData.data && message.itemIndex !== undefined && message.itemIndex !== null) {
              const index = message.itemIndex;
              // インデックスが範囲内にあるか、より厳密にチェック
              if (index >= 0 && index < currentCsvData.data.length && currentCsvData.data[index]) {
                  currentCsvData.data[index]['is_success'] = true;
                  // ★★★ CSVデータの保存を試みる ★★★
                  saveCurrentCsvData();
              } else {
                  console.warn(`Received success for invalid index: ${index}. CSV data length: ${currentCsvData.data.length}`);
              }
          } else if (!currentCsvData) {
              console.warn("Received URL_PROCESS_SUCCESS but currentCsvData is null. Cannot update status.");
          } else if (message.itemIndex === undefined || message.itemIndex === null) {
             console.warn("Received URL_PROCESS_SUCCESS without itemIndex. This may happen for text/HTML input.");
          }
          // 応答を返す
          sendResponse({ status: "success_acknowledged" });
          return true; // 非同期応答を示すために true を返す
      case 'PROCESS_COMPLETE':
          showStatus(message.text, message.isError ? 'error' : 'success');
          enableUI(); // UIを有効化
          currentCsvData = null; // 処理完了またはエラーで終了したらデータをクリア
          break;
      // 他のメッセージタイプがあればここに追加
  }
  // 同期的に応答しない場合は false または undefined を返す（または return true しない）
  // 今回は URL_PROCESS_SUCCESS 以外は同期的で良いので、何もしない（暗黙的に undefined を返す）
  // ただし、将来的に他の非同期処理が増える可能性を考慮し、URL_PROCESS_SUCCESS以外では明示的に return true しない方が安全
});

// --- DOMContentLoaded Event Listener (Initialization) ---
document.addEventListener('DOMContentLoaded', () => {
    if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = ''; statusDiv.style.display = 'none'; }
    if (urlListTextArea) { urlListTextArea.value = ''; }

    // 保存されているカラム名とフィルター情報を読み込む
    chrome.storage.local.get(['columnName', 'filterColumnName', 'filterValue'], (result) => {
         if (!chrome.runtime.lastError) {
             if (result.columnName && columnNameInput) {
                 columnNameInput.value = result.columnName;
             } else if (columnNameInput) {
                 columnNameInput.value = 'URL'; // デフォルト値
             }
             // ★★★ 追加: フィルター情報の復元 ★★★
             if (result.filterColumnName && filterColumnInput) {
                 filterColumnInput.value = result.filterColumnName;
             }
             if (result.filterValue && filterValueInput) {
                 filterValueInput.value = result.filterValue;
             }
         } else if (columnNameInput) {
             // エラーがあってもデフォルト値を設定
              columnNameInput.value = 'URL';
         }
    });

    // ★ オプションボタンの動的作成と挿入 (変更なし) ★
    const optionsButtonElement = document.createElement('button');
    optionsButtonElement.textContent = '設定 (CSVデータの管理)';
    optionsButtonElement.id = 'optionsButton';
    optionsButtonElement.classList.add('btn', 'btn-options'); // Apply classes
    optionsButtonElement.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    const stopBtn = document.getElementById('stopButton');
    if (stopBtn && stopBtn.parentNode) {
        stopBtn.parentNode.insertBefore(optionsButtonElement, stopBtn.nextSibling);
    } else {
        const firstSection = document.querySelector('.section'); // Adjust selector if needed
        if (firstSection) {
            firstSection.appendChild(optionsButtonElement);
        } else {
            document.body.appendChild(optionsButtonElement); // Fallback
        }
    }

    enableUI(); // Ensure UI is enabled after setup
});


// --- Event Listeners for Input Changes (Save to Storage) ---
if (columnNameInput) {
    columnNameInput.addEventListener('change', () => {
        const newName = columnNameInput.value.trim();
        // 空でない場合のみ保存
        if (newName) { chrome.storage.local.set({ columnName: newName }); }
        // 空になった場合の削除処理はオプション（必要なら追加）
        // else { chrome.storage.local.remove('columnName'); }
    });
}

// ★★★ 追加: フィルター用 Input の変更リスナー ★★★
if (filterColumnInput) {
    filterColumnInput.addEventListener('change', () => {
        const newName = filterColumnInput.value.trim();
        if (newName) {
             chrome.storage.local.set({ filterColumnName: newName });
        } else {
             // カラム名が空になったら値もクリアして保存（または削除）
             if(filterValueInput) filterValueInput.value = '';
             chrome.storage.local.remove(['filterColumnName', 'filterValue']);
        }
    });
}
if (filterValueInput) {
    filterValueInput.addEventListener('change', () => {
        const newValue = filterValueInput.value.trim();
        // フィルターカラム名が入力されている場合のみ値を保存
        if (filterColumnInput && filterColumnInput.value.trim() && newValue) {
            chrome.storage.local.set({ filterValue: newValue });
        } else if (filterColumnInput && filterColumnInput.value.trim() && !newValue) {
            // 値が空になったら削除
            chrome.storage.local.remove('filterValue');
        }
        // フィルターカラム名が空の場合は何もしない（カラム名が変更された時に処理される）
    });
}
