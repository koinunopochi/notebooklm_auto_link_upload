let currentCsvData = null;
let statusTimeout = null;

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
    const csvString = Papa.unparse(currentCsvData);
    chrome.storage.local.set({ csvData: csvString }, () => {
      if (chrome.runtime.lastError) {
        // Error saving data - log removed
      }
    });
  } catch (e) {
    // Papa.unparse error - log removed
  }
}

function showStatus(message, type = '') {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';

    if (statusTimeout) {
        clearTimeout(statusTimeout);
    }
    if (type !== 'error') {
        statusTimeout = setTimeout(() => {
            if (statusDiv.textContent === message) {
                statusDiv.style.display = 'none';
                statusDiv.className = '';
                statusDiv.textContent = '';
            }
        }, 5000);
    }
}

const columnNameInput = document.getElementById('columnNameInput');
const startButton = document.getElementById('startButton');
const urlListTextArea = document.getElementById('urlList');
const startTextHtmlButton = document.getElementById('startTextHtmlButton');
const statusDiv = document.getElementById('status');
const stopButton = document.getElementById('stopButton');

function disableUI(showStop = true) {
    if (startButton) startButton.disabled = true;
    if (startTextHtmlButton) startTextHtmlButton.disabled = true;
    if (columnNameInput) columnNameInput.disabled = true;
    if (urlListTextArea) urlListTextArea.disabled = true;
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
    if (stopButton) {
        stopButton.style.display = 'none';
        stopButton.disabled = true;
    }
}

if (startButton) {
    startButton.addEventListener('click', () => {
        if (!columnNameInput || !statusDiv) {
             alert("Popup Error: Required elements missing.");
             return;
        }
        const columnName = columnNameInput.value.trim();
        if (!columnName) {
            showStatus('Please enter the column name for URLs.', 'error');
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
                        showStatus(`Error parsing saved CSV: ${results.errors[0].message}`, 'error');
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
                    currentCsvData = results;

                    if (!results.meta.fields.includes(columnName)) {
                        const available = results.meta.fields.join(', ');
                        showStatus(`Error: Column "${columnName}" not found. Available: ${available}`, 'error');
                        enableUI(); currentCsvData = null; return;
                    }

                    const itemsToProcess = results.data
                        .map((row, index) => ({ row, index }))
                        .filter(item => {
                            const isSuccess = item.row['is_success'] === true;
                            const urlValue = item.row[columnName];
                            const isValid = urlValue && typeof urlValue === 'string' && urlValue.trim() !== '' && !urlValue.startsWith('#');
                            return !isSuccess && isValid;
                        })
                        .map(item => ({
                            index: item.index,
                            url: String(item.row[columnName]).trim()
                        }));

                    const uniqueUrls = new Map();
                    itemsToProcess.forEach(item => { if (!uniqueUrls.has(item.url)) uniqueUrls.set(item.url, item); });
                    const finalItemsToProcess = Array.from(uniqueUrls.values());

                    if (finalItemsToProcess.length === 0) {
                         showStatus(`No new valid URLs found in column "${columnName}".`, 'success');
                         enableUI(); return;
                    }

                    showStatus(`Found ${finalItemsToProcess.length} new URLs. Sending...`, '');
                    chrome.runtime.sendMessage(
                        { type: 'PROCESS_URL_LIST', items: finalItemsToProcess },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                 showStatus(`Error sending data: ${chrome.runtime.lastError.message}`, 'error');
                                 enableUI();
                            } else if (response && response.error) {
                                 showStatus(`Error from background: ${response.error}`, 'error');
                                 enableUI();
                            } else if (response && response.status === 'received') {
                                 showStatus('Processing started in background...', '');
                            } else {
                                 showStatus('Background did not confirm start.', 'error');
                                 enableUI();
                            }
                        }
                     );
                },
                error: function(error) {
                     showStatus(`CSV parsing failed: ${error.message}`, 'error');
                     enableUI(); currentCsvData = null;
                }
            });
        });
    });
}

if (startTextHtmlButton) {
    startTextHtmlButton.addEventListener('click', () => {
        if (!urlListTextArea || !statusDiv) return;
        const inputText = urlListTextArea.value.trim();
        if (!inputText) { showStatus('Paste URLs or HTML.', 'error'); return; }

        showStatus('Processing pasted text/HTML...', '');
        disableUI();

        let urls = [];
        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = inputText;
            const anchors = tempDiv.querySelectorAll('a');
            if (anchors.length > 0 && inputText.toLowerCase().includes('<a')) {
                 anchors.forEach(anchor => {
                     const href = anchor.getAttribute('href');
                     if (href && href.trim() !== '' && !href.startsWith('#') && !href.startsWith('javascript:')) {
                         try { urls.push(new URL(href.trim(), 'https://example.com').href); } catch (e) {}
                     }
                 });
                 urls = [...new Set(urls)];
            }
        } catch (e) {}
        if (urls.length === 0) {
            urls = inputText.split(/[\s,;\t\n]+/).map(u => u.trim()).filter(u => u && u.includes('.') && !u.startsWith('#'));
            urls = urls.map(u => (!/^(https?:\/\/)/i.test(u) ? 'https://' + u : u));
            urls = urls.filter(u => { try { new URL(u); return true; } catch (e) { return false; } });
            urls = [...new Set(urls)];
        }

        if (urls.length === 0) {
             showStatus(`No valid URLs found in pasted content.`, 'error');
             enableUI(); return;
        }

        showStatus(`Found ${urls.length} URLs from text/HTML. Sending...`, '');
         chrome.runtime.sendMessage(
             { type: 'PROCESS_URL_LIST', urls: urls },
             (response) => {
                  if (chrome.runtime.lastError) { showStatus(`Send Error: ${chrome.runtime.lastError.message}`, 'error'); enableUI(); }
                  else if (response && response.error) { showStatus(`BG Error: ${response.error}`, 'error'); enableUI(); }
                  else if (response && response.status === 'received') { showStatus('Processing started...', ''); }
                  else { showStatus('BG did not confirm.', 'error'); enableUI(); }
             }
         );
    });
}

if (stopButton) {
    stopButton.addEventListener('click', () => {
        showStatus('Sending stop request...', '');
        stopButton.disabled = true;
        chrome.runtime.sendMessage({ type: 'STOP_PROCESSING' }, (response) => {
             if (chrome.runtime.lastError) { showStatus(`Stop Error: ${chrome.runtime.lastError.message}`, 'error'); stopButton.disabled = false; }
             else if (response && response.status === 'stopping') { showStatus('Stop request sent...', ''); }
             else if (response && response.status === 'not_running') { showStatus('Not running.', 'success'); enableUI(); }
             else { showStatus('Stop response unclear.', 'error'); stopButton.disabled = false; }
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_STATUS') {
    showStatus(message.text, message.isError ? 'error' : (message.isSuccess ? 'success' : ''));
  }
  else if (message.type === 'URL_PROCESS_SUCCESS') {
      if (currentCsvData && currentCsvData.data && message.itemIndex !== undefined) {
          const index = message.itemIndex;
          if (index >= 0 && index < currentCsvData.data.length && currentCsvData.data[index]) {
              currentCsvData.data[index]['is_success'] = true;
              saveCurrentCsvData();
          } else {
              // Index out of bounds - log removed
          }
      }
      sendResponse({ status: "success_acknowledged" });
      return true;
  }
  else if (message.type === 'PROCESS_COMPLETE') {
    showStatus(message.text, message.isError ? 'error' : 'success');
    enableUI();
    currentCsvData = null;
  }
    return true;
});

document.addEventListener('DOMContentLoaded', () => {
    if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = ''; statusDiv.style.display = 'none'; }
    if (urlListTextArea) { urlListTextArea.value = ''; urlListTextArea.focus(); }

    chrome.storage.local.get(['columnName'], (result) => {
         if (!chrome.runtime.lastError && result.columnName) {
             if (columnNameInput) columnNameInput.value = result.columnName;
         } else if (columnNameInput) {
             columnNameInput.value = 'URL';
         }
    });
    enableUI();
});

if (columnNameInput) {
    columnNameInput.addEventListener('change', () => {
        const newName = columnNameInput.value.trim();
        if (newName) { chrome.storage.local.set({ columnName: newName }); }
    });
}

const openOptionsButton = document.createElement('button');
openOptionsButton.textContent = '設定 (Load/Manage CSV)';
openOptionsButton.style.marginTop = '10px';
openOptionsButton.id = 'optionsButton';
openOptionsButton.addEventListener('click', () => { chrome.runtime.openOptionsPage(); });
const textHtmlBtn = document.getElementById('startTextHtmlButton');
if(textHtmlBtn && textHtmlBtn.parentNode) {
    textHtmlBtn.parentNode.insertBefore(openOptionsButton, textHtmlBtn.nextSibling);
} else {
    document.body.appendChild(openOptionsButton);
}
